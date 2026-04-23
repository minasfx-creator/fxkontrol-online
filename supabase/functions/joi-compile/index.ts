// Joi Compile — LLM agent that converts natural language into JoiShowGraph V2.
//
// Hard rules:
//  - LLM output is STRICT JSON via tool calling (no markdown, no prose).
//  - LLM never executes anything. Output is intent only.
//  - All time is relative offsets inside stages (no wall-clock).
//  - On failure → caller falls back to safe empty graph.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `You are Joi, a show design compiler.

You convert natural language into a STRICT JSON schema (JoiShowGraph V2) by calling the emit_show_graph tool.

RULES:
- Call the tool exactly once. Never reply with prose.
- All time is RELATIVE OFFSETS inside stages (seconds). Never wall-clock.
- Three layer types only: drone, dmx, pyro. Layers do not reference each other.
- Drones = motion only. DMX = light only. Pyro = events only.
- Respect provided safetyConstraints (max concurrent pyro, max drone speed).
- Never output runtime code, hardware commands, infinite loops, or unsafe pyro densities.
- If intent is ambiguous, make conservative choices and list them in 'assumptions'.`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "emit_show_graph",
    description: "Emit a strictly typed JoiShowGraph V2 design.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        confidence: { type: "number", minimum: 0, maximum: 1 },
        assumptions: { type: "array", items: { type: "string" } },
        warnings: { type: "array", items: { type: "string" } },
        graph: {
          type: "object",
          additionalProperties: false,
          properties: {
            metadata: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                notes: { type: "string" },
              },
              required: ["title"],
            },
            duration: { type: "number", minimum: 1 },
            stages: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  startTime: { type: "number", minimum: 0 },
                  duration: { type: "number", minimum: 0.1 },
                  layers: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: true,
                      properties: {
                        type: { type: "string", enum: ["drone", "dmx", "pyro"] },
                      },
                      required: ["type"],
                    },
                  },
                },
                required: ["id", "name", "startTime", "duration", "layers"],
              },
            },
          },
          required: ["metadata", "duration", "stages"],
        },
      },
      required: ["graph", "confidence", "assumptions", "warnings"],
    },
  },
};

interface RequestBody {
  prompt: string;
  constraints?: {
    maxConcurrentPyro?: number;
    maxDroneSpeed?: number;
    minDistanceBetweenDrones?: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!body?.prompt || typeof body.prompt !== "string" || body.prompt.length > 4000) {
      return new Response(JSON.stringify({ error: "Invalid prompt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const constraintMsg = body.constraints
      ? `\n\nSafety constraints: ${JSON.stringify(body.constraints)}`
      : "";

    const aiResp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: body.prompt + constraintMsg },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "emit_show_graph" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded, please retry shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Lovable workspace." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error", aiResp.status, txt);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "LLM did not call tool" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("LLM JSON parse error", e);
      return new Response(JSON.stringify({ error: "LLM emitted invalid JSON" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("joi-compile fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
