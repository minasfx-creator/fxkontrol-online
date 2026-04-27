/**
 * ─── Verification Report Bridge ───────────────────────────────────
 * Persists VerificationEngine results to public.executive_reports
 * when the operator commits a go/no-go decision (or when an exec
 * audit snapshot is requested).
 *
 * Called explicitly — NOT auto-invoked on every verificationEngine.run()
 * because run() is hit on every panel re-render and would flood the DB.
 *
 * Maps VerificationStatus → readiness_status / verification_level pair
 * understood by the executive_reports table.
 */
import { supabase } from '@/integrations/supabase/client';
import { useUIWorkspaceStore } from '@/stores/uiWorkspaceStore';
import type { VerificationResult, VerificationStatus } from '@/core/verification/types';

export interface RecordReportInput {
  showName: string;
  result: VerificationResult;
  /** Extra context to embed in report_data (operator notes, env, etc.). */
  context?: Record<string, unknown>;
}

type Readiness = 'READY' | 'BLOCKED' | 'WARNING' | 'UNKNOWN';
type VerifLevel = 'READY_FOR_SIMULATION' | 'READY_FOR_EXPORT' | 'READY_FOR_LIVE' | 'BLOCKED';

function mapReadiness(level: VerificationStatus, warnings: number): Readiness {
  if (level === 'BLOCKED') return 'BLOCKED';
  if (warnings > 0) return 'WARNING';
  return 'READY';
}

function mapLevel(level: VerificationStatus): VerifLevel {
  switch (level) {
    case 'BLOCKED': return 'BLOCKED';
    case 'READY_FOR_SIMULATION': return 'READY_FOR_SIMULATION';
    case 'READY_FOR_EXPORT': return 'READY_FOR_EXPORT';
    case 'READY_FOR_FIELD': return 'READY_FOR_LIVE';
    default: return 'BLOCKED';
  }
}

/**
 * Persist a verification snapshot. Returns the new row id, or null if
 * unauthenticated / persist failed (local mirror still updated).
 */
export async function recordVerificationReport(input: RecordReportInput): Promise<string | null> {
  const readiness = mapReadiness(input.result.level, input.result.summary.warnings);
  const level = mapLevel(input.result.level);

  const localId = `local-${Date.now()}`;
  // Always mirror locally so the in-app reports rail updates immediately.
  try {
    useUIWorkspaceStore.getState().addExecutiveReport({
      id: localId,
      showName: input.showName,
      readinessStatus: readiness,
    });
  } catch { /* never block on UI store */ }

  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch { /* skip */ }
  if (!userId) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase types stale until next regen
    const { data, error } = await (supabase.from('executive_reports' as any) as any)
      .insert({
        user_id: userId,
        show_name: input.showName,
        readiness_status: readiness,
        verification_level: level,
        report_data: {
          summary: input.result.summary,
          issues: input.result.issues,
          timestamp: input.result.timestamp,
          context: input.context ?? {},
        },
      })
      .select('id')
      .single();

    if (error || !data) {
      console.warn('[reportBridge] persist failed:', error?.message ?? 'no data');
      return null;
    }
    return String((data as { id: string }).id);
  } catch (e) {
    console.warn('[reportBridge] persist threw:', e);
    return null;
  }
}
