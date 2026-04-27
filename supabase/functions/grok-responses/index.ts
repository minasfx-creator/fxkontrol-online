/**
 * grok-responses — Wrapper around xAI's `/v1/responses` endpoint for the
 * `grok-4.20-reasoning` model (and any future reasoning-tier sibling).
 *
 * Why a separate function from `grok-choreography`:
 *   - Different endpoint shape (`/v1/responses` !== `/v1/chat/completions`).
 *   - No tool-call schema — reasoning models return free-form text + a
 *     surfaced reasoning trace.
 *   - Keeps the choreography fallback chain (grok-4 → grok-4-fast → grok-2-vision)
 *     untouched and green.
 *
 * Contract:
 *   POST { input: string, system?: string, model?: string,
 *          reasoning?: { effort: "low"|"medium"|"high" },
 *          maxOutputTokens?: number, temperature?: number }
 *   →
 *   200 { ok:true, text, reasoning?, model, usage, requestId }
 *   4xx/5xx { ok:false, error, reason?, hint? }
 *
 * Failure modes mirror `xai-key-health` / `grok-choreography` so the existing
 * "Diagnosticar chave" CTA in the AI Choreography page keeps working.
 */
import { z } from "https://esm.sh/zod@3.23.8";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { jsonOk, jsonError } from "../_shared/response.ts";

// ─── Telemetry persistence ────────────────────────────────────────────────
// Mirrors the fire-and-forget pattern from grok-choreography. Every request —
// success OR failure — produces exactly one row in public.grok_choreography_metrics
// so the AI usage dashboard never sees null outcomes for client-initiated calls.
// Direct DB connection (not PostgREST) avoids JWT clock-skew issues.
const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL") ?? "";
let _pool: Pool | null = null;
function getPool(): Pool | null {
  if (_pool) return _pool;
  if (!SUPABASE_DB_URL) return null;
  _pool = new Pool(SUPABASE_DB_URL, 2, true);
  return _pool;
}

interface MetricRow {
  outcome: "success" | "error" | "timeout" | "refused" | "rate_limit" | "credits";
  reason?: string | null;
  status?: number | null;
  model?: string | null;
  duration_ms?: number | null;
  request_id?: string | null;
  bytes?: number | null;
}

async function persistMetricImpl(row: MetricRow): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.queryObject(
      `INSERT INTO public.grok_choreography_metrics
        (event_type, request_id, stage, outcome, status, reason, model, bytes, duration_ms, counters)
       VALUES ('decision', $1, 'responses', $2, $3, $4, $5, $6, $7, '{}'::jsonb)`,
      [
        row.request_id ?? null,
        row.outcome,
        row.status ?? null,
        row.reason ?? null,
        row.model ?? null,
        row.bytes ?? null,
        row.duration_ms ?? null,
      ],
    );
  } finally {
    client.release();
  }
}

function persistMetric(row: MetricRow): void {
  const promise = persistMetricImpl(row).catch((e) => {
    console.warn(JSON.stringify({
      ts: new Date().toISOString(),
      level: "warn",
      fn: "grok-responses",
      stage: "metrics_persist",
      outcome: "persist_failed",
      error: e instanceof Error ? e.message.slice(0, 300) : "unknown",
    }));
  });
  // @ts-ignore — EdgeRuntime is a Deno Deploy global
  if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
    // @ts-ignore
    EdgeRuntime.waitUntil(promise);
  }
}

const XAI_RESPONSES_URL = "https://api.x.ai/v1/responses";
const DEFAULT_MODEL = "grok-4.20-reasoning";
// Single-step fallback: if the preview model is rejected with 404/model_not_found,
// the wrapper retries once with stable grok-4 so callers get *something* useful
// instead of a cryptic upstream error during xAI's preview rollout.
const FALLBACK_MODEL = "grok-4";

const RequestSchema = z.object({
  input: z.string().trim().min(1, "input is required").max(8000, "input too long (max 8000 chars)"),
  system: z.string().trim().max(4000).optional(),
  model: z.string().trim().min(3).max(64).optional(),
  reasoning: z
    .object({ effort: z.enum(["low", "medium", "high"]).optional() })
    .optional(),
  maxOutputTokens: z.number().int().min(64).max(16000).optional(),
  temperature: z.number().min(0).max(2).optional(),
});

interface XaiResponsePayload {
  id?: string;
  model?: string;
  // xAI mirrors the OpenAI Responses API; the canonical convenience field is
  // `output_text`, but defensive code also walks `output[].content[]`.
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  reasoning?: { content?: string } | string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    reasoning_tokens?: number;
  };
}

function extractText(payload: XaiResponsePayload): string {
  if (typeof payload.output_text === "string" && payload.output_text.length > 0) {
    return payload.output_text;
  }
  // Fallback: walk output[].content[].text
  if (Array.isArray(payload.output)) {
    const chunks: string[] = [];
    for (const item of payload.output) {
      if (!item.content) continue;
      for (const c of item.content) {
        if (typeof c.text === "string") chunks.push(c.text);
      }
    }
    if (chunks.length > 0) return chunks.join("\n");
  }
  return "";
}

function extractReasoning(payload: XaiResponsePayload): string | undefined {
  if (typeof payload.reasoning === "string") return payload.reasoning;
  if (payload.reasoning && typeof payload.reasoning.content === "string") {
    return payload.reasoning.content;
  }
  return undefined;
}

