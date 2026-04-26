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

const XAI_URL = "https://api.x.ai/v1/chat/completions";

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

  try {
    const XAI_API_KEY = Deno.env.get("XAI_API_KEY");
    if (!XAI_API_KEY) {
      return jsonError(500, "XAI_API_KEY is not configured");
    }

    // 1. Parse JSON safely
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body.");
    }

    // 2. Validate with zod (single source of truth for limits + messages)
    const parsed = reqSchema.safeParse(raw);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const firstField = Object.entries(flat.fieldErrors)[0];
      const msg = firstField
        ? `${firstField[0]}: ${firstField[1]?.[0]}`
        : flat.formErrors[0] ?? "Invalid request payload";
      return jsonError(422, msg, { fieldErrors: flat.fieldErrors, formErrors: flat.formErrors });
    }

    const body = parsed.data;
    const numDrones = body.numDrones ?? 500;
    const duration = body.durationSeconds ?? 60;
    const fps = body.fps ?? 10;
    const userPrompt = body.prompt ?? "";


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
        break;
      }

      lastStatus = resp.status;
      lastErrTxt = await resp.text();
      console.error(`xAI error [model=${model}] ${resp.status}`, lastErrTxt);

      // Auth/quota errors apply to all models — stop early, don't waste calls.
      if (resp.status === 401 || resp.status === 402 || resp.status === 429) break;

      // Only fall through on 400/404-style "model not found / unsupported" errors.
      const isModelIssue =
        resp.status === 404 ||
        /model.*not.*found|does not exist|unsupported|deprecat/i.test(lastErrTxt);
      if (!isModelIssue) break;
    }

    if (!grokResp) {
      if (lastStatus === 429) return jsonError(429, "xAI rate limit reached. Try again shortly.");
      if (lastStatus === 401) return jsonError(401, "Invalid XAI_API_KEY.");
      if (lastStatus === 402) return jsonError(402, "xAI credits exhausted.");
      return jsonError(502, `xAI upstream error (${lastStatus}) — all fallback models failed.`);
    }

    const grokJson = await grokResp.json();
    const toolCall = grokJson?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    if (!argsStr) {
      return jsonError(502, "xAI did not return a structured tool call.");
    }
    let macro: unknown;
    try {
      macro = JSON.parse(argsStr);
    } catch (e) {
      return jsonError(502, "xAI tool arguments not valid JSON.");
    }

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
    return jsonError(500, e instanceof Error ? e.message : "Unknown error");
  }
});

function jsonError(status: number, message: string, details?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ ok: false, error: message, ...(details ? { details } : {}) }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
