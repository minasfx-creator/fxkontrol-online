/**
 * ─── Phase 1 Transition Gate ────────────────────────────────────────
 *
 * Pure, deterministic logic that decides whether a session may move
 * from Phase 0 (hardware pairing audit) into Phase 1 (golden show
 * validated end-to-end against the real Show3DEngine).
 *
 * Decision matrix:
 *
 *   1. The selected seed must `verificationEngine.run(seed)` to
 *      `READY_FOR_EXPORT` or stricter, with zero error-severity issues.
 *      → proves the show pipeline is canonical-clean.
 *
 *   2. `pendingRequiredAdapters(unifiedHardwareRegistry)` must return
 *      an empty array IN A REAL SESSION (i.e., reading the live
 *      registry — not a mock). This is the Phase 0 exit criterion.
 *      → proves required hardware is actually integrated (live).
 *
 *   3. `simulationDryRun(seed).cuesFired === seed.pyroCues.length`
 *      → proves the show plays end-to-end deterministically.
 *
 * If all three pass, the gate authorises the transition AND emits an
 * audit event into `localStorage` (capped ring buffer, GDPR-friendly:
 * no PII, only ids+timestamps+counters).
 *
 * Honesty:
 *   - NEVER calls FieldBus, CommandBus, SafetyStateMachine.
 *   - NEVER changes workMode.
 *   - Reads only from the registry; observes, does not mutate hardware.
 *   - The "real session" check IS the call site passing the live
 *     `unifiedHardwareRegistry` singleton — there is no mocking layer
 *     hidden inside this module.
 */

import type { ShowPlan } from '@/core/showplan/ShowPlan';
import { verificationEngine } from '@/core/verification/VerificationEngine';
import {
  pendingRequiredAdapters,
  type AdapterTriageEntry,
} from '@/core/hardware/adapterTriage';
import type { unifiedHardwareRegistry } from '@/core/hardware/UnifiedHardwareRegistry';
import { simulationDryRun } from './simulationDryRun';
import type { GoldenShowEntry } from './catalog';

export type Phase1BlockReason =
  | 'verification-not-ready'
  | 'verification-errors'
  | 'pending-required-adapters'
  | 'simulation-incomplete';

export interface Phase1GateResult {
  /** True iff the transition is authorised. */
  ok: boolean;
  /** Selected seed id (for the audit trail). */
  seedId: string;
  /** VerificationEngine level reached for this seed. */
  verificationLevel: string;
  /** Number of error-severity issues. */
  verificationErrors: number;
  /** Adapters still pending (Phase 0 exit criterion). */
  pending: AdapterTriageEntry[];
  /** Cues fired vs total in dry run. */
  cuesFired: number;
  totalCues: number;
  /** Block reasons; empty when ok=true. */
  reasons: Phase1BlockReason[];
  /** ISO timestamp the gate was evaluated. */
  evaluatedAt: string;
}

/**
 * Pure evaluation. No side-effects, no localStorage write — the audit
 * write happens explicitly via `recordPhase1Transition()`.
 *
 * @param entry  Golden seed catalog entry.
 * @param registry Live registry (pass `unifiedHardwareRegistry` for real
 *                 sessions; pass a mock in unit tests).
 */
export function evaluatePhase1Gate(
  entry: GoldenShowEntry,
  registry: typeof unifiedHardwareRegistry,
): Phase1GateResult {
  const sp: ShowPlan = entry.build();
  const v = verificationEngine.run(sp);
  const pending = pendingRequiredAdapters(registry);
  const dry = simulationDryRun(sp);
  const reasons: Phase1BlockReason[] = [];

  const verificationReady =
    v.level === 'READY_FOR_EXPORT' || v.level === 'READY_FOR_FIELD';
  if (!verificationReady) reasons.push('verification-not-ready');
  if (v.summary.errors > 0) reasons.push('verification-errors');
  if (pending.length > 0) reasons.push('pending-required-adapters');
  if (dry.cuesFired < sp.pyroCues.length) reasons.push('simulation-incomplete');

  return {
    ok: reasons.length === 0,
    seedId: entry.id,
    verificationLevel: v.level,
    verificationErrors: v.summary.errors,
    pending,
    cuesFired: dry.cuesFired,
    totalCues: sp.pyroCues.length,
    reasons,
    evaluatedAt: new Date().toISOString(),
  };
}

// ─── Audit trail (localStorage ring buffer) ─────────────────────────

const AUDIT_KEY = 'fxk.phase1.transitions.v1';
const AUDIT_CAP = 50;

export interface Phase1AuditEntry {
  /** Stable transition id (timestamp-derived, monotonic per session). */
  id: string;
  /** ISO timestamp. */
  at: string;
  /** Golden seed id. */
  seedId: string;
  /** Snapshot of the gate result at the moment of transition. */
  verificationLevel: string;
  verificationErrors: number;
  pendingIds: string[];
  cuesFired: number;
  totalCues: number;
  /** True iff the gate authorised the transition. */
  granted: boolean;
  /** Block reasons (empty for granted entries). */
  reasons: Phase1BlockReason[];
}

function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function getPhase1AuditLog(): Phase1AuditEntry[] {
  const s = safeStorage();
  if (!s) return [];
  try {
    const raw = s.getItem(AUDIT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is Phase1AuditEntry => {
      return !!e && typeof e === 'object' && typeof (e as Phase1AuditEntry).seedId === 'string';
    });
  } catch {
    return [];
  }
}

/**
 * Persist a transition (granted OR denied) for auditability. Returns the
 * created entry. Capped at AUDIT_CAP — oldest entries dropped first.
 */
export function recordPhase1Transition(result: Phase1GateResult): Phase1AuditEntry {
  const entry: Phase1AuditEntry = {
    id: `ph1-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: result.evaluatedAt,
    seedId: result.seedId,
    verificationLevel: result.verificationLevel,
    verificationErrors: result.verificationErrors,
    pendingIds: result.pending.map((p) => p.id),
    cuesFired: result.cuesFired,
    totalCues: result.totalCues,
    granted: result.ok,
    reasons: result.reasons,
  };
  const s = safeStorage();
  if (!s) return entry;
  try {
    const current = getPhase1AuditLog();
    const next = [entry, ...current].slice(0, AUDIT_CAP);
    s.setItem(AUDIT_KEY, JSON.stringify(next));
  } catch {
    // Storage may be full / blocked — non-fatal. Audit is best-effort.
  }
  return entry;
}

export function clearPhase1AuditLog(): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.removeItem(AUDIT_KEY);
  } catch {
    /* noop */
  }
}

/**
 * Human-readable explanation of a block reason — for UI tooltips.
 */
export function explainBlockReason(r: Phase1BlockReason): string {
  switch (r) {
    case 'verification-not-ready':
      return 'O VerificationEngine não atingiu READY_FOR_EXPORT/FIELD para este seed.';
    case 'verification-errors':
      return 'Existem issues de severity=error no VerificationEngine.';
    case 'pending-required-adapters':
      return 'Adapters obrigatórios ainda não integrados (critério de saída de Fase 0).';
    case 'simulation-incomplete':
      return 'O dry-run de simulação não disparou todos os cues.';
  }
}
