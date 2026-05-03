/**
 * ─── Real Operation Request ────────────────────────────────────────
 *
 * Single, audited entry point for switching `workMode` into
 * `real_operation`. It refuses unless the Phase 2 transition gate
 * granted authorisation in the recent past (default 5 min window).
 *
 * Design notes:
 *  - This module only READS the Phase 2 audit log + writes workMode.
 *    It does NOT mutate SSM, FieldBus, or CommandBus.
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

/** Default window: a Phase 2 grant counts as fresh for 5 minutes. */
export const DEFAULT_PHASE2_FRESHNESS_MS = 5 * 60 * 1000;

export type RealOperationRequestReason =
  | 'phase2-not-recently-authorised'
  | 'phase2-grant-stale';

export interface RealOperationRequestResult {
  ok: boolean;
  reason?: RealOperationRequestReason;
  /** The Phase 2 grant entry that authorised this request, if any. */
  grant?: Phase2AuditEntry;
  /** Age of the grant in ms when evaluated, if a grant existed. */
  grantAgeMs?: number;
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

  // Most-recent granted entry.
  const grant = log.find((e) => e.granted);
  if (!grant) {
    return { ok: false, reason: 'phase2-not-recently-authorised' };
  }

  const ts = Date.parse(grant.at);
  const age = Number.isFinite(ts) ? now - ts : Infinity;
  if (age > freshness) {
    return { ok: false, reason: 'phase2-grant-stale', grant, grantAgeMs: age };
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
  }
}
