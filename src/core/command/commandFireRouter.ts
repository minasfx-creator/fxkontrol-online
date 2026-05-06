/**
 * ─── Command Fire Router ────────────────────────────────────────────
 *
 * Único consumidor do evento `'FIRE'` no `commandBus`. Fecha o último
 * elo entre `uiCommandGateway.fire()` e o hardware real:
 *
 *   uiCommandGateway.fire()
 *     → commandBus.dispatch({ type:'FIRE', payload })
 *     → SafetyValidator (no tick do EngineProvider)
 *     → commandBus.applyAll → este handler
 *     → evaluatePyroDispatchVerdict (BLE ban + audit)
 *     → pyroExecutor.fire(cue, fieldBus)
 *     → activeTransport.send (real wire registrada via realTransports.ts)
 *
 * Pure side-effect glue — nenhum atalho novo, nenhum estado próprio.
 * Idempotente: `attachCommandFireRouter()` retorna o `unsubscribe`.
 */

import { commandBus } from './CommandBus';
import { pyroExecutor, type PyroCue } from '@/core/execution/pyroExecutor';
import { fieldBus } from '@/core/network/fieldBus';
import { workMode } from '@/core/safety/workMode';
import { evaluatePyroDispatchVerdict, recordSafetyNote } from '@/core/safety/safetyBlackBox';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { hashShowPlan } from '@/core/showplan/showPlanHash';
import type { DiscoveryTransport } from '@/core/discovery/types';
import { deviceAggregator } from '@/core/discovery/DeviceAggregator';

export interface FirePayload {
  /** Resolve cue from the loaded ShowPlan. */
  cueId?: string;
  /** Manual one-shot firing (no plan binding). */
  slat?: number;
  cue?: number;
  moduleAddress?: number;
  channel?: number;
  duration?: number;
  effectId?: string;
}

/** Snapshot which transports actually have a wired link right now. */
function listAvailableTransports(): DiscoveryTransport[] {
  const out = new Set<DiscoveryTransport>();
  try {
    for (const dev of deviceAggregator.getDevices()) {
      const links = (dev as any).links ?? {};
      for (const k of Object.keys(links)) {
        if (links[k]) out.add(k as DiscoveryTransport);
      }
    }
  } catch { /* aggregator might be cold during boot */ }
  return [...out];
}

function resolveCue(payload: FirePayload | undefined): PyroCue | null {
  if (!payload) return null;

  // 1. ShowPlan cue
  if (payload.cueId) {
    try {
      const plan = showPlanManager.current;
      const cue = plan.pyroCues.find(c => c.id === payload.cueId);
      if (cue) {
        return {
          id: cue.id,
          moduleAddress: (cue as any).moduleAddress ?? (cue as any).module ?? payload.moduleAddress ?? 0,
          channel: (cue as any).channel ?? payload.channel ?? 0,
          fireTime: (cue as any).fireTime ?? (cue as any).startTime ?? 0,
          preFireDelay: (cue as any).preFireDelay ?? 0,
          duration: (cue as any).duration ?? payload.duration ?? 0.1,
          effectId: (cue as any).effectId ?? payload.effectId ?? 'manual',
        };
      }
    } catch { /* fall-through to manual */ }
  }

  // 2. Manual one-shot (FireOnePanel sends { slat, cue })
  const moduleAddress = payload.moduleAddress ?? payload.slat;
  const channel = payload.channel ?? payload.cue;
  if (typeof moduleAddress === 'number' && typeof channel === 'number') {
    return {
      id: `manual-${moduleAddress}-${channel}-${Date.now()}`,
      moduleAddress,
      channel,
      fireTime: 0,
      preFireDelay: 0,
      duration: payload.duration ?? 0.1,
      effectId: payload.effectId ?? 'manual',
    };
  }
  return null;
}

let attached = false;
let unsub: (() => void) | null = null;

export function attachCommandFireRouter(): () => void {
  if (attached && unsub) return unsub;
  attached = true;
  unsub = commandBus.on('FIRE', async (cmd) => {
    if (cmd.type !== 'FIRE') return;
    const payload = cmd.payload as FirePayload | undefined;

    // Compute plan hash (best-effort — non-blocking on canonical sims).
    let planHash: string | undefined;
    try { planHash = await hashShowPlan(showPlanManager.current); } catch { /* noop */ }

    // Verdict gate is only enforced in real_operation. In design/simulation
    // we still record an audit note but never block (canonical: SIMULATION = ok).
    if (workMode.get() === 'real_operation') {
      const verdict = await evaluatePyroDispatchVerdict({
        available: listAvailableTransports(),
        mode: 'real_operation',
        planHash,
        cueId: payload?.cueId,
      });
      if (!verdict.ok) {
        void recordSafetyNote('fire-blocked', {
          reason: verdict.reason,
          mode: 'real_operation',
          cueId: payload?.cueId,
        });
        return;
      }
    }

    const cue = resolveCue(payload);
    if (!cue) {
      void recordSafetyNote('fire-blocked', { reason: 'cue-unresolved', payload });
      return;
    }

    const ok = pyroExecutor.fire(cue, fieldBus);
    void recordSafetyNote(ok ? 'fire-dispatched' : 'fire-buffered-offline', {
      cueId: cue.id,
      module: cue.moduleAddress,
      channel: cue.channel,
      transport: fieldBus.getActiveTransport(),
      planHash,
    });
  });
  return unsub;
}

export function detachCommandFireRouter(): void {
  if (unsub) { unsub(); unsub = null; }
  attached = false;
}
