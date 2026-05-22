/**
 * ─── Safety State Machine ──────────────────────────────────────────
 * Deterministic interlock chain for mission-critical pyro operations.
 * Lives OUTSIDE React — pure state machine, zero dependencies.
 *
 * States: IDLE → LOCKED → ARMED → FIRING → COOLDOWN → ARMED
 *                                    ↘ E_STOP → SAFE (terminal)
 *         SAFE + RESET_SAFETY → IDLE
 */

import { safetyAuditTrail } from './SafetyAuditTrail';
import { evaluate as evaluateGuardrail, type Caller } from './aiGuardrail';

export type SafetyState = 'IDLE' | 'LOCKED' | 'ARMED' | 'FIRING' | 'COOLDOWN' | 'SAFE';
export type { Caller } from './aiGuardrail';

export type SafetyTransition =
  | 'LOCK_STATE'
  | 'UNLOCK_STATE'
  | 'ARM_SYSTEM'
  | 'DISARM_SYSTEM'
  | 'FIRE'
  | 'FIRE_COMPLETE'
  | 'COOLDOWN_COMPLETE'
  | 'E_STOP'
  | 'RESET_SAFETY';

export interface TransitionResult {
  allowed: boolean;
  from: SafetyState;
  to: SafetyState;
  reason?: string;
}

export type TransitionListener = (result: TransitionResult & { transition: SafetyTransition }) => void;

/** Pre-conditions that external systems can provide */
export interface InterlockConditions {
  linkStable: boolean;
  validationPassed: boolean;
  isDryRun: boolean;
  continuityOk: boolean;
}

// ── Transition table ───────────────────────────────────────────────
const TRANSITIONS: Record<SafetyState, Partial<Record<SafetyTransition, SafetyState>>> = {
  IDLE:     { LOCK_STATE: 'LOCKED', E_STOP: 'SAFE' },
  LOCKED:   { ARM_SYSTEM: 'ARMED', UNLOCK_STATE: 'IDLE', E_STOP: 'SAFE' },
  ARMED:    { FIRE: 'FIRING', DISARM_SYSTEM: 'LOCKED', E_STOP: 'SAFE' },
  FIRING:   { FIRE_COMPLETE: 'COOLDOWN', E_STOP: 'SAFE' },
  COOLDOWN: { COOLDOWN_COMPLETE: 'ARMED', E_STOP: 'SAFE' },
  SAFE:     { RESET_SAFETY: 'IDLE' },
};

class SafetyStateMachine {
  private _state: SafetyState = 'IDLE';
  private _conditions: InterlockConditions = {
    linkStable: true,
    validationPassed: false,
    isDryRun: false,
    continuityOk: false,
  };
  private _listeners: TransitionListener[] = [];
  private _cooldownTimer: ReturnType<typeof setTimeout> | null = null;
  private _inTransition = false; // re-entrancy guard (prevents listener-triggered loops)

  get state(): SafetyState { return this._state; }
  get conditions(): Readonly<InterlockConditions> { return this._conditions; }

  /** Update external interlock conditions */
  setConditions(partial: Partial<InterlockConditions>): void {
    Object.assign(this._conditions, partial);
  }

