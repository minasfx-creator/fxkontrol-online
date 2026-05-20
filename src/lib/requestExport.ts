import { supabase } from "@/integrations/supabase/client";

export type ExportKind = "fir" | "mavlink" | "skyc" | "vviz" | "csv" | "blackbox";

export interface ExportResult {
  ok: boolean;
  jobId?: string;
  error?: string;
  paywall?: boolean;
}

/**
 * Server-side gate for premium exports. The edge function
 * `request-export` (1) verifies entitlement, (2) inserts an export_jobs
 * row (RLS double-checks), (3) returns 402 if denied.
 *
 * Call this BEFORE generating the actual file in the browser. If it
 * returns `ok=false` with `paywall=true`, do not generate the artifact —
 * the user has not paid for this capability.
 */
export async function requestExport(kind: ExportKind, bytes?: number): Promise<ExportResult> {
  const { data, error } = await supabase.functions.invoke("request-export", {
    body: { kind, bytes },
  });

  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 402) {
      return { ok: false, paywall: true, error: "Plano insuficiente para esta exportação." };
    }
    return { ok: false, error: error.message ?? "request-export failed" };
  }

  if (!data?.ok) {
    return { ok: false, error: data?.error ?? "Unknown error" };
  }
  return { ok: true, jobId: data.job?.id };
}
