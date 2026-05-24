/**
 * ─── UI Command Gateway ────────────────────────────────────────────
 * The ONLY door from UI components into the operational command path.
 *
 * Rule (canonical, see memory "Command Gate"):
 *   UI → uiCommandGateway → CommandBus → SafetyStateMachine → FieldBus
 *
 * UI must NEVER:
 *   - call safetyStateMachine.transition() directly
 *   - call fieldBus.send() / pyroExecutor.fire() / droneExecutor.send()
 *   - mutate engines (fireone, pbus, fieldTestEngine, module.*) inline in onClick
 *
 * Instead, every interactive surface calls one of the methods below. The
 * gateway:
 *   1. Records intent (source, label) into SafetyAuditTrail.
 *   2. Dispatches the canonical Command on the CommandBus (CommandLog records
 *      it for replay).
 *   3. For E_STOP, the BlackBox is touched synchronously so the <100ms
 *      audit budget holds even if downstream engines are stuck.
 *
 * Safety Gate is currently in quarantine (Modo Testes — see memory
 * "Safety Gate Quarentena"). The gateway therefore does NOT block —
 * it only routes + audits. When the gate is restored, the only change
 * needed here is to honour the SSM denial result before dispatch.
 */

import { commandBus } from './CommandBus';
import { safetyAuditTrail } from '@/core/safety/SafetyAuditTrail';
import { blackbox } from '@/core/reliability/blackBoxRecorder';

export interface CommandSource {
  /** Human-readable origin — e.g. "FieldTestDesktop", "PyroControllerCard". */
  source: string;
  /** Optional sub-label (channel id, fixture id, …) for the audit trail. */
  detail?: string;
}

function audit(event: string, src: CommandSource, extra?: Record<string, unknown>): void {
  try {
    safetyAuditTrail.log({
      timestamp: Date.now(),
      tick: 0,
      event: 'STATE',
      from: 'UI',
      to: event,
      detail: `[${src.source}] ${event}${src.detail ? ` (${src.detail})` : ''}`,
      ...(extra ?? {}),
    } as any);
  } catch {
    /* never block on audit failure */
  }
}

export const uiCommandGateway = {
  // ── Safety transitions ──────────────────────────────────────────
  arm(src: CommandSource): void {
    audit('ARM_SYSTEM', src);
    commandBus.dispatch({ type: 'ARM_SYSTEM' });
  },

  disarm(src: CommandSource): void {
    audit('DISARM_SYSTEM', src);
    commandBus.dispatch({ type: 'DISARM_SYSTEM' });
  },

  lock(src: CommandSource): void {
    audit('LOCK_STATE', src);
    commandBus.dispatch({ type: 'LOCK_STATE' });
  },

  unlock(src: CommandSource): void {
    audit('UNLOCK_STATE', src);
    commandBus.dispatch({ type: 'UNLOCK_STATE' });
  },

  reset(src: CommandSource): void {
    audit('RESET_SAFETY', src);
    commandBus.dispatch({ type: 'RESET_SAFETY' });
  },

  // ── Critical: E-STOP ────────────────────────────────────────────
  /**
   * Triggers the global Emergency Stop.
   * - Records to BlackBox synchronously (≤100ms audit budget).
   * - Dispatches `E_STOP` on the CommandBus.
   * The downstream SSM short-circuits FIRING and forces SAFE state.
   */
  eStop(src: CommandSource): void {
    const t0 = performance.now();
    try {
      blackbox.record('state', `E-STOP from UI [${src.source}]${src.detail ? ` ${src.detail}` : ''}`);
    } catch {
      /* never block E-STOP on audit failure */
    }
    audit('E_STOP', src, { latencyMs: performance.now() - t0 });
    commandBus.dispatch({ type: 'E_STOP' });
  },

  // ── Fire ────────────────────────────────────────────────────────
  fire(src: CommandSource, payload?: unknown): void {
    audit('FIRE', src);
    commandBus.dispatch({ type: 'FIRE', payload });
  },

  // ── Continuity probe (read-only — safe in any mode) ─────────────
  continuityCheck(src: CommandSource): void {
    audit('CONTINUITY_CHECK', src);
    commandBus.dispatch({ type: 'CONTINUITY_CHECK' });
  },
};

export type UiCommandGateway = typeof uiCommandGateway;
