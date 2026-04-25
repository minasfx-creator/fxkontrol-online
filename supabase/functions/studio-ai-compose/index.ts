// Studio AI Compose — natural language prompt → ShowPlan (positions + timeline)
//
// Single LLM call with tool calling. Returns a strictly typed plan that the
// client applies directly to useProjectStore (no diff/preview UI).
//
// Output is intent only: client-side SafetyGate validates before persisting.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT = `You are the FX KONTROL Studio AI composer.

Given a designer's natural-language brief, you compose a complete ShowPlan by calling the emit_show_plan tool exactly once. Never reply with prose.

HARD RULES
- Call emit_show_plan exactly once with valid JSON. No markdown.
- Coordinates are METERS in a flat XZ plane (x = right, z = forward, y = ground = 0).
- Layout positions symmetrically around origin (0,0) unless the brief says otherwise.
- Respect spacing in the brief literally (e.g. "20m apart" → adjacent positions exactly 20 m apart).
- Pyro positions: type "pyro". Drone pads: type "drone-pad". Lights: type "light".
- Each timeline item references a positionId from the positions array (exact match).
- startTime is in SECONDS from t=0. trackIndex starts at 0; use higher tracks only when overlapping fires on the same position.
- Choose effectId from the EFFECT CATALOG below. If unsure, prefer mort-01, comet-01, mine-01, fan-01.
- Maximum 200 timeline items per plan. If the brief implies more, condense.
- Total duration ≥ last item start + 5 s.
- If the brief is ambiguous, make conservative choices and list them in 'assumptions'.

EFFECT CATALOG (use these IDs verbatim)
Mortars: mort-01 (3" Chrysanthemum, 60m), mort-02 (4" Willow, 80m), mort-03 (5" Brocade, 100m), mort-04 (6" Palm, 120m)
Shells: shell-01..shell-20 (mixed peony/willow/kamuro/crossette/ring/heart/strobe; calibers 3-12)
Comets: comet-01 (rising), comet-02 (falling trail)
Mines: mine-01 (silver mine, ground burst)
Fans: fan-01 (90° spread), fan-02 (180° wide)
Peonies: peon-01 (red), peon-02 (blue), peon-03 (green), peon-04 (purple), peon-05 (silver), peon-06 (gold), peon-07 (crackle), peon-08 (falling leaves)

PATTERN HINTS
- "vai-e-volta" / "ping-pong": iterate positions left→right then right→left, stagger ~0.4 s.
- "sequência" / "chase": iterate positions in order with a fixed stagger (0.2-0.5 s).
- "leques cometa" / "comet fan": use fan-01 or fan-02, distribute across positions, stagger 0.3 s.
- "para cima" / "volley up": stack items at the same time on different positions (no stagger).
- "finale": dense burst in the last 3-5 s using mortars + comets + fans.`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "emit_show_plan",
    description: "Emit a strictly typed ShowPlan with positions and timeline items.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        duration: { type: "number", minimum: 5, maximum: 600 },
        assumptions: { type: "array", items: { type: "string" } },
        positions: {
          type: "array",
          minItems: 1,
          maxItems: 64,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string", description: "Stable ID, e.g. 'pos-1'" },
              name: { type: "string" },
              type: { type: "string", enum: ["pyro", "drone-pad", "light"] },
              x: { type: "number" },
              z: { type: "number" },
            },
            required: ["id", "name", "type", "x", "z"],
          },
        },
        timeline: {
          type: "array",
          minItems: 1,
          maxItems: 200,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              effectId: { type: "string" },
              positionId: { type: "string" },
              startTime: { type: "number", minimum: 0 },
              trackIndex: { type: "integer", minimum: 0, maximum: 16 },
              notes: { type: "string" },
            },
            required: ["effectId", "positionId", "startTime"],
          },
        },
      },
      required: ["title", "duration", "positions", "timeline"],
    },
  },
};

interface ComposeRequest {
  prompt?: string;
  model?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as ComposeRequest;
    const prompt = (body.prompt ?? "").toString().trim();
    if (!prompt || prompt.length < 4) {
      return new Response(JSON.stringify({ error: "prompt is required (min 4 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (prompt.length > 4000) {
      return new Response(JSON.stringify({ error: "prompt too long (max 4000 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const model = body.model && typeof body.model === "string" ? body.model : DEFAULT_MODEL;

    const aiResp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "emit_show_plan" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos AI esgotados. Adicione créditos no workspace." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("studio-ai-compose: gateway error", aiResp.status, txt);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsRaw = toolCall?.function?.arguments;
    if (!argsRaw) {
      console.error("studio-ai-compose: no tool call in response", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "AI did not return a structured plan" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let plan: any;
    try {
      plan = JSON.parse(argsRaw);
    } catch (e) {
      console.error("studio-ai-compose: invalid JSON from tool call", e);
      return new Response(JSON.stringify({ error: "AI returned invalid JSON" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Light server-side sanity checks (client SafetyGate is the source of truth)
    const positionIds = new Set<string>((plan.positions ?? []).map((p: any) => String(p.id)));
    const orphanCount = (plan.timeline ?? []).filter((t: any) => !positionIds.has(String(t.positionId))).length;
    if (orphanCount > 0) {
      console.warn(`studio-ai-compose: ${orphanCount} timeline items reference unknown positions (will be filtered client-side)`);
    }

    return new Response(
      JSON.stringify({
        plan,
        meta: {
          model,
          positionCount: plan.positions?.length ?? 0,
          timelineCount: plan.timeline?.length ?? 0,
          orphanCount,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("studio-ai-compose: unexpected error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
