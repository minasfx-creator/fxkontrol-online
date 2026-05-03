/**
 * Tests — Phase 2 Transition Gate.
 *
 * Pure unit tests with stubbed registry / SSM / readiness. Drives every
 * branch (each block reason in isolation, then the full happy path).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluatePhase2Gate,
  recordPhase2Transition,
  getPhase2AuditLog,
  clearPhase2AuditLog,
  explainPhase2Reason,
  type Phase2BlockReason,
} from '../phase2Transition';
import { GOLDEN_SHOW_CATALOG } from '../catalog';
import { ADAPTER_TRIAGE } from '@/core/hardware/adapterTriage';
import type { unifiedHardwareRegistry } from '@/core/hardware/UnifiedHardwareRegistry';
import type { ReadinessStatus } from '@/core/hardware/types';

type Registry = typeof unifiedHardwareRegistry;

function liveVerifiedRegistry(): Registry {
  const map = new Map<string, { integration_mode: string; evidence_level: string }>();
  for (const t of ADAPTER_TRIAGE) {
    map.set(t.id, {
      integration_mode: 'live_read_only',
      evidence_level: 'telemetry_verified',
    });
  }
  return {
    getAllProvenances: () => map as unknown as ReturnType<Registry['getAllProvenances']>,
  } as unknown as Registry;
}

function ssmIdle() { return { state: 'IDLE' as const }; }
function readinessHardwareSync() {
  return {
    evaluate: () => ({
      status: 'READY_FOR_HARDWARE_SYNC' as ReadinessStatus,
      mode: 'read-only-sync' as const,
      issues: [],
      warnings: [],
      allowed_operations: [],
      blocked_operations: [],
    }),
  };
}

function happyInputs() {
  return {
    registry: liveVerifiedRegistry(),
    ssm: ssmIdle(),
    readiness: readinessHardwareSync(),
    currentWorkMode: 'simulation' as const,
    operatorConfirmed: true,
  };
}

describe('phase2Transition · evaluatePhase2Gate', () => {
  beforeEach(() => clearPhase2AuditLog());

  it('grants when all six conditions hold', () => {
    const seed = GOLDEN_SHOW_CATALOG[0];
    const r = evaluatePhase2Gate(seed, happyInputs());
    expect(r.ok).toBe(true);
    expect(r.reasons).toEqual([]);
    expect(r.phase1.ok).toBe(true);
    expect(r.workMode).toBe('simulation');
    expect(r.safetyState).toBe('IDLE');
    expect(r.readinessStatus).toBe('READY_FOR_HARDWARE_SYNC');
    expect(r.unverifiedRequired).toEqual([]);
  });

  it('blocks when workMode is design', () => {
    const r = evaluatePhase2Gate(GOLDEN_SHOW_CATALOG[0], { ...happyInputs(), currentWorkMode: 'design' });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain<Phase2BlockReason>('workmode-not-simulation');
  });

  it('blocks when SSM is ARMED', () => {
    const r = evaluatePhase2Gate(GOLDEN_SHOW_CATALOG[0], { ...happyInputs(), ssm: { state: 'ARMED' as const } });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain<Phase2BlockReason>('safety-state-not-quiescent');
  });

  it('blocks when readiness is weaker than hardware-sync', () => {
    const r = evaluatePhase2Gate(GOLDEN_SHOW_CATALOG[0], {
      ...happyInputs(),
      readiness: {
        evaluate: () => ({
          status: 'READY_FOR_LIVE_READ_ONLY' as ReadinessStatus,
          mode: 'live-read-only' as const,
          issues: [], warnings: [], allowed_operations: [], blocked_operations: [],
        }),
      },
    });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain<Phase2BlockReason>('readiness-not-hardware-sync');
  });

  it('blocks when operator did not confirm', () => {
    const r = evaluatePhase2Gate(GOLDEN_SHOW_CATALOG[0], { ...happyInputs(), operatorConfirmed: false });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain<Phase2BlockReason>('operator-not-confirmed');
  });

  it('blocks when a required adapter is simulated', () => {
    const map = new Map<string, { integration_mode: string; evidence_level: string }>();
    for (const t of ADAPTER_TRIAGE) {
      map.set(t.id, {
        integration_mode: t.requiredForSync ? 'simulated' : 'live_read_only',
        evidence_level: 'telemetry_verified',
      });
    }
    const reg = {
      getAllProvenances: () => map as unknown as ReturnType<Registry['getAllProvenances']>,
    } as unknown as Registry;
    const r = evaluatePhase2Gate(GOLDEN_SHOW_CATALOG[0], { ...happyInputs(), registry: reg });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain<Phase2BlockReason>('unverified-required-adapter');
    expect(r.unverifiedRequired.length).toBeGreaterThan(0);
  });

  it('blocks when adapter evidence is only adapter_only', () => {
    const map = new Map<string, { integration_mode: string; evidence_level: string }>();
    for (const t of ADAPTER_TRIAGE) {
      map.set(t.id, { integration_mode: 'live_read_only', evidence_level: 'adapter_only' });
    }
    const reg = {
      getAllProvenances: () => map as unknown as ReturnType<Registry['getAllProvenances']>,
    } as unknown as Registry;
    const r = evaluatePhase2Gate(GOLDEN_SHOW_CATALOG[0], { ...happyInputs(), registry: reg });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain<Phase2BlockReason>('unverified-required-adapter');
  });

  it('aggregates multiple block reasons', () => {
    const r = evaluatePhase2Gate(GOLDEN_SHOW_CATALOG[0], {
      ...happyInputs(),
      currentWorkMode: 'design',
      operatorConfirmed: false,
      ssm: { state: 'FIRING' as const },
    });
    expect(r.ok).toBe(false);
    expect(r.reasons).toEqual(
      expect.arrayContaining<Phase2BlockReason>([
        'workmode-not-simulation',
        'safety-state-not-quiescent',
        'operator-not-confirmed',
      ]),
    );
  });
});

describe('phase2Transition · audit log', () => {
  beforeEach(() => clearPhase2AuditLog());

  it('persists granted entries with full snapshot', () => {
    const r = evaluatePhase2Gate(GOLDEN_SHOW_CATALOG[0], happyInputs());
    const e = recordPhase2Transition(r);
    expect(e.granted).toBe(true);
    expect(e.seedId).toBe(GOLDEN_SHOW_CATALOG[0].id);
    expect(getPhase2AuditLog()).toHaveLength(1);
  });

  it('persists denied entries with reasons', () => {
    const r = evaluatePhase2Gate(GOLDEN_SHOW_CATALOG[0], { ...happyInputs(), operatorConfirmed: false });
    recordPhase2Transition(r);
    const log = getPhase2AuditLog();
    expect(log[0].granted).toBe(false);
    expect(log[0].reasons).toContain('operator-not-confirmed');
  });

  it('caps the ring at 50', () => {
    for (let i = 0; i < 60; i++) {
      const r = evaluatePhase2Gate(GOLDEN_SHOW_CATALOG[0], { ...happyInputs(), operatorConfirmed: false });
      recordPhase2Transition(r);
    }
    expect(getPhase2AuditLog().length).toBe(50);
  });

  it('explainPhase2Reason returns non-empty for every reason', () => {
    const reasons: Phase2BlockReason[] = [
      'phase1-not-authorised',
      'workmode-not-simulation',
      'safety-state-not-quiescent',
      'readiness-not-hardware-sync',
      'unverified-required-adapter',
      'operator-not-confirmed',
    ];
    for (const r of reasons) expect(explainPhase2Reason(r).length).toBeGreaterThan(10);
  });
});
