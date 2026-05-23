/**
 * Guardian — Cooldown timer cleanup (Fase 1, item C2).
 * Garante que transitions saindo de COOLDOWN ou ARMED (que não sejam
 * o re-entry COOLDOWN) limpam qualquer timer pendente, mantendo o SSM
 * determinístico.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { safetyStateMachine } from '../SafetyStateMachine';

describe('SafetyStateMachine — cooldown cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    safetyStateMachine.reset();
    safetyStateMachine.setConditions({
      linkStable: true,
      validationPassed: true,
      isDryRun: false,
      continuityOk: true,
    });
    // IDLE → LOCKED → ARMED → FIRING → COOLDOWN
    safetyStateMachine.transition('LOCK_STATE');
    safetyStateMachine.transition('ARM_SYSTEM');
    safetyStateMachine.transition('FIRE');
    safetyStateMachine.transition('FIRE_COMPLETE');
    expect(safetyStateMachine.state).toBe('COOLDOWN');
  });

  afterEach(() => {
    vi.useRealTimers();
    safetyStateMachine.reset();
  });

  it('E_STOP during cooldown clears timer (no spurious COOLDOWN_COMPLETE)', () => {
    safetyStateMachine.transition('E_STOP');
    expect(safetyStateMachine.state).toBe('SAFE');
    vi.advanceTimersByTime(5000);
    expect(safetyStateMachine.state).toBe('SAFE');
  });

  it('reset() clears pending cooldown', () => {
    safetyStateMachine.reset();
    expect(safetyStateMachine.state).toBe('IDLE');
    vi.advanceTimersByTime(5000);
    expect(safetyStateMachine.state).toBe('IDLE');
  });

  it('natural cooldown still completes when no interrupt happens', () => {
    vi.advanceTimersByTime(2100);
    expect(safetyStateMachine.state).toBe('ARMED');
  });
});
