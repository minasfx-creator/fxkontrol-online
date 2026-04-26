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

interface ReqBody {
  prompt?: string;
  imageDataUrl?: string;
  numDrones?: number;
  durationSeconds?: number;
  fps?: number;
  bounds?: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const XAI_API_KEY = Deno.env.get("XAI_API_KEY");
    if (!XAI_API_KEY) {
      return jsonError(500, "XAI_API_KEY is not configured");
    }

    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const numDrones = clampInt(body.numDrones ?? 500, 10, 5000);
    const duration = clampNum(body.durationSeconds ?? 60, 5, 600);
    const fps = clampInt(body.fps ?? 10, 5, 30);
    const userPrompt = (body.prompt ?? "").toString().slice(0, 2000);

    if (!body.imageDataUrl && !userPrompt) {
      return jsonError(400, "Provide at least 'imageDataUrl' or 'prompt'.");
    }

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

    const grokBody = {
      model: "grok-4",
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
    };

    const grokResp = await fetch(XAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(grokBody),
    });

    if (!grokResp.ok) {
      const txt = await grokResp.text();
      console.error("xAI error", grokResp.status, txt);
      if (grokResp.status === 429) return jsonError(429, "xAI rate limit reached. Try again shortly.");
      if (grokResp.status === 401) return jsonError(401, "Invalid XAI_API_KEY.");
      if (grokResp.status === 402) return jsonError(402, "xAI credits exhausted.");
      return jsonError(502, `xAI upstream error (${grokResp.status})`);
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

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(Number(n) || min)));
}
function clampNum(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number(n) || min));
}
