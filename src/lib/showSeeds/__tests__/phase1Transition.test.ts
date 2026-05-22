/**
 * Tests — Phase 1 Transition Gate.
 *
 * Pure unit tests against a stub registry that lets us script
 * `getAllProvenances()` to drive every branch of `pendingRequiredAdapters`.
 *
 * Audit storage is exercised via a fake `localStorage` in-memory shim.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluatePhase1Gate,
  recordPhase1Transition,
  getPhase1AuditLog,
  clearPhase1AuditLog,
  explainBlockReason,
  type Phase1BlockReason,
} from '../phase1Transition';
import { GOLDEN_SHOW_CATALOG } from '../catalog';
import { ADAPTER_TRIAGE } from '@/core/hardware/adapterTriage';
import type { unifiedHardwareRegistry } from '@/core/hardware/UnifiedHardwareRegistry';

type Registry = typeof unifiedHardwareRegistry;

/** Build a stub registry where every required adapter is integrated. */
function registryAllIntegrated(): Registry {
  const map = new Map<string, { integration_mode: string }>();
  for (const t of ADAPTER_TRIAGE) {
    map.set(t.id, { integration_mode: 'live_read_only' });
  }
  return {
    getAllProvenances: () => map as unknown as ReturnType<Registry['getAllProvenances']>,
  } as unknown as Registry;
}

/** Build a stub registry where ALL adapters are not_integrated. */
function registryAllPending(): Registry {
  const map = new Map<string, { integration_mode: string }>();
  for (const t of ADAPTER_TRIAGE) {
    map.set(t.id, { integration_mode: 'not_integrated' });
  }
  return {
    getAllProvenances: () => map as unknown as ReturnType<Registry['getAllProvenances']>,
  } as unknown as Registry;
}

describe('phase1Transition · evaluatePhase1Gate', () => {
  beforeEach(() => {
    clearPhase1AuditLog();
  });

  it('grants transition when registry has all required adapters integrated', () => {
    const seed = GOLDEN_SHOW_CATALOG[0];
    const r = evaluatePhase1Gate(seed, registryAllIntegrated());
    expect(r.ok).toBe(true);
    expect(r.pending).toEqual([]);
    expect(r.reasons).toEqual([]);
    expect(r.verificationErrors).toBe(0);
    expect(r.cuesFired).toBe(r.totalCues);
    expect(['READY_FOR_EXPORT', 'READY_FOR_FIELD']).toContain(r.verificationLevel);
  });

  it('blocks transition when required adapters are pending', () => {
    const seed = GOLDEN_SHOW_CATALOG[0];
    const r = evaluatePhase1Gate(seed, registryAllPending());
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain('pending-required-adapters');
    expect(r.pending.length).toBeGreaterThan(0);
    // Sanity: every pending entry must be a `requiredForSync` triage row.
    for (const p of r.pending) {
      expect(p.requiredForSync).toBe(true);
    }
  });

  it('handles every seed in the catalog (no seed is mis-shaped)', () => {
    const reg = registryAllIntegrated();
    for (const seed of GOLDEN_SHOW_CATALOG) {
      const r = evaluatePhase1Gate(seed, reg);
      expect(r.seedId).toBe(seed.id);
      expect(r.totalCues).toBeGreaterThan(0);
      expect(r.cuesFired).toBe(r.totalCues);
    }
  });

  it('evaluatedAt is a parseable ISO timestamp', () => {
    const r = evaluatePhase1Gate(GOLDEN_SHOW_CATALOG[0], registryAllIntegrated());
    expect(Number.isFinite(Date.parse(r.evaluatedAt))).toBe(true);
  });
});

describe('phase1Transition · audit log', () => {
  beforeEach(() => {
    clearPhase1AuditLog();
  });

  it('persists a granted transition into localStorage', () => {
    const r = evaluatePhase1Gate(GOLDEN_SHOW_CATALOG[0], registryAllIntegrated());
    const entry = recordPhase1Transition(r);
    expect(entry.granted).toBe(true);
    expect(entry.seedId).toBe(GOLDEN_SHOW_CATALOG[0].id);
    const log = getPhase1AuditLog();
    expect(log.length).toBe(1);
    expect(log[0].id).toBe(entry.id);
  });

  it('persists denied transitions too (block-reasons preserved)', () => {
    const r = evaluatePhase1Gate(GOLDEN_SHOW_CATALOG[0], registryAllPending());
    recordPhase1Transition(r);
    const log = getPhase1AuditLog();
    expect(log.length).toBe(1);
    expect(log[0].granted).toBe(false);
    expect(log[0].reasons).toContain('pending-required-adapters');
    expect(log[0].pendingIds.length).toBeGreaterThan(0);
  });

  it('caps audit log at 50 entries (oldest dropped)', () => {
    const reg = registryAllIntegrated();
    for (let i = 0; i < 55; i++) {
      const r = evaluatePhase1Gate(GOLDEN_SHOW_CATALOG[0], reg);
      recordPhase1Transition(r);
    }
    const log = getPhase1AuditLog();
    expect(log.length).toBe(50);
  });

  it('clearPhase1AuditLog wipes the buffer', () => {
    recordPhase1Transition(
      evaluatePhase1Gate(GOLDEN_SHOW_CATALOG[0], registryAllIntegrated()),
    );
    expect(getPhase1AuditLog().length).toBeGreaterThan(0);
    clearPhase1AuditLog();
    expect(getPhase1AuditLog().length).toBe(0);
  });

  it('explainBlockReason returns a non-empty PT-BR string for every reason', () => {
    const reasons: Phase1BlockReason[] = [
      'verification-not-ready',
      'verification-errors',
      'pending-required-adapters',
      'simulation-incomplete',
    ];
    for (const r of reasons) {
      const text = explainBlockReason(r);
      expect(text.length).toBeGreaterThan(10);
    }
  });
});