function callUpstream(
  apiKey: string,
  model: string,
  body: z.infer<typeof RequestSchema>,
  signal: AbortSignal,
): Promise<Response> {
  const upstreamBody: Record<string, unknown> = {
    model,
    input: body.input,
    max_output_tokens: body.maxOutputTokens ?? 4000,
    temperature: body.temperature ?? 0.4,
  };
  if (body.system) upstreamBody.instructions = body.system;
  if (body.reasoning?.effort) upstreamBody.reasoning = { effort: body.reasoning.effort };

  return fetch(XAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(upstreamBody),
    signal,
  });
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonError("Method not allowed. Use POST.", 405);
  }

  // ── Key guards (same shape as xai-key-health for consistent UX) ──
  const rawKey = Deno.env.get("XAI_API_KEY");
  if (!rawKey) {
    return jsonError(
      "XAI_API_KEY is not configured — set it in Lovable Cloud → Backend → Secrets.",
      500,
      { reason: "key_missing" },
    );
  }
  const apiKey = rawKey.trim();
  if (!/^xai-[A-Za-z0-9_-]{20,}$/.test(apiKey)) {
    return jsonError(
      'Invalid XAI_API_KEY format (must start with "xai-"). Update the secret in Lovable Cloud → Backend → Secrets.',
      401,
      { reason: "key_format_invalid" },
    );
  }

  // ── Body validation ──
  let parsedBody: z.infer<typeof RequestSchema>;
  try {
    const raw = await req.json();
    const parsed = RequestSchema.safeParse(raw);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const firstField = Object.values(flat.fieldErrors)[0]?.[0];
      const firstForm = flat.formErrors[0];
      return jsonError(firstField ?? firstForm ?? "Invalid request body", 400, {
        reason: "validation",
        fieldErrors: flat.fieldErrors,
      });
    }
    parsedBody = parsed.data;
  } catch (err) {
    return jsonError(`Invalid JSON body: ${err instanceof Error ? err.message : String(err)}`, 400, {
      reason: "invalid_json",
    });
  }

  const requestedModel = parsedBody.model ?? DEFAULT_MODEL;

  // ── 60s overall timeout (reasoning models are slow) ──
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  const startedAt = Date.now();

  const tryModel = async (model: string): Promise<Response> => {
    return callUpstream(apiKey, model, parsedBody, controller.signal);
  };

  let resp: Response;
  let usedModel = requestedModel;
  try {
    resp = await tryModel(requestedModel);
    if (!resp.ok && (resp.status === 404 || resp.status === 400) && requestedModel !== FALLBACK_MODEL) {
      const errBody = await resp.text();
      // Only fall through on "model not found / unsupported" — auth/quota
      // errors stay sticky.
      if (/model.*not.*found|does not exist|unsupported|deprecat/i.test(errBody)) {
        console.warn(`[grok-responses] ${requestedModel} rejected (${resp.status}); falling back to ${FALLBACK_MODEL}`);
        resp = await tryModel(FALLBACK_MODEL);
        usedModel = FALLBACK_MODEL;
      } else {
        // Re-wrap so downstream code sees a Response with the body
        resp = new Response(errBody, { status: resp.status });
      }
    }
  } catch (err) {
    clearTimeout(timer);
    const aborted = err instanceof Error && err.name === "AbortError";
    return jsonError(
      aborted ? "xAI request timed out (60s)." : `Network error reaching xAI: ${err instanceof Error ? err.message : String(err)}`,
      aborted ? 504 : 502,
      { reason: aborted ? "timeout" : "network_error" },
    );
  }
  clearTimeout(timer);

  if (!resp.ok) {
    const errText = await resp.text();
    const isAuth =
      resp.status === 401 ||
      resp.status === 403 ||
      /incorrect api key|invalid api key|api key.*invalid|unauthorized|authentication/i.test(errText);
    const reason =
      isAuth ? "auth" :
      resp.status === 429 ? "rate_limit" :
      resp.status === 402 ? "credits" :
      resp.status === 404 ? "model_not_found" :
      "upstream_error";
    const hint =
      reason === "auth"
        ? "xAI rejected the key. Verify it at https://console.x.ai/team/default/api-keys and check workspace credits."
        : reason === "rate_limit"
        ? "Rate limited by xAI. Wait a moment and try again."
        : reason === "credits"
        ? "xAI workspace is out of credits. Top up at https://console.x.ai/."
        : reason === "model_not_found"
        ? `Model ${usedModel} is not available on this xAI workspace. Try grok-4 or contact xAI for preview access.`
        : `Upstream returned ${resp.status}.`;

    console.error(`[grok-responses] upstream ${resp.status} model=${usedModel}:`, errText.slice(0, 400));
    return jsonError(`xAI ${reason} (${resp.status}): ${errText.slice(0, 200)}`, resp.status >= 500 ? 502 : resp.status, {
      reason,
      hint,
      model: usedModel,
    });
  }

  let payload: XaiResponsePayload;
  try {
    payload = await resp.json();
  } catch (err) {
    return jsonError(`Failed to parse xAI response: ${err instanceof Error ? err.message : String(err)}`, 502, {
      reason: "parse_error",
    });
  }

  const text = extractText(payload);
  if (!text) {
    return jsonError("xAI returned an empty response.", 502, { reason: "empty_response", model: usedModel });
  }

  return jsonOk({
    ok: true,
    text,
    reasoning: extractReasoning(payload),
    model: payload.model ?? usedModel,
    usage: payload.usage ?? {},
    requestId: payload.id ?? null,
    durationMs: Date.now() - startedAt,
  });
});
