/**
 * ─── Phase 2 Transition Gate ────────────────────────────────────────
 *
 * Pure, deterministic gate that decides whether a session may move
 * from Phase 1 (golden show validated end-to-end in simulation) into
 * Phase 2 (real_operation — physical hardware writes authorized).
 *
 * This is the strictest gate in the platform. It NEVER mutates
 * workMode, NEVER calls FieldBus / CommandBus / SafetyStateMachine.
 * It is a pure read across:
 *
 *   1. Phase 1 must currently authorise the same seed
 *      (`evaluatePhase1Gate(seed, registry).ok === true`).
 *      → proves the show pipeline + dry-run + adapter triage all pass.
 *
 *   2. workMode must be `simulation`. Transition can ONLY come from
 *      simulation — never from `design` (skipping QA) and never from
 *      `real_operation` (already there).
 *
 *   3. SafetyStateMachine must be in `IDLE` or `LOCKED`.
 *      ARMED / FIRING / COOLDOWN / SAFE are blocking states — the
 *      operator must reset to a quiescent state before transitioning.
 *
 *   4. ReadinessEvaluator must report `READY_FOR_HARDWARE_SYNC`.
 *      Anything weaker (LIVE_READ_ONLY / EXPORT / SIMULATION / BLOCKED)
 *      means hardware is not safely writable.
 *
 *   5. Every adapter required for sync must have a provenance whose
 *      `integration_mode` is `live_read_only` AND `evidence_level` is
 *      `telemetry_verified` or `operator_confirmed`. No `simulated`,
 *      no `replay`, no `not_integrated`, no `adapter_only` evidence.
 *
 *   6. The caller MUST pass `operatorConfirmed: true` — i.e. the
 *      Hold-to-Confirm completed AND the role check passed AT the call
 *      site. This module never trusts a "default true".
 *
 * Audit:
 *   recordPhase2Transition() persists granted+denied to a localStorage
 *   ring buffer (cap 50). Same shape/semantics as Phase 1 audit.
 *
 * Honesty:
 *   - Pure reads. No side effects beyond the explicit audit write.
 *   - No mocking layer hidden inside — the call site passes live
 *     singletons (registry, safetyStateMachine, readinessEvaluator).
 */

import { evaluatePhase1Gate, type Phase1GateResult } from './phase1Transition';
import { workMode, type WorkMode } from '@/core/safety/workMode';
import { ADAPTER_TRIAGE } from '@/core/hardware/adapterTriage';
import type { unifiedHardwareRegistry } from '@/core/hardware/UnifiedHardwareRegistry';
import type { safetyStateMachine } from '@/core/safety/SafetyStateMachine';
import type { readinessEvaluator } from '@/core/hardware/ReadinessEvaluator';
import type { GoldenShowEntry } from './catalog';
import type { ReadinessStatus } from '@/core/hardware/types';

export type Phase2BlockReason =
  | 'phase1-not-authorised'
  | 'workmode-not-simulation'
  | 'safety-state-not-quiescent'
  | 'readiness-not-hardware-sync'
  | 'unverified-required-adapter'
  | 'operator-not-confirmed';

export interface Phase2GateInputs {
  /** Live registry — `unifiedHardwareRegistry` in real sessions. */
  registry: typeof unifiedHardwareRegistry;
  /** Live SSM singleton — `safetyStateMachine` in real sessions. */
  ssm: Pick<typeof safetyStateMachine, 'state'>;
  /** Live readiness — `readinessEvaluator` in real sessions. */
  readiness: Pick<typeof readinessEvaluator, 'evaluate'>;
  /** Current workMode reading (defaults to live singleton). */
  currentWorkMode?: WorkMode;
  /**
   * MUST be `true`. The caller proves the operator finished the
   * Hold-to-Confirm and is authorised by role. False = blocked.
   */
  operatorConfirmed: boolean;
}

export interface Phase2GateResult {
  ok: boolean;
  seedId: string;
  phase1: Phase1GateResult;
  workMode: WorkMode;
  safetyState: string;
  readinessStatus: ReadinessStatus;
  /** Required-adapter ids whose provenance is not telemetry-verified. */
  unverifiedRequired: string[];
  operatorConfirmed: boolean;
  reasons: Phase2BlockReason[];
  evaluatedAt: string;
}

