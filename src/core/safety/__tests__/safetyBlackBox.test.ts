import { describe, it, expect, beforeEach } from 'vitest';
import {
  safetyBlackBox,
  evaluateRealOperationVerdict,
  evaluatePyroDispatchVerdict,
  recordSafetyNote,
} from '../safetyBlackBox';
import { workMode } from '../workMode';
import {
  recordPhase2Transition,
  clearPhase2AuditLog,
  type Phase2GateResult,
} from '@/lib/showSeeds/phase2Transition';

function freshGrant(planHash?: string): Phase2GateResult {
  return {
    ok: true,
    seedId: 'seed-x',
    phase1: { ok: true } as any,
    workMode: 'simulation',
    safetyState: 'IDLE',
    readinessStatus: 'READY_FOR_HARDWARE_SYNC',
    unverifiedRequired: [],
    operatorConfirmed: true,
    reasons: [],
    evaluatedAt: new Date().toISOString(),
  };
}

describe('safetyBlackBox', () => {
  beforeEach(() => {
    safetyBlackBox.reset();
    clearPhase2AuditLog();
    workMode.set('simulation');
  });

  it('chains entries by hash starting from GENESIS', async () => {
    const e1 = await recordSafetyNote('first');
    const e2 = await recordSafetyNote('second');
    expect(e1.seq).toBe(1);
    expect(e1.prevHash).toBe('GENESIS');
    expect(e2.prevHash).toBe(e1.entryHash);
    expect(e2.seq).toBe(2);
  });

  it('verifyChain returns ok for an untouched chain', async () => {
    await recordSafetyNote('a');
    await recordSafetyNote('b');
    await recordSafetyNote('c');
    const v = await safetyBlackBox.verifyChain();
    expect(v.ok).toBe(true);
  });

  it('verifyChain detects tampering', async () => {
    await recordSafetyNote('a');
    await recordSafetyNote('b');
    const all = safetyBlackBox.getAll();
    // tamper with second entry's payload in-place via reset+rehydrate path
    (all[1].payload as any).msg = 'TAMPERED';
    // re-inject through internal array — simulate storage tamper:
    (safetyBlackBox as any)._entries = all;
    const v = await safetyBlackBox.verifyChain();
    expect(v.ok).toBe(false);
    expect(v.brokenAt).toBe(1);
  });

  it('records a granted real_operation request', async () => {
    recordPhase2Transition(freshGrant());
    const v = await evaluateRealOperationVerdict({ commit: () => {} });
    expect(v.ok).toBe(true);
    expect(v.entry.kind).toBe('real_operation_request');
    expect(v.entry.ok).toBe(true);
  });

  it('records a refused real_operation request with reason', async () => {
    const v = await evaluateRealOperationVerdict({ commit: () => {} });
    expect(v.ok).toBe(false);
    expect(v.entry.ok).toBe(false);
    expect(v.entry.reason).toBe('phase2-not-recently-authorised');
  });

  it('refuses pyro dispatch when only BLE is available in real_operation', async () => {
    const v = await evaluatePyroDispatchVerdict({
      available: ['webble'],
      mode: 'real_operation',
      cueId: 'cue-1',
    });
    expect(v.ok).toBe(false);
    expect(v.entry.reason).toBe('ble-banned-for-pyro');
    expect((v.entry.payload as any).banned).toContain('webble');
  });

  it('approves pyro dispatch on serial in real_operation', async () => {
    const v = await evaluatePyroDispatchVerdict({
      available: ['webserial', 'webble'],
      mode: 'real_operation',
    });
    expect(v.ok).toBe(true);
    expect((v.entry.payload as any).allowed).toEqual(['webserial']);
  });

  it('caps history at 500 entries', async () => {
    for (let i = 0; i < 510; i++) await recordSafetyNote('x' + i);
    expect(safetyBlackBox.getAll().length).toBe(500);
  });
});
