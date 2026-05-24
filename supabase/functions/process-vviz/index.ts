/**
 * process-vviz — Heavy VVIZ ingest with EdgeRuntime.waitUntil
 *
 * Flow:
 *  1. Auth check via shared `requireAuth` helper (JWT required).
 *  2. Parse & validate the request body (projectId + storagePath).
 *  3. Return HTTP 202 Accepted immediately (< 50 ms).
 *  4. Continue parsing + DB upsert in the background via EdgeRuntime.waitUntil
 *     so the function does NOT hit the 2 s CPU limit.
 *
 * Background task status is written to the `vviz_import_jobs` table so the
 * client can subscribe via Supabase Realtime for live progress.
 *
 * Environment variables required:
 *   SUPABASE_URL        — injected automatically by the runtime
 *   SUPABASE_ANON_KEY   — injected automatically by the runtime
 *   SUPABASE_SERVICE_ROLE_KEY — needed for privileged DB writes in background
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { jsonOk, jsonError } from "../_shared/response.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProcessVvizBody {
  /** UUID of the project to attach the parsed VVIZ data to. */
  projectId: string;
  /** Storage path inside the project's Supabase Storage bucket. */
  storagePath: string;
}

type ImportJobStatus = "queued" | "processing" | "done" | "failed";

// ── Background worker ─────────────────────────────────────────────────────────

/**
 * Runs inside `EdgeRuntime.waitUntil` — may exceed 2 s CPU without killing
 * the HTTP response. Uses the service-role key so it can bypass RLS for the
 * import-job status updates.
 */
async function runVvizImport(
  projectId: string,
  storagePath: string,
  userId: string,
  jobId: string,
): Promise<void> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  if (!serviceKey) {
    console.error("[process-vviz] SUPABASE_SERVICE_ROLE_KEY not set — cannot write job status.");
    return;
  }

  // Privileged client for background writes (bypasses RLS)
  const admin = createClient(supabaseUrl, serviceKey);

  const setStatus = async (status: ImportJobStatus, meta: Record<string, unknown> = {}) => {
    await admin
      .from("vviz_import_jobs")
      .update({ status, updated_at: new Date().toISOString(), ...meta })
      .eq("id", jobId);
  };

  try {
    await setStatus("processing");

    // ── Step 1: Download file from Supabase Storage ──────────────────────────
    console.log(`[process-vviz] Downloading storage object: ${storagePath}`);
    const { data: fileData, error: dlError } = await admin.storage
      .from("vviz-imports")
      .download(storagePath);

    if (dlError || !fileData) {
      throw new Error(`Storage download failed: ${dlError?.message ?? "empty blob"}`);
    }

    // ── Step 2: Parse the JSON archive ──────────────────────────────────────
    const text = await fileData.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("VVIZ file is not valid JSON.");
    }

    // Basic shape validation — a real implementation would call the full
    // validateVvizPayload() from src/modules/vviz (compiled to a shared bundle).
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("VVIZ root must be a JSON object.");
    }

    // ── Step 3: Upsert parsed payload into the database ───────────────────
    console.log(`[process-vviz] Upserting VVIZ payload for project ${projectId}…`);
    const { error: upsertError } = await admin
      .from("vviz_payloads")
      .upsert(
        {
          project_id: projectId,
          owner_id:   userId,
          storage_path: storagePath,
          payload:    parsed,
          parsed_at:  new Date().toISOString(),
        },
        { onConflict: "project_id" },
      );

    if (upsertError) {
      throw new Error(`DB upsert failed: ${upsertError.message}`);
    }

    await setStatus("done", { error_message: null });
    console.log(`[process-vviz] Job ${jobId} completed successfully.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[process-vviz] Job ${jobId} failed: ${message}`);
    await setStatus("failed", { error_message: message });
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  const preflight = handleCors(req);
  if (preflight) return preflight;

  // JWT auth — block unauthenticated callers before any CPU work
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { client, userId } = auth;

  // Parse request body
  let body: ProcessVvizBody;
  try {
    body = await req.json() as ProcessVvizBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const { projectId, storagePath } = body;
  if (!projectId || !storagePath) {
    return jsonError("projectId and storagePath are required", 400);
  }

  // Verify the caller owns the project (prevents IDOR)
  const { data: project, error: projError } = await client
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (projError || !project) {
    return jsonError("Project not found or access denied", 403);
  }

  // Create an import-job record — client polls/subscribes to this for progress
  const { data: job, error: jobError } = await client
    .from("vviz_import_jobs")
    .insert({
      project_id:   projectId,
      owner_id:     userId,
      storage_path: storagePath,
      status:       "queued" satisfies ImportJobStatus,
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return jsonError(`Failed to create import job: ${jobError?.message}`, 500);
  }

  // ── Fire-and-forget in background — returns HTTP 202 immediately ──────────
  // @ts-ignore — EdgeRuntime is injected globally by the Supabase Deno runtime.
  EdgeRuntime.waitUntil(runVvizImport(projectId, storagePath, userId, job.id));

  return new Response(
    JSON.stringify({
      status:  "processing",
      jobId:   job.id,
      message: "O arquivo VVIZ foi recebido e está sendo processado em background. Assine vviz_import_jobs via Realtime para acompanhar o progresso.",
    }),
    {
      status:  202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