  /**
   * Attempt a transition. Returns result with allowed/denied + reason.
   * `caller` defaults to 'human' for backward compatibility. Pass 'agent'
   * for any AI/JOI/automation path — the central guardrail will hard-block
   * physical/safety transitions even if the SSM table would allow them.
   * 'system' is reserved for internal callbacks (cooldown auto-advance).
   */
  transition(t: SafetyTransition, opts: { caller?: Caller } = {}): TransitionResult {
    const from = this._state;
    const caller: Caller = opts.caller ?? 'human';

    // ── AI guardrail (central) ────────────────────────────────────
    // Even E_STOP is blocked from agent callers — a malicious model
    // shouldn't be able to terminate a live show.
    const guard = evaluateGuardrail(t, caller);
    if (!guard.allowed) {
      try {
        safetyAuditTrail.log({
          timestamp: Date.now(),
          tick: 0,
          event: 'VIOLATION',
          from,
          to: from,
          detail: guard.reason ?? 'AI guardrail blocked transition',
        });
      } catch { /* never block on audit failure */ }
      return { allowed: false, from, to: from, reason: guard.reason };
    }

    // Re-entrancy guard: a listener triggered another transition while we were
    // mid-flight. Allow E_STOP through (safety-critical), block everything else.
    if (this._inTransition && t !== 'E_STOP') {
      return { allowed: false, from, to: from, reason: 'Transition re-entrancy blocked' };
    }
    this._inTransition = true;
    try {

    // E_STOP always allowed from any state — log to black box (≤100ms requirement)
    if (t === 'E_STOP') {
      this._clearCooldown();
      this._state = 'SAFE';
      const result: TransitionResult = { allowed: true, from, to: 'SAFE' };
      // Audit FIRST so the event is captured even if a listener throws
      try {
        safetyAuditTrail.log({
          timestamp: Date.now(),
          tick: 0,
          event: 'E_STOP',
          from,
          to: 'SAFE',
          detail: `E-STOP triggered from ${from}`,
        });
      } catch { /* never block E-STOP on audit failure */ }
      this._notify(t, result);
      return result;
    }

    // Check if transition exists in table
    const target = TRANSITIONS[from]?.[t];
    if (!target) {
      const result: TransitionResult = {
        allowed: false, from, to: from,
        reason: `Transition ${t} not valid from state ${from}`,
      };
      this._notify(t, result);
      return result;
    }

    // Pre-condition checks
    const denial = this._checkPreconditions(t);
    if (denial) {
      const result: TransitionResult = { allowed: false, from, to: from, reason: denial };
      this._notify(t, result);
      return result;
    }

    // Defensive cleanup: any transition that exits COOLDOWN or ARMED
    // (other than entering COOLDOWN itself) must invalidate any pending
    // auto-advance timer to keep the machine deterministic.
    if (from === 'COOLDOWN' || from === 'ARMED') {
      if (target !== 'COOLDOWN') this._clearCooldown();
    }

    // Execute transition
    this._state = target;
    const result: TransitionResult = { allowed: true, from, to: target };
    this._notify(t, result);

    // Auto-advance COOLDOWN after 2s. Internal timer uses caller='system'
    // so the AI guardrail never blocks the natural FIRE→COOLDOWN→ARMED loop.
    if (target === 'COOLDOWN') {
      this._cooldownTimer = setTimeout(() => {
        this._cooldownTimer = null;
        if (this._state === 'COOLDOWN') {
          this.transition('COOLDOWN_COMPLETE', { caller: 'system' });
        }
      }, 2000);
    }

    return result;
    } finally {
      this._inTransition = false;
    }
  }

  /** Subscribe to all transition attempts (including denied). */
  onTransition(listener: TransitionListener): () => void {
    this._listeners.push(listener);
    return () => {
      const idx = this._listeners.indexOf(listener);
      if (idx >= 0) this._listeners.splice(idx, 1);
    };
  }

  /** Reset to IDLE (for tests / teardown). */
  reset(): void {
    this._clearCooldown();
    this._state = 'IDLE';
  }

  // ── Private ────────────────────────────────────────────────────
  private _checkPreconditions(t: SafetyTransition): string | null {
    const c = this._conditions;
    switch (t) {
      case 'ARM_SYSTEM':
        if (!c.linkStable) return 'Cannot ARM: link not stable';
        if (!c.validationPassed) return 'Cannot ARM: validation has critical failures';
        if (c.isDryRun) return 'Cannot ARM: system in DRY RUN mode';
        if (!c.continuityOk) return 'Cannot ARM: continuity check not passed (run check first)';
        return null;
      case 'FIRE':
        if (!c.continuityOk) return 'Cannot FIRE: continuity check failed';
        if (!c.linkStable) return 'Cannot FIRE: link not stable';
        return null;
      default:
        return null;
    }
  }

  private _notify(t: SafetyTransition, result: TransitionResult): void {
    const payload = { ...result, transition: t };
    for (let i = 0; i < this._listeners.length; i++) {
      this._listeners[i](payload);
    }
  }

  private _clearCooldown(): void {
    if (this._cooldownTimer) {
      clearTimeout(this._cooldownTimer);
      this._cooldownTimer = null;
    }
  }
}

export const safetyStateMachine = new SafetyStateMachine();
