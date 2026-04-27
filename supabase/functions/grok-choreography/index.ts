/**
 * grok-choreography — xAI Grok vision → macro drone choreography (groups + keyframes).
 *
 * Hybrid scale strategy: the LLM only emits MACRO formations (≤50 groups, 20–60 keyframes),
 * client-side expander then interpolates into per-drone trajectories for up to 2000 drones.
 * This keeps token usage bounded and trajectories deterministic / collision-checked.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const XAI_URL = "https://api.x.ai/v1/chat/completions";

/**
 * ─── Aggregated counters (per-isolate, in-memory) ──────────────────────────
 * Survive across requests within the same edge-function instance. Reset on
 * cold start. Logged on every event (cumulative) and as a periodic snapshot
 * so success/failure rates can be tracked over time without external storage.
 *
 * Keys are intentionally low-cardinality:
 *   stage   — pipeline stage (size_guard, json_parse, schema, upstream, accepted, completed, config)
 *   outcome — accepted | rejected | upstream_ok | upstream_fail | completed | error
 *   status  — HTTP status code returned to the client (string for JSON-friendliness)
 *   reason  — short rejection reason code (header_oversize, validation_failed, …)
 */
const counters = {
  startedAt: new Date().toISOString(),
  total: 0,
  byOutcome: {} as Record<string, number>,
  byStatus: {} as Record<string, number>,
  byStageOutcome: {} as Record<string, number>, // `${stage}:${outcome}`
  byReason: {} as Record<string, number>,       // `${stage}:${reason}`
  byUpstreamModel: {} as Record<string, number>, // `${model}:${ok|fail}`
};

function bump(map: Record<string, number>, key: string, delta = 1) {
  map[key] = (map[key] ?? 0) + delta;
}

function counterSnapshot() {
  const accepted = counters.byOutcome["accepted"] ?? 0;
  const rejected = counters.byOutcome["rejected"] ?? 0;
  const completed = counters.byOutcome["completed"] ?? 0;
  const errored = counters.byOutcome["error"] ?? 0;
  const upstreamOk = counters.byOutcome["upstream_ok"] ?? 0;
  const upstreamFail = counters.byOutcome["upstream_fail"] ?? 0;
  const totalDecisions = accepted + rejected;
  const acceptRate = totalDecisions > 0 ? +(accepted / totalDecisions).toFixed(4) : null;
  const upstreamTotal = upstreamOk + upstreamFail;
  const upstreamSuccessRate = upstreamTotal > 0 ? +(upstreamOk / upstreamTotal).toFixed(4) : null;
  const completionRate = accepted > 0 ? +(completed / accepted).toFixed(4) : null;
  return {
    startedAt: counters.startedAt,
    total: counters.total,
    accepted,
    rejected,
    completed,
    errored,
    upstreamOk,
    upstreamFail,
    acceptRate,
    upstreamSuccessRate,
    completionRate,
    byOutcome: counters.byOutcome,
    byStatus: counters.byStatus,
    byStageOutcome: counters.byStageOutcome,
    byReason: counters.byReason,
    byUpstreamModel: counters.byUpstreamModel,
  };
}

// ─── Persistence to public.grok_choreography_metrics ────────────────────────
// Direct Postgres connection (Supabase pooler) — bypasses PostgREST and
// avoids the "JWT issued at future" clock-skew rejections we saw when using
// the service role key + REST. Fire-and-forget; never blocks the response.
const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL") ?? "";
const METRICS_TABLE = "grok_choreography_metrics";

type MetricRow = {
  event_type: "snapshot" | "decision";
  request_id?: string | null;
  stage?: string | null;
  outcome?: string | null;
  status?: number | null;
  reason?: string | null;
  model?: string | null;
  bytes?: number | null;
  duration_ms?: number | null;
  isolate_started_at?: string | null;
  counters: Record<string, unknown>;
};

let _pool: Pool | null = null;
function getPool(): Pool | null {
  if (_pool) return _pool;
  if (!SUPABASE_DB_URL) return null;
  // Small pool — most isolates do <10 inserts/min. lazy=true defers TCP setup.
  _pool = new Pool(SUPABASE_DB_URL, 2, true);
  return _pool;
}

