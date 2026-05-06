/**
 * ─── useSystemReadiness — Canonical Cockpit State ──────────────────
 * Pure read aggregating ShowPlan / Verification / Readiness / SSM /
 * WorkMode / DeviceAggregator into a single Mission Control state.
 *
 * STRICT RULES:
 *   • Read-only. NEVER calls uiCommandGateway, fieldBus, executor,
 *     safetyStateMachine.transition, or workMode.set().
 *   • Polls at 1s + subscribes to SSM/WorkMode for instant transitions.
 *   • Cleanup guaranteed (clearInterval + unsubscribe on unmount).
 */

import { useEffect, useState } from 'react';
import { readinessEvaluator } from '@/core/hardware/ReadinessEvaluator';
import {
  safetyStateMachine,
  type SafetyState,
} from '@/core/safety/SafetyStateMachine';
import { workMode, useWorkMode } from '@/core/safety/workMode';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { verificationEngine } from '@/core/verification/VerificationEngine';
import { deviceAggregator } from '@/core/discovery/DeviceAggregator';
import type { ReadinessStatus } from '@/core/hardware/types';

export type CockpitStatus =
  | 'EMPTY'
  | 'INVALID'
  | 'BLOCKED'
  | 'READY'
  | 'ARMED'
  | 'FIRING'
  | 'FAULT'
  | 'E_STOPPED';

export type DominantProvenance =
  | 'live_read_only'
  | 'replay'
  | 'simulated'
  | 'not_integrated'
  | 'none';

export interface SystemReadiness {
  status: CockpitStatus;
  workMode: ReturnType<typeof workMode.get>;
  safetyState: SafetyState;
  readinessStatus: ReadinessStatus | 'NO_PLAN';
  blockingReasons: string[];
  warnings: string[];
  dominantProvenance: DominantProvenance;
  devicesOnline: number;
  devicesTotal: number;
  showPlanLoaded: boolean;
}

const PROV_RANK: Record<DominantProvenance, number> = {
  live_read_only: 4,
  replay: 3,
  simulated: 2,
  not_integrated: 1,
  none: 0,
};

function computeDominantProvenance(): {
  dominant: DominantProvenance;
  online: number;
  total: number;
} {
  let dominant: DominantProvenance = 'none';
  let online = 0;
  let total = 0;
  try {
    const devs = deviceAggregator.getDevices?.() ?? [];
    total = devs.length;
    for (const d of devs as unknown as Array<Record<string, unknown>>) {
      const status = String(d.status ?? d.connection_state ?? '');
      if (status === 'connected' || status === 'online') online++;
      const prov = String(
        d.provenance ?? d.integration_mode ?? d.integrationMode ?? '',
      ) as DominantProvenance;
      if (prov in PROV_RANK && PROV_RANK[prov] > PROV_RANK[dominant]) {
        dominant = prov;
      }
    }
  } catch {
    /* aggregator may not be ready in tests */
  }
  return { dominant, online, total };
}

export function evaluateSystemReadiness(): SystemReadiness {
  const ssmState = safetyStateMachine.state;
  const wm = workMode.get();
  const plan = showPlanManager.current;
  const planLoaded =
    plan.pyroCues.length + plan.dmxCues.length + plan.dronePaths.length > 0;

  // Provenance
  const { dominant, online, total } = computeDominantProvenance();

  // Verification (best-effort — engine may throw on empty plan)
  let verificationFailed = false;
  try {
    const v = verificationEngine.run();
    verificationFailed = v.level === 'BLOCKED';
  } catch {
    verificationFailed = planLoaded; // plan exists but verification crashed
  }

  // Readiness
  let readinessStatus: ReadinessStatus | 'NO_PLAN' = 'NO_PLAN';
  let blockingReasons: string[] = [];
  let warnings: string[] = [];
  if (planLoaded) {
    try {
      const r = readinessEvaluator.evaluate();
      readinessStatus = r.status;
      blockingReasons = r.issues
        .filter((i) => i.severity === 'error')
        .map((i) => `${i.source}: ${i.message}`);
      warnings = r.warnings ?? [];
    } catch (e) {
      blockingReasons = [
        `ReadinessEvaluator threw: ${e instanceof Error ? e.message : 'unknown'}`,
      ];
    }
  }

  // Cockpit status (precedence: safety > plan > verification > readiness)
  let status: CockpitStatus;
  if (ssmState === 'SAFE') status = 'E_STOPPED';
  else if (ssmState === 'FIRING') status = 'FIRING';
  else if (ssmState === 'ARMED') status = 'ARMED';
  else if (!planLoaded) status = 'EMPTY';
  else if (verificationFailed) status = 'INVALID';
  else if (readinessStatus === 'BLOCKED' || blockingReasons.length > 0)
    status = 'BLOCKED';
  else status = 'READY';

  return {
    status,
    workMode: wm,
    safetyState: ssmState,
    readinessStatus,
    blockingReasons,
    warnings,
    dominantProvenance: dominant,
    devicesOnline: online,
    devicesTotal: total,
    showPlanLoaded: planLoaded,
  };
}

export function useSystemReadiness(pollMs = 1000): SystemReadiness {
  // workMode hook ensures re-render on switch
  useWorkMode();
  const [snap, setSnap] = useState<SystemReadiness>(() =>
    evaluateSystemReadiness(),
  );

  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (!alive) return;
      setSnap(evaluateSystemReadiness());
    };
    const id = setInterval(tick, pollMs);
    const unsubSsm = safetyStateMachine.onTransition?.(tick);
    const unsubWm = workMode.subscribe?.(tick);
    return () => {
      alive = false;
      clearInterval(id);
      try { unsubSsm?.(); } catch { /* noop */ }
      try { unsubWm?.(); } catch { /* noop */ }
    };
  }, [pollMs]);

  return snap;
}
