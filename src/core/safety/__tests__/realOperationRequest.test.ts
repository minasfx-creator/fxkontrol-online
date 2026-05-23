/**
 * Tests — requestRealOperation gate.
 *
 * Pure unit tests with injected audit/now/commit. Does not touch the
 * real workMode singleton.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  requestRealOperation,
  DEFAULT_PHASE2_FRESHNESS_MS,
  explainRealOperationReason,
} from '../realOperationRequest';
import type { Phase2AuditEntry } from '@/lib/showSeeds/phase2Transition';

const NOW = 1_700_000_000_000;

function grant(atOffsetMs: number, granted = true): Phase2AuditEntry {
  return {
    id: `ph2-${atOffsetMs}`,
    at: new Date(NOW + atOffsetMs).toISOString(),
    seedId: 'libertadores',
    workMode: 'simulation',
    safetyState: 'IDLE',
    readinessStatus: 'READY_FOR_HARDWARE_SYNC',
    unverifiedRequired: [],
    phase1Granted: true,
    operatorConfirmed: true,
    granted,
    reasons: [],
  };
}

describe('requestRealOperation', () => {
  it('blocks when no audit entries exist', () => {
    const commit = vi.fn();
    const r = requestRealOperation({ audit: () => [], now: () => NOW, commit });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('phase2-not-recently-authorised');
    expect(commit).not.toHaveBeenCalled();
  });

  it('blocks when only denied entries exist', () => {
    const commit = vi.fn();
    const r = requestRealOperation({
      audit: () => [grant(0, false)],
      now: () => NOW,
      commit,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('phase2-not-recently-authorised');
    expect(commit).not.toHaveBeenCalled();
  });

  it('grants when a fresh granted entry exists', () => {
    const commit = vi.fn();
    const g = grant(-30_000); // 30s ago
    const r = requestRealOperation({
      audit: () => [g],
      now: () => NOW,
      commit,
    });
    expect(r.ok).toBe(true);
    expect(r.grant).toBe(g);
    expect(r.grantAgeMs).toBe(30_000);
    expect(commit).toHaveBeenCalledWith(g);
  });

  it('blocks when the most recent grant is older than the freshness window', () => {
    const commit = vi.fn();
    const stale = grant(-(DEFAULT_PHASE2_FRESHNESS_MS + 1_000));
    const r = requestRealOperation({
      audit: () => [stale],
      now: () => NOW,
      commit,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('phase2-grant-stale');
    expect(r.grant).toBe(stale);
    expect(commit).not.toHaveBeenCalled();
  });

  it('honours custom freshness window', () => {
    const commit = vi.fn();
    const g = grant(-10_000);
    const r = requestRealOperation({
      audit: () => [g],
      now: () => NOW,
      commit,
      freshnessMs: 5_000,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('phase2-grant-stale');
  });

  it('explainRealOperationReason returns non-empty for every reason', () => {
    expect(explainRealOperationReason('phase2-not-recently-authorised').length).toBeGreaterThan(10);
    expect(explainRealOperationReason('phase2-grant-stale').length).toBeGreaterThan(10);
  });
});
