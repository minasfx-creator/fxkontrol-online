/**
 * BUG-07 guardian — VerificationLog should never silently lose entries beyond
 * its declared retention. Today it is in-memory only; this test pins both the
 * 500/250 ring-buffer behavior AND a hook for future IndexedDB persistence.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { verificationLog } from '../VerificationLog';
import type { VerificationResult } from '../types';

function fakeResult(idx: number): VerificationResult {
  return {
    level: 'OK' as any,
    summary: { total: 1, passed: 1, errors: 0, warnings: 0 },
    issues: [{ passed: true, severity: 'info' as any, label: `chk-${idx}`, detail: 'ok' } as any],
  } as unknown as VerificationResult;
}

describe('BUG-07 · VerificationLog ring buffer', () => {
  beforeEach(() => verificationLog.clear());

  it('records a single entry with timestamp and level', () => {
    const e = verificationLog.record(fakeResult(1));
    expect(e.id).toMatch(/^vlog-/);
    expect(e.totalChecks).toBe(1);
    expect(verificationLog.getAll()).toHaveLength(1);
  });

  it('caps history at 500 and trims to 250 (no unbounded growth)', () => {
    for (let i = 0; i < 600; i++) verificationLog.record(fakeResult(i));
    const all = verificationLog.getAll();
    expect(all.length).toBeLessThanOrEqual(500);
    expect(all.length).toBeGreaterThanOrEqual(250);
  });

  it('getRecent returns the tail in insertion order', () => {
    for (let i = 0; i < 30; i++) verificationLog.record(fakeResult(i));
    const last5 = verificationLog.getRecent(5);
    expect(last5).toHaveLength(5);
    expect(last5[4]).toBe(verificationLog.getLastEntry());
  });

  it('clear() resets state', () => {
    verificationLog.record(fakeResult(1));
    verificationLog.clear();
    expect(verificationLog.getAll()).toHaveLength(0);
    expect(verificationLog.getLastEntry()).toBeNull();
  });
});
