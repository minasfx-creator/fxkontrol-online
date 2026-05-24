/**
 * Guardian tests — central AI guardrail (Fase 1, item C1+H3).
 * Garante que:
 *   1. Nomes de ação são normalizados (case + separadores) → impossível
 *      burlar com 'arm-system' / 'ARM_SYSTEM' / 'armSystem'.
 *   2. SSM bloqueia toda transition física quando caller='agent'.
 *   3. Caller 'system' (cooldown timer) e 'human' (UI) NÃO são bloqueados.
 *   4. JOI executor compartilha a mesma lista (sem divergência).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluate,
  isForbiddenForAgent,
  normalizeAction,
  listForbiddenActions,
} from '../aiGuardrail';
import { safetyStateMachine } from '../SafetyStateMachine';

describe('aiGuardrail — normalization', () => {
  it('normalizes case and separators consistently', () => {
    expect(normalizeAction('ARM_SYSTEM')).toBe('arm_system');
    expect(normalizeAction('arm-system')).toBe('arm_system');
    expect(normalizeAction('Arm System')).toBe('arm_system');
    expect(normalizeAction('fire-all')).toBe('fire_all');
  });

  it('blocks every variant of a forbidden action for agents', () => {
    for (const variant of ['arm', 'ARM', 'Arm', 'arm_system', 'arm-system', 'ARM_SYSTEM']) {
      expect(isForbiddenForAgent(variant)).toBe(true);
    }
  });

  it('does NOT block harmless actions', () => {
    expect(isForbiddenForAgent('add_position')).toBe(false);
    expect(isForbiddenForAgent('set_camera')).toBe(false);
    expect(isForbiddenForAgent('preview')).toBe(false);
  });
});

describe('aiGuardrail — caller policy', () => {
  it('agents cannot arm / fire / energize / change work mode', () => {
    expect(evaluate('arm_system', 'agent').allowed).toBe(false);
    expect(evaluate('fire', 'agent').allowed).toBe(false);
    expect(evaluate('energize', 'agent').allowed).toBe(false);
    expect(evaluate('set_work_mode', 'agent').allowed).toBe(false);
    expect(evaluate('e_stop', 'agent').allowed).toBe(false);
  });

  it('humans and system callers are always allowed', () => {
    for (const action of ['arm_system', 'fire', 'e_stop', 'send_dmx']) {
      expect(evaluate(action, 'human').allowed).toBe(true);
      expect(evaluate(action, 'system').allowed).toBe(true);
    }
  });

  it('exposes a stable forbidden list for audits', () => {
    const list = listForbiddenActions();
    expect(list).toContain('arm_system');
    expect(list).toContain('fire');
    expect(list).toContain('e_stop');
    expect(list).toContain('set_work_mode');
    // Sorted, deduped
    expect([...list].sort()).toEqual(list);
  });
});

describe('SafetyStateMachine — caller param honors guardrail', () => {
  beforeEach(() => {
    safetyStateMachine.reset();
    safetyStateMachine.setConditions({
      linkStable: true,
      validationPassed: true,
      isDryRun: false,
      continuityOk: true,
    });
  });

  it('blocks ARM_SYSTEM from agent caller even when SSM table would allow it', () => {
    safetyStateMachine.transition('LOCK_STATE'); // human
    expect(safetyStateMachine.state).toBe('LOCKED');

    const r = safetyStateMachine.transition('ARM_SYSTEM', { caller: 'agent' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/AI_BLOCKED/);
    expect(safetyStateMachine.state).toBe('LOCKED');
  });

  it('blocks E_STOP from agent — only humans/system can terminate', () => {
    const r = safetyStateMachine.transition('E_STOP', { caller: 'agent' });
    expect(r.allowed).toBe(false);
    expect(safetyStateMachine.state).toBe('IDLE');
  });

  it('allows the same transition from human caller', () => {
    safetyStateMachine.transition('LOCK_STATE');
    const r = safetyStateMachine.transition('ARM_SYSTEM', { caller: 'human' });
    expect(r.allowed).toBe(true);
    expect(safetyStateMachine.state).toBe('ARMED');
  });

  it('default caller (no opts) behaves as human (backward compat)', () => {
    safetyStateMachine.transition('LOCK_STATE');
    const r = safetyStateMachine.transition('ARM_SYSTEM');
    expect(r.allowed).toBe(true);
  });
});
