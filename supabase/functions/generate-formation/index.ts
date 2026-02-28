import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { mode, prompt, droneCount, imageBase64 } = await req.json();

    const systemPrompt = `You are a drone formation designer. Generate 2D coordinates (x, z) for drone positions that form shapes or patterns.

RULES:
- Return ONLY valid JSON with this exact structure: { "points": [{"x": number, "z": number}], "formationName": "string", "suggestedHeight": number, "suggestedTransitionTime": number }
- Points should be centered around (0,0)
- Coordinates in meters, typical range -30 to 30
- Number of points MUST match the requested drone count (default 24 if not specified)
- suggestedHeight in meters (10-80)
- suggestedTransitionTime in seconds (5-30)
- Be creative with the shape but ensure drones are spaced at least 1.5m apart
- For text formations, approximate letters using dot patterns`;

    let userMessage = "";

    if (mode === "text") {
      userMessage = `Create a drone formation with ${droneCount || 24} drones based on this description: "${prompt}". Return the JSON coordinates.`;
    } else if (mode === "image") {
      userMessage = `Analyze this image and create a drone formation with ${droneCount || 24} drones that recreates the main shape/outline visible in the image. Return the JSON coordinates.`;
    } else if (mode === "generative") {
      userMessage = `Generate a creative and visually impressive drone formation with ${droneCount || 24} drones. Theme: "${prompt || 'abstract geometric pattern'}". Make it unique and aesthetically pleasing. Return the JSON coordinates.`;
    } else {
      throw new Error(`Invalid mode: ${mode}`);
    }

    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    if (mode === "image" && imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userMessage },
          { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } },
        ],
      });
    } else {
      messages.push({ role: "user", content: userMessage });
    }

    const body: any = {
      model: mode === "image" ? "google/gemini-2.5-flash" : "google/gemini-3-flash-preview",
      messages,
      tools: [
        {
          type: "function",
          function: {
            name: "create_formation",
            description: "Create a drone formation with 2D coordinates",
            parameters: {
              type: "object",
              properties: {
                points: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      x: { type: "number" },
                      z: { type: "number" },
                    },
                    required: ["x", "z"],
                    additionalProperties: false,
                  },
                },
                formationName: { type: "string" },
                suggestedHeight: { type: "number" },
                suggestedTransitionTime: { type: "number" },
              },
              required: ["points", "formationName", "suggestedHeight", "suggestedTransitionTime"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "create_formation" } },
    };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Add funds in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();

    // Extract from tool call
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in response");
    }

    const formation = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(formation), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-formation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