/** Pure evaluation — no side effects. */
export function evaluatePhase2Gate(
  entry: GoldenShowEntry,
  inputs: Phase2GateInputs,
): Phase2GateResult {
  const reasons: Phase2BlockReason[] = [];

  // 1. Phase 1 must authorise.
  const phase1 = evaluatePhase1Gate(entry, inputs.registry);
  if (!phase1.ok) reasons.push('phase1-not-authorised');

  // 2. workMode must be `simulation`.
  const wm = inputs.currentWorkMode ?? workMode.get();
  if (wm !== 'simulation') reasons.push('workmode-not-simulation');

  // 3. SSM must be quiescent.
  const ssmState = inputs.ssm.state;
  if (ssmState !== 'IDLE' && ssmState !== 'LOCKED') {
    reasons.push('safety-state-not-quiescent');
  }

  // 4. Readiness must be READY_FOR_HARDWARE_SYNC.
  const readiness = inputs.readiness.evaluate();
  if (readiness.status !== 'READY_FOR_HARDWARE_SYNC') {
    reasons.push('readiness-not-hardware-sync');
  }

  // 5. Every required adapter must be telemetry-verified live.
  const provenances = inputs.registry.getAllProvenances();
  const unverifiedRequired: string[] = [];
  for (const t of ADAPTER_TRIAGE) {
    if (!t.requiredForSync) continue;
    const prov = provenances.get(t.id);
    if (!prov) {
      unverifiedRequired.push(t.id);
      continue;
    }
    const liveOk = prov.integration_mode === 'live_read_only';
    const evidenceOk =
      prov.evidence_level === 'telemetry_verified' ||
      prov.evidence_level === 'operator_confirmed';
    if (!liveOk || !evidenceOk) unverifiedRequired.push(t.id);
  }
  if (unverifiedRequired.length > 0) reasons.push('unverified-required-adapter');

  // 6. Operator must have confirmed.
  if (!inputs.operatorConfirmed) reasons.push('operator-not-confirmed');

  return {
    ok: reasons.length === 0,
    seedId: entry.id,
    phase1,
    workMode: wm,
    safetyState: ssmState,
    readinessStatus: readiness.status,
    unverifiedRequired,
    operatorConfirmed: inputs.operatorConfirmed,
    reasons,
    evaluatedAt: new Date().toISOString(),
  };
}

// ─── Audit trail (localStorage ring buffer) ─────────────────────────

const AUDIT_KEY = 'fxk.phase2.transitions.v1';
const AUDIT_CAP = 50;

export interface Phase2AuditEntry {
  id: string;
  at: string;
  seedId: string;
  workMode: WorkMode;
  safetyState: string;
  readinessStatus: ReadinessStatus;
  unverifiedRequired: string[];
  phase1Granted: boolean;
  operatorConfirmed: boolean;
  granted: boolean;
  reasons: Phase2BlockReason[];
}

function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function getPhase2AuditLog(): Phase2AuditEntry[] {
  const s = safeStorage();
  if (!s) return [];
  try {
    const raw = s.getItem(AUDIT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is Phase2AuditEntry =>
        !!e && typeof e === 'object' && typeof (e as Phase2AuditEntry).seedId === 'string',
    );
  } catch {
    return [];
  }
}

export function recordPhase2Transition(result: Phase2GateResult): Phase2AuditEntry {
  const entry: Phase2AuditEntry = {
    id: `ph2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: result.evaluatedAt,
    seedId: result.seedId,
    workMode: result.workMode,
    safetyState: result.safetyState,
    readinessStatus: result.readinessStatus,
    unverifiedRequired: result.unverifiedRequired,
    phase1Granted: result.phase1.ok,
    operatorConfirmed: result.operatorConfirmed,
    granted: result.ok,
    reasons: result.reasons,
  };
  const s = safeStorage();
  if (!s) return entry;
  try {
    const current = getPhase2AuditLog();
    const next = [entry, ...current].slice(0, AUDIT_CAP);
    s.setItem(AUDIT_KEY, JSON.stringify(next));
  } catch {
    /* best-effort */
  }
  return entry;
}

export function clearPhase2AuditLog(): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.removeItem(AUDIT_KEY);
  } catch {
    /* noop */
  }
}

export function explainPhase2Reason(r: Phase2BlockReason): string {
  switch (r) {
    case 'phase1-not-authorised':
      return 'Fase 1 não autoriza este seed (verification, dry-run ou adapter triage falhou).';
    case 'workmode-not-simulation':
      return 'Transição para Fase 2 só é aceita a partir de workMode=simulation.';
    case 'safety-state-not-quiescent':
      return 'SafetyStateMachine precisa estar em IDLE ou LOCKED — reset antes de prosseguir.';
    case 'readiness-not-hardware-sync':
      return 'ReadinessEvaluator não reporta READY_FOR_HARDWARE_SYNC.';
    case 'unverified-required-adapter':
      return 'Algum adapter requerido ainda não está live com telemetria verificada.';
    case 'operator-not-confirmed':
      return 'Operador autorizado precisa concluir Hold-to-Confirm.';
  }
}
