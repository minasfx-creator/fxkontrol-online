/**
 * ─── Safety Validator ──────────────────────────────────────────────
 * Command gate: intercepts commands BEFORE execution.
 * Validates against SafetyStateMachine interlock chain.
 * Rejected commands are logged to SafetyAuditTrail but NOT applied.
 */

import type { Command } from '@/core/command/CommandBus';
import { safetyStateMachine, type SafetyTransition } from './SafetyStateMachine';
import { safetyAuditTrail, type AuditEntry } from './SafetyAuditTrail';
import { safetyGate } from './safetyGate';

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
}

/** Map command types to safety transitions */
const CMD_TO_TRANSITION: Partial<Record<Command['type'], SafetyTransition>> = {
  LOCK_STATE: 'LOCK_STATE',
  UNLOCK_STATE: 'UNLOCK_STATE',
  ARM_SYSTEM: 'ARM_SYSTEM',
  DISARM_SYSTEM: 'DISARM_SYSTEM',
  FIRE: 'FIRE',
  E_STOP: 'E_STOP',
  RESET_SAFETY: 'RESET_SAFETY',
};

/** Event type for audit trail */
const CMD_TO_AUDIT_EVENT: Partial<Record<Command['type'], AuditEntry['event']>> = {
  ARM_SYSTEM: 'ARM',
  DISARM_SYSTEM: 'DISARM',
  FIRE: 'FIRE',
  E_STOP: 'E_STOP',
  LOCK_STATE: 'LOCK',
  UNLOCK_STATE: 'UNLOCK',
  RESET_SAFETY: 'RESET',
};

class SafetyValidator {
  /**
   * Validate and potentially execute a safety-critical command.
   * Returns whether the command should proceed to the CommandBus handlers.
   */
  validate(cmd: Command, tick: number): ValidationResult {
    const transition = CMD_TO_TRANSITION[cmd.type];

    // Non-safety commands always pass
    if (!transition) {
      return { allowed: true };
    }

    // Gate bypass — when interlock chain is disabled by user preference,
    // log a GATE_BYPASS entry to keep audit honest, but allow the command.
    if (!safetyGate.isEnforced('interlockChain')) {
      const auditEvent = CMD_TO_AUDIT_EVENT[cmd.type] ?? 'STATE_CHANGE';
      safetyAuditTrail.log({
        timestamp: Date.now(),
        tick,
        event: auditEvent,
        from: safetyStateMachine.state,
        to: safetyStateMachine.state,
        detail: `${cmd.type} GATE_BYPASS (interlock chain disabled by user)`,
      });
      return { allowed: true };
    }

    // Attempt state machine transition
    const result = safetyStateMachine.transition(transition);
    const auditEvent = CMD_TO_AUDIT_EVENT[cmd.type] ?? 'STATE_CHANGE';

    // Log to audit trail
    safetyAuditTrail.log({
      timestamp: Date.now(),
      tick,
      event: result.allowed ? auditEvent : 'VIOLATION',
      from: result.from,
      to: result.to,
      detail: result.allowed
        ? `${cmd.type}: ${result.from} → ${result.to}`
        : `${cmd.type} DENIED: ${result.reason}`,
    });

    if (!result.allowed) {
      return { allowed: false, reason: result.reason };
    }

    return { allowed: true };
  }

  /** Get current interlock chain status for UI display. */
  getInterlockStatus() {
    const state = safetyStateMachine.state;
    const conditions = safetyStateMachine.conditions;

    return {
      state,
      conditions,
      chainProgress: this._chainProgress(state),
    };
  }

  private _chainProgress(state: string): number {
    const ORDER = ['IDLE', 'LOCKED', 'ARMED', 'FIRING'];
    const idx = ORDER.indexOf(state);
    if (state === 'SAFE') return 0;
    if (state === 'COOLDOWN') return 3;
    return idx >= 0 ? idx : 0;
  }
}

export const safetyValidator = new SafetyValidator();
