/**
 * Validates IDLE → LOCKED → ARMED transition under STRICT safety gate.
 * Also asserts that pre-conditions block ARM until satisfied.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { safetyStateMachine } from '../SafetyStateMachine';
import { safetyGate } from '../safetyGate';

describe('SafetyStateMachine — IDLE → LOCKED → ARMED (strict)', () => {
  beforeEach(() => {
    safetyStateMachine.reset();
    safetyStateMachine.setConditions({
      linkStable: false,
      validationPassed: false,
      isDryRun: false,
      continuityOk: false,
    });
  });

  it('strict mode is enforced (gate ON for all layers)', () => {
    expect(safetyGate.isStrict).toBe(true);
    expect(safetyGate.isEnforced('interlockChain')).toBe(true);
    expect(safetyGate.isEnforced('modeGuard')).toBe(true);
    expect(safetyGate.anyEnforced).toBe(true);
  });

  it('starts at IDLE', () => {
    expect(safetyStateMachine.state).toBe('IDLE');
  });

  it('transitions IDLE → LOCKED via LOCK_STATE', () => {
    const r = safetyStateMachine.transition('LOCK_STATE');
    expect(r.allowed).toBe(true);
    expect(r.from).toBe('IDLE');
    expect(r.to).toBe('LOCKED');
    expect(safetyStateMachine.state).toBe('LOCKED');
  });

  it('blocks ARM_SYSTEM when pre-conditions are not met', () => {
    safetyStateMachine.transition('LOCK_STATE');
    const r = safetyStateMachine.transition('ARM_SYSTEM');
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/link not stable/i);
    expect(safetyStateMachine.state).toBe('LOCKED');
  });

  it('transitions LOCKED → ARMED once interlock conditions are satisfied', () => {
    safetyStateMachine.transition('LOCK_STATE');
    safetyStateMachine.setConditions({
      linkStable: true,
      validationPassed: true,
      continuityOk: true,
      isDryRun: false,
    });
    const r = safetyStateMachine.transition('ARM_SYSTEM');
    expect(r.allowed).toBe(true);
    expect(r.from).toBe('LOCKED');
    expect(r.to).toBe('ARMED');
    expect(safetyStateMachine.state).toBe('ARMED');
  });

  it('rejects invalid transitions (e.g. FIRE from IDLE)', () => {
    const r = safetyStateMachine.transition('FIRE');
    expect(r.allowed).toBe(false);
    expect(safetyStateMachine.state).toBe('IDLE');
  });

  it('E_STOP from ARMED → SAFE always allowed', () => {
    safetyStateMachine.transition('LOCK_STATE');
    safetyStateMachine.setConditions({
      linkStable: true, validationPassed: true, continuityOk: true, isDryRun: false,
    });
    safetyStateMachine.transition('ARM_SYSTEM');
    expect(safetyStateMachine.state).toBe('ARMED');
    const r = safetyStateMachine.transition('E_STOP');
    expect(r.allowed).toBe(true);
    expect(r.to).toBe('SAFE');
  });
});
