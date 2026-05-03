/**
 * ─── Real Operation Request ────────────────────────────────────────
 *
 * Single, audited entry point for switching `workMode` into
 * `real_operation`. It refuses unless ALL three layers agree:
 *
 *   1. Phase 2 transition gate granted authorisation in the recent
 *      past (default 5 min window).
 *   2. The Production Safety Oath passes — i.e. we are NOT a
 *      production build with the safety quarantine still active.
 *   3. (Optional) The current ShowPlan hash matches the hash that was
 *      carimbado on the Phase 2 grant. Plan drift between authorisation
 *      and execution refuses the transition.
 *
 * Design notes:
 *  - This module only READS the Phase 2 audit log + plan hash and
 *    writes workMode. It does NOT mutate SSM, FieldBus, CommandBus.
 *  - The Phase 2 audit log is itself produced by an explicit human
 *    Hold-to-Confirm in `Phase2TransitionPanel` (see
 *    src/lib/showSeeds/phase2Transition.ts). So a successful call
 *    here implies "operator authorised Phase 2 within the window".
 *  - Switching INTO design/simulation is unrestricted — those modes
 *    are non-physical by definition.
 */

import { workMode } from './workMode';
import {
  getPhase2AuditLog,
  type Phase2AuditEntry,
} from '@/lib/showSeeds/phase2Transition';
import {
  detectProductionOathInputs,
  evaluateProductionOath,
  type ProductionOathInputs,
  type ProductionOathReason,
} from './productionSafetyOath';

/** Default window: a Phase 2 grant counts as fresh for 5 minutes. */
export const DEFAULT_PHASE2_FRESHNESS_MS = 5 * 60 * 1000;

export type RealOperationRequestReason =
  | 'phase2-not-recently-authorised'
  | 'phase2-grant-stale'
  | 'production-oath-failed'
  | 'plan-hash-mismatch';

export interface RealOperationRequestResult {
  ok: boolean;
  reason?: RealOperationRequestReason;
  /** The Phase 2 grant entry that authorised this request, if any. */
  grant?: Phase2AuditEntry;
  /** Age of the grant in ms when evaluated, if a grant existed. */
  grantAgeMs?: number;
  /** Set when the production oath failed — sub-reason. */
  oathReason?: ProductionOathReason;
  /** Set when plan hashes were compared and disagreed. */
  expectedPlanHash?: string;
  actualPlanHash?: string;
}

export interface RealOperationRequestOpts {
  /** Override audit log source (tests). */
  audit?: () => Phase2AuditEntry[];
  /** Override clock (tests). */
  now?: () => number;
  /** Override freshness window. */
  freshnessMs?: number;
  /**
   * Override commit (tests). Default writes `workMode.set('real_operation')`.
   * Receives the granted entry for callers that want to log it elsewhere.
   */
  commit?: (grant: Phase2AuditEntry) => void;
  /** Override production-oath inputs (tests). */
  oath?: ProductionOathInputs;
  /**
   * Hash of the ShowPlan the caller is about to execute, if available.
   * When BOTH this AND `grant.planHash` are present, they MUST match
   * or the request is refused with `plan-hash-mismatch`.
   * Optional for backwards compatibility — Phase 2 grants written
   * before this field existed will simply skip the comparison.
   */
  currentPlanHash?: string;
}

/**
 * Request the transition to `real_operation`. Returns a structured
 * result; never throws.
 *
 * Caller MUST surface the failure reason to the operator (this module
 * never shows UI). On success, workMode has been switched and any
 * subscribers to `workMode` have been notified.
 */
export function requestRealOperation(
  opts: RealOperationRequestOpts = {},
): RealOperationRequestResult {
  const now = (opts.now ?? Date.now)();
  const freshness = opts.freshnessMs ?? DEFAULT_PHASE2_FRESHNESS_MS;
  const log = (opts.audit ?? getPhase2AuditLog)();

  // 0. Production Safety Oath — independent of every other gate.
  const oath = evaluateProductionOath(opts.oath ?? detectProductionOathInputs());
  if (!oath.ok) {
    return {
      ok: false,
      reason: 'production-oath-failed',
      oathReason: oath.reason,
    };
  }

  // 1. Most-recent granted entry.
  const grant = log.find((e) => e.granted);
  if (!grant) {
    return { ok: false, reason: 'phase2-not-recently-authorised' };
  }

  // 2. Freshness.
  const ts = Date.parse(grant.at);
  const age = Number.isFinite(ts) ? now - ts : Infinity;
  if (age > freshness) {
    return { ok: false, reason: 'phase2-grant-stale', grant, grantAgeMs: age };
  }

  // 3. Plan hash drift. Only enforced when BOTH sides supplied a hash;
  // otherwise we're talking to a legacy grant and skip the check.
  const expected = (grant as Phase2AuditEntry & { planHash?: string }).planHash;
  if (expected && opts.currentPlanHash && expected !== opts.currentPlanHash) {
    return {
      ok: false,
      reason: 'plan-hash-mismatch',
      grant,
      grantAgeMs: age,
      expectedPlanHash: expected,
      actualPlanHash: opts.currentPlanHash,
    };
  }

  const commit = opts.commit ?? ((_g: Phase2AuditEntry) => workMode.set('real_operation'));
  commit(grant);

  return { ok: true, grant, grantAgeMs: age };
}

/**
 * Switching back to design/simulation is always allowed. Provided
 * here so call sites have a single import surface.
 */
export function leaveRealOperation(target: 'design' | 'simulation' = 'simulation'): void {
  workMode.set(target);
}

export function explainRealOperationReason(r: RealOperationRequestReason): string {
  switch (r) {
    case 'phase2-not-recently-authorised':
      return 'Nenhuma autorização Phase 2 encontrada. Abra /dev/golden-shows e conclua o Hold-to-Confirm.';
    case 'phase2-grant-stale':
      return 'A autorização Phase 2 expirou (janela de 5 min). Reautorize antes de entrar em Operação Real.';
    case 'production-oath-failed':
      return 'Build de produção com a quarentena de segurança ainda ativa — transição recusada por contrato.';
    case 'plan-hash-mismatch':
      return 'O ShowPlan mudou desde a autorização Phase 2. Reautorize com o plano atual.';
  }
}