async function persistMetricImpl(row: MetricRow): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.queryObject(
      `INSERT INTO public.${METRICS_TABLE}
        (event_type, request_id, stage, outcome, status, reason, model, bytes, duration_ms, isolate_started_at, counters)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
      [
        row.event_type,
        row.request_id ?? null,
        row.stage ?? null,
        row.outcome ?? null,
        row.status ?? null,
        row.reason ?? null,
        row.model ?? null,
        row.bytes ?? null,
        row.duration_ms ?? null,
        row.isolate_started_at ?? null,
        JSON.stringify(row.counters ?? {}),
      ],
    );
  } finally {
    client.release();
  }
}

function persistMetric(row: MetricRow) {
  const promise = persistMetricImpl(row).catch((e) => {
    console.warn(JSON.stringify({
      ts: new Date().toISOString(),
      level: "warn",
      fn: "grok-choreography",
      stage: "metrics_persist",
      outcome: "persist_failed",
      event_type: row.event_type,
      error: e instanceof Error ? e.message.slice(0, 300) : "unknown",
    }));
  });
  // Keep the isolate alive long enough to flush the insert when available.
  // @ts-ignore — EdgeRuntime is a Deno Deploy global, may be undefined locally.
  if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
    // @ts-ignore
    EdgeRuntime.waitUntil(promise);
  }
}

// Periodic snapshot — emits a single structured line every 60s if the isolate
// stays warm AND persists a snapshot row to the metrics table for trend analysis
// across cold starts. Idempotent: only the first request in a cold isolate arms it.
let _snapshotTimer: number | null = null;
function ensureSnapshotTimer() {
  if (_snapshotTimer !== null) return;
  _snapshotTimer = setInterval(() => {
    if (counters.total === 0) return;
    const snap = counterSnapshot();
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      fn: "grok-choreography",
      stage: "counters_snapshot",
      ...snap,
    }));
    persistMetric({
      event_type: "snapshot",
      stage: "counters_snapshot",
      isolate_started_at: counters.startedAt,
      counters: snap,
    });
  }, 60_000) as unknown as number;
}

const macroSchema = {
  type: "object",
  properties: {
    metadata: {
      type: "object",
      properties: {
        title: { type: "string" },
        num_drones: { type: "integer" },
        duration_seconds: { type: "number" },
        fps: { type: "integer" },
      },
      required: ["title", "num_drones", "duration_seconds", "fps"],
    },
    formations: {
      type: "array",
      description: "Macro keyframes — each lists groups of drones at a given timestamp.",
      items: {
        type: "object",
        properties: {
          timestamp: { type: "number" },
          name: { type: "string" },
          description: { type: "string" },
          groups: {
            type: "array",
            items: {
              type: "object",
              properties: {
                group_id: { type: "integer" },
                num_drones: { type: "integer" },
                shape: {
                  type: "string",
                  enum: ["circle", "sphere", "line", "grid", "heart", "spiral", "wave", "text", "logo", "custom"],
                },
                center: { type: "array", items: { type: "number" } },
                radius: { type: "number" },
                color: { type: "string", description: "Hex #RRGGBB" },
              },
              required: ["group_id", "num_drones", "shape", "center", "radius", "color"],
            },
          },
        },
        required: ["timestamp", "name", "groups"],
      },
    },
    transitions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          from_timestamp: { type: "number" },
          to_timestamp: { type: "number" },
          easing: { type: "string", enum: ["linear", "bezier", "spline", "ease-in-out"] },
          max_speed: { type: "number" },
        },
        required: ["from_timestamp", "to_timestamp", "easing", "max_speed"],
      },
    },
    safety: {
      type: "object",
      properties: {
        min_separation_m: { type: "number" },
        max_speed_ms: { type: "number" },
      },
    },
  },
  required: ["metadata", "formations"],
};

const SYSTEM_PROMPT = `Você é especialista em coreografia de shows de drones em escala massiva (até 5000 drones).
REGRAS ESTRITAS:
- Responda SOMENTE chamando a tool emit_macro_choreography. Sem texto livre.
- Divida o swarm em até 50 grupos lógicos. Cada grupo é uma forma básica.
- Gere entre 6 e 30 macro-keyframes (formations) ao longo da duração.
- Coordenadas em metros, frame XYZ: X→leste, Y→altura, Z→norte. Origem (0,0,0) no centro do palco.
- Bounding box padrão: X[-100,100], Y[10,150], Z[-100,100]. Y mínimo ≥ 10 m.
- Separação mínima entre drones: 2 m. Velocidade máxima: 8 m/s.
- Cores em hex #RRGGBB. Use a paleta da imagem/vídeo de referência quando possível.
- Extraia formas, contornos, cores e movimento do asset visual recebido.`;

import { z } from "https://esm.sh/zod@3.23.8";

// Hard limits — keep in sync with client-side guards (MAX_FILE_MB = 8).
const LIMITS = {
  promptMaxChars: 2000,
  imageDataUrlMaxBytes: 10 * 1024 * 1024, // ~10 MB raw string (≈7.5 MB binary after b64)
  numDrones: { min: 10, max: 5000 },
  durationSeconds: { min: 5, max: 600 },
  fps: { min: 5, max: 30 },
  bounds: { absMax: 1000 }, // m
} as const;

const boundsSchema = z
  .object({
    minX: z.number().finite().gte(-LIMITS.bounds.absMax).lte(LIMITS.bounds.absMax),
    maxX: z.number().finite().gte(-LIMITS.bounds.absMax).lte(LIMITS.bounds.absMax),
    minY: z.number().finite().gte(0).lte(LIMITS.bounds.absMax),
    maxY: z.number().finite().gte(0).lte(LIMITS.bounds.absMax),
    minZ: z.number().finite().gte(-LIMITS.bounds.absMax).lte(LIMITS.bounds.absMax),
    maxZ: z.number().finite().gte(-LIMITS.bounds.absMax).lte(LIMITS.bounds.absMax),
  })
  .refine((b) => b.maxX > b.minX && b.maxY > b.minY && b.maxZ > b.minZ, {
    message: "bounds: max must be greater than min on every axis",
  });

const reqSchema = z
  .object({
    prompt: z.string().trim().max(LIMITS.promptMaxChars).optional(),
    imageDataUrl: z
      .string()
      .max(LIMITS.imageDataUrlMaxBytes, {
        message: `imageDataUrl exceeds ${(LIMITS.imageDataUrlMaxBytes / 1024 / 1024).toFixed(0)} MB limit`,
      })
      .regex(/^data:(image|video)\/[a-zA-Z0-9.+-]+;base64,/, {
        message: "imageDataUrl must be a data: URL with image/* or video/* mime type",
      })
      .optional(),
    numDrones: z.number().int().min(LIMITS.numDrones.min).max(LIMITS.numDrones.max).optional(),
    durationSeconds: z.number().min(LIMITS.durationSeconds.min).max(LIMITS.durationSeconds.max).optional(),
    fps: z.number().int().min(LIMITS.fps.min).max(LIMITS.fps.max).optional(),
    bounds: boundsSchema.optional(),
  })
  .refine((v) => (v.prompt && v.prompt.length > 0) || !!v.imageDataUrl, {
    message: "Provide at least 'prompt' (non-empty) or 'imageDataUrl'.",
    path: ["prompt"],
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ─── Per-request correlation id (used in every log line + echoed to client) ───
  const requestId =
    req.headers.get("x-request-id") ||
    (typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);

  ensureSnapshotTimer();

  /**
   * Structured log helper. Always JSON, single line, no prompt/imageDataUrl content.
   * Stage = where in the pipeline the event happened (size_guard | json_parse | schema | upstream | …).
   * When `fields.outcome` / `fields.status` / `fields.reason` are present they also bump
   * aggregated counters and the cumulative snapshot is appended to every log line.
   */
  const log = (level: "info" | "warn" | "error", stage: string, fields: Record<string, unknown>) => {
    const outcome = typeof fields.outcome === "string" ? fields.outcome : undefined;
    const status = fields.status !== undefined ? String(fields.status) : undefined;
    const reason = typeof fields.reason === "string" ? fields.reason : undefined;
    const model = typeof fields.model === "string" ? fields.model : undefined;

    if (outcome) {
      counters.total += 1;
      bump(counters.byOutcome, outcome);
      bump(counters.byStageOutcome, `${stage}:${outcome}`);
      if (status) bump(counters.byStatus, status);
      if (reason) bump(counters.byReason, `${stage}:${reason}`);
      if (model && (outcome === "upstream_ok" || outcome === "upstream_fail")) {
        bump(counters.byUpstreamModel, `${model}:${outcome === "upstream_ok" ? "ok" : "fail"}`);
      }
    }

    const snap = outcome ? counterSnapshot() : undefined;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      fn: "grok-choreography",
      requestId,
      stage,
      ...fields,
      counters: snap,
    });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);

    // Persist terminal request decisions so trends survive cold starts.
    // Skip intermediate signals (upstream_ok/upstream_fail) — the request
    // still ends in `completed` or `error`, which we record below.
    if (snap && outcome && (outcome === "accepted" || outcome === "rejected" || outcome === "completed" || outcome === "error")) {
      const bytesField = typeof fields.bytes === "number" ? fields.bytes : null;
      const durationField = typeof fields.durationMs === "number" ? fields.durationMs : null;
      persistMetric({
        event_type: "decision",
        request_id: requestId,
        stage,
        outcome,
        status: status ? Number(status) : null,
        reason: reason ?? null,
        model: model ?? null,
        bytes: bytesField,
        duration_ms: durationField,
        isolate_started_at: counters.startedAt,
        counters: snap,
      });
    }
  };

  /** Strip values: keep only field names + counts + first error code per field. PII-safe. */
  const summarizeZodErrors = (flat: { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] }) => {
    const fieldShape: Record<string, { errorCount: number; firstCode: string }> = {};
    for (const [field, msgs] of Object.entries(flat.fieldErrors)) {
      if (!msgs || msgs.length === 0) continue;
      fieldShape[field] = { errorCount: msgs.length, firstCode: classifyZodMessage(msgs[0]) };
    }
    return {
      invalidFieldCount: Object.keys(fieldShape).length,
      formErrorCount: flat.formErrors.length,
      fields: fieldShape,
    };
  };

  try {
    const XAI_API_KEY = Deno.env.get("XAI_API_KEY");
    if (!XAI_API_KEY) {
      log("error", "config", { reason: "missing_xai_key", outcome: "error", status: 500 });
      return jsonError(500, "XAI_API_KEY is not configured", { requestId });
    }

    // Boot-time format pre-flight. xAI keys always start with `xai-` and are
    // long opaque strings. Reject obvious mis-pastes (Cursor `cu-…`, OpenAI
    // `sk-…`, raw secrets accidentally pasted from another vendor) BEFORE
    // burning a network round-trip — the upstream returns a generic 400
    // "Incorrect API key" body that's much harder to act on than a server-
    // side hint that names the actual problem.
    const trimmedKey = XAI_API_KEY.trim();
    const looksLikeXai = /^xai-[A-Za-z0-9_-]{20,}$/.test(trimmedKey);
    if (!looksLikeXai) {
      const prefix = trimmedKey.slice(0, 4) || "(empty)";
      log("error", "config", {
        reason: "key_format_invalid",
        prefix,
        length: trimmedKey.length,
        outcome: "error",
        status: 401,
      });
      return jsonError(
        401,
        `XAI_API_KEY format invalid (prefix "${prefix}"). xAI keys start with "xai-". ` +
          `Copy a fresh key from https://console.x.ai/team/default/api-keys and update the secret in Lovable Cloud → Backend → Secrets.`,
        { requestId },
      );
    }

    // 0. Hard payload size guard — reject oversize requests BEFORE buffering JSON.
    //    Server cap is slightly above the field-level imageDataUrl limit (10 MB)
    //    to allow JSON envelope overhead (keys, prompt text, base64 padding).
    const MAX_BODY_BYTES = 12 * 1024 * 1024; // 12 MB
    const MAX_BODY_HUMAN = `${(MAX_BODY_BYTES / 1024 / 1024).toFixed(0)} MB`;

    // 0a. Cheap header check — trust but verify.
    const declaredLen = req.headers.get("content-length");
    if (declaredLen !== null) {
      const n = Number(declaredLen);
      if (!Number.isFinite(n) || n < 0) {
        log("warn", "size_guard", { reason: "invalid_content_length", declared: declaredLen, outcome: "rejected", status: 400 });
        return jsonError(400, "Invalid Content-Length header.", { requestId });
      }
      if (n > MAX_BODY_BYTES) {
        log("warn", "size_guard", { reason: "header_oversize", declaredBytes: n, maxBytes: MAX_BODY_BYTES, outcome: "rejected", status: 413 });
        return jsonError(413, `Payload too large: ${n} bytes (max ${MAX_BODY_HUMAN}).`, { requestId });
      }
    }

    // 0b. Stream-and-count guard — clients can lie about Content-Length or omit it.
    if (!req.body) {
      log("warn", "size_guard", { reason: "empty_body", outcome: "rejected", status: 400 });
      return jsonError(400, "Empty request body.", { requestId });
    }
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          received += value.byteLength;
          if (received > MAX_BODY_BYTES) {
            try { await reader.cancel(); } catch { /* ignore */ }
            log("warn", "size_guard", { reason: "stream_oversize", receivedBytes: received, maxBytes: MAX_BODY_BYTES, outcome: "rejected", status: 413 });
            return jsonError(413, `Payload too large: exceeded ${MAX_BODY_HUMAN} while reading body.`, { requestId });
          }
          chunks.push(value);
        }
      }
    } catch (e) {
      log("warn", "size_guard", { reason: "body_read_failed", error: e instanceof Error ? e.message : "unknown", outcome: "rejected", status: 400 });
      return jsonError(400, `Failed to read request body: ${e instanceof Error ? e.message : "unknown"}`, { requestId });
    }

    // 1. Parse JSON safely
    let raw: unknown;
    try {
      const merged = new Uint8Array(received);
      let off = 0;
      for (const c of chunks) { merged.set(c, off); off += c.byteLength; }
      const text = new TextDecoder().decode(merged);
      raw = text.length === 0 ? {} : JSON.parse(text);
    } catch {
      log("warn", "json_parse", { reason: "invalid_json", bytes: received, outcome: "rejected", status: 400 });
      return jsonError(400, "Invalid JSON body.", { requestId });
    }

    // 2. Validate with zod (single source of truth for limits + messages)
    const parsed = reqSchema.safeParse(raw);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const summary = summarizeZodErrors(flat);
      log("warn", "schema", {
        reason: "validation_failed",
        bytes: received,
        ...summary,
        // Cardinality-only signals about the (rejected) payload — never the values.
        topLevelKeys: raw && typeof raw === "object" ? Object.keys(raw as Record<string, unknown>).slice(0, 20) : [],
        outcome: "rejected",
        status: 422,
      });
      const firstField = Object.entries(flat.fieldErrors)[0];
      const msg = firstField
        ? `${firstField[0]}: ${firstField[1]?.[0]}`
        : flat.formErrors[0] ?? "Invalid request payload";
      return jsonError(422, msg, { requestId, fieldErrors: flat.fieldErrors, formErrors: flat.formErrors });
    }

    const body = parsed.data;
    const numDrones = body.numDrones ?? 500;
    const duration = body.durationSeconds ?? 60;
    const fps = body.fps ?? 10;
    const userPrompt = body.prompt ?? "";

    log("info", "accepted", {
      bytes: received,
      numDrones,
      duration,
      fps,
      promptLen: userPrompt.length,
      hasImage: !!body.imageDataUrl,
      imageBytes: body.imageDataUrl?.length ?? 0,
      outcome: "accepted",
    });


    const userContent: Array<Record<string, unknown>> = [
      {
        type: "text",
        text:
          `Crie uma coreografia macro para ${numDrones} drones, duração ${duration}s, fps ${fps}.\n` +
          `Briefing do operador: ${userPrompt || "(sem briefing — extraia tudo do asset visual)"}\n` +
          `Use a tool emit_macro_choreography para responder.`,
      },
    ];
    if (body.imageDataUrl) {
      userContent.push({
        type: "image_url",
        image_url: { url: body.imageDataUrl },
      });
    }

    // Vision-capable Grok models, tried in order. If xAI deprecates one,
    // the next is attempted automatically. Keep most-preferred first.
    const MODEL_FALLBACKS = ["grok-4", "grok-4-fast", "grok-2-vision-latest"];

    const buildBody = (model: string) => ({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "emit_macro_choreography",
            description: "Emit the macro choreography JSON for the drone swarm.",
            parameters: macroSchema,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "emit_macro_choreography" } },
      temperature: 0.6,
      max_tokens: 8000,
    });

    let grokResp: Response | null = null;
    let lastErrTxt = "";
    let lastStatus = 0;
    let usedModel = "";

    for (const model of MODEL_FALLBACKS) {
      const resp = await fetch(XAI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${XAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildBody(model)),
      });

      if (resp.ok) {
        grokResp = resp;
        usedModel = model;
        log("info", "upstream", { model, status: resp.status, outcome: "upstream_ok" });
        break;
      }

      lastStatus = resp.status;
      lastErrTxt = await resp.text();
      console.error(`xAI error [model=${model}] ${resp.status}`, lastErrTxt);

      // xAI returns HTTP 400 with body "Incorrect API key provided" when the
      // key is wrong (instead of a proper 401). Promote to auth so the client
      // shows the actionable "update XAI_API_KEY" toast instead of a generic 502.
      const isAuthLike =
        resp.status === 401 ||
        /incorrect api key|invalid api key|api key.*invalid|unauthorized|authentication/i.test(lastErrTxt);
      const effectiveStatus = isAuthLike ? 401 : resp.status;

      log("warn", "upstream", {
        model,
        status: effectiveStatus,
        outcome: "upstream_fail",
        reason: effectiveStatus === 429 ? "rate_limit"
          : effectiveStatus === 401 ? "auth"
          : effectiveStatus === 402 ? "credits"
          : effectiveStatus === 404 ? "model_not_found"
          : "other",
      });

      // Auth/quota errors apply to all models — stop early, don't waste calls.
      if (isAuthLike || resp.status === 402 || resp.status === 429) {
        lastStatus = effectiveStatus;
        break;
      }

      // Only fall through on 400/404-style "model not found / unsupported" errors.
      const isModelIssue =
        resp.status === 404 ||
        /model.*not.*found|does not exist|unsupported|deprecat/i.test(lastErrTxt);
      if (!isModelIssue) break;
    }

    if (!grokResp) {
      const status = lastStatus === 429 ? 429 : lastStatus === 401 ? 401 : lastStatus === 402 ? 402 : 502;
      log("error", "upstream", { reason: "all_models_failed", lastStatus, outcome: "error", status });
      if (lastStatus === 429) return jsonError(429, "xAI rate limit reached. Try again shortly.");
      if (lastStatus === 401) return jsonError(401, "Invalid XAI_API_KEY — update the secret in Lovable Cloud → Backend → Secrets.");
      if (lastStatus === 402) return jsonError(402, "xAI credits exhausted — top up your xAI account.");
      return jsonError(502, `xAI upstream error (${lastStatus}) — all fallback models failed.`);
    }

    const grokJson = await grokResp.json();
    const toolCall = grokJson?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    if (!argsStr) {
      log("error", "upstream", { reason: "no_tool_call", model: usedModel, outcome: "error", status: 502 });
      return jsonError(502, "xAI did not return a structured tool call.");
    }
    let macro: unknown;
    try {
      macro = JSON.parse(argsStr);
    } catch (e) {
      log("error", "upstream", { reason: "tool_args_invalid_json", model: usedModel, outcome: "error", status: 502 });
      return jsonError(502, "xAI tool arguments not valid JSON.");
    }

    log("info", "completed", {
      model: usedModel,
      promptTokens: grokJson?.usage?.prompt_tokens ?? null,
      completionTokens: grokJson?.usage?.completion_tokens ?? null,
      outcome: "completed",
      status: 200,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        macro,
        model: usedModel,
        usage: grokJson?.usage ?? null,
        echo: { numDrones, duration, fps },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("grok-choreography error", e);
    log("error", "exception", { error: e instanceof Error ? e.message : "unknown", outcome: "error", status: 500 });
    return jsonError(500, e instanceof Error ? e.message : "Unknown error");
  }
});

function jsonError(status: number, message: string, details?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ ok: false, error: message, ...(details ? { details } : {}) }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/**
 * Map a zod error message to a low-cardinality code so logs can be aggregated.
 * Pattern-only — never includes user values.
 */
function classifyZodMessage(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("required")) return "required";
  if (m.includes("greater than or equal") || m.includes("at least")) return "min";
  if (m.includes("less than or equal") || m.includes("at most")) return "max";
  if (m.includes("integer")) return "not_integer";
  if (m.includes("finite")) return "not_finite";
  if (m.includes("regex") || m.includes("invalid string") || m.includes("must be a data:")) return "regex";
  if (m.includes("exceeds") || m.includes("too long") || m.includes("too_big")) return "too_big";
  if (m.includes("provide at least")) return "missing_one_of";
  if (m.includes("max must be greater than min")) return "bounds_inverted";
  return "other";
}
