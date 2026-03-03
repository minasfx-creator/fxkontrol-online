import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert drone light show choreographer. You generate precise 2D coordinates (x, z) for drone formations.

CRITICAL RULES FOR MAXIMUM ACCURACY:
1. Return ONLY a valid JSON via the tool call. No extra text.
2. Points MUST be centered around (0,0) with the centroid at origin.
3. Coordinates are in meters. Typical range: -40 to 40.
4. The number of points MUST EXACTLY match the requested drone count. No more, no less.
5. Minimum spacing between ANY two drones: 2.0 meters (safety requirement).
6. suggestedHeight: 15-80 meters (higher for larger formations).
7. suggestedTransitionTime: 8-30 seconds.

FORMATION QUALITY GUIDELINES:
- Distribute points EVENLY along outlines/shapes. Avoid clustering.
- For recognizable shapes (letters, logos, symbols): use clear outlines with enough density to be readable from below.
- For text/letters: approximate each letter using 8-15 dots minimum. Space letters 8-12m apart.
- For organic shapes (animals, faces): focus on the most distinctive silhouette features.
- For geometric patterns: maintain perfect symmetry where applicable.
- Scale the formation proportionally: more drones = larger formation for readability.
- Consider that viewers see this from BELOW looking UP - shapes should be oriented accordingly (not mirrored).

POINT DISTRIBUTION STRATEGY:
- Outline-based shapes: place points at equal arc-length intervals along the perimeter.
- Filled shapes: use concentric layers or grid sampling within the boundary.
- Complex shapes: allocate more points to detailed areas, fewer to simple edges.
- Always ensure the shape is clearly recognizable with the given drone count.

SCALING FORMULA:
- For N drones, use approximately radius = sqrt(N) * 1.8 meters as base scale.
- Minimum formation radius: 8 meters. Maximum: 50 meters.`;

const FEW_SHOT_EXAMPLES = {
  text: `Example: For "heart" with 24 drones, distribute 24 points evenly along the parametric heart curve x=16sin³(t), z=13cos(t)-5cos(2t)-2cos(3t)-cos(4t), scaled to ~15m radius.`,
  image: `Focus on extracting the PRIMARY contour of the main subject. Ignore background details. Place drones along the most recognizable outline edges.`,
  generative: `Create visually striking, symmetrical patterns. Use mathematical beauty: golden ratio spirals, fractals simplified to N points, sacred geometry, or interference patterns.`,
};

function buildUserMessage(mode: string, prompt: string, droneCount: number): string {
  const base = `Generate a drone formation with EXACTLY ${droneCount} drones.`;
  const hint = FEW_SHOT_EXAMPLES[mode as keyof typeof FEW_SHOT_EXAMPLES] || "";

  if (mode === "text") {
    return `${base} Shape: "${prompt}". ${hint} Ensure all ${droneCount} points form a clearly recognizable shape. Return coordinates via tool call.`;
  }
  if (mode === "image") {
    return `${base} Analyze the image and recreate its main shape/silhouette. ${hint} Use exactly ${droneCount} points along the primary contour. Return coordinates via tool call.`;
  }
  if (mode === "generative") {
    return `${base} Theme: "${prompt || 'abstract geometric'}". ${hint} Create a unique, visually impressive, and symmetrical pattern. Return coordinates via tool call.`;
  }
  throw new Error(`Invalid mode: ${mode}`);
}

/** Post-process points to enforce constraints */
function postProcess(
  points: { x: number; z: number }[],
  targetCount: number,
  minSpacing: number = 2.0,
): { x: number; z: number }[] {
  if (points.length === 0) return points;

  // 1. Center at origin
  let cx = 0, cz = 0;
  for (const p of points) { cx += p.x; cz += p.z; }
  cx /= points.length; cz /= points.length;
  let centered = points.map(p => ({ x: p.x - cx, z: p.z - cz }));

  // 2. Enforce minimum spacing by nudging overlapping points
  for (let iter = 0; iter < 10; iter++) {
    let moved = false;
    for (let i = 0; i < centered.length; i++) {
      for (let j = i + 1; j < centered.length; j++) {
        const dx = centered[j].x - centered[i].x;
        const dz = centered[j].z - centered[i].z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < minSpacing && dist > 0.001) {
          const push = (minSpacing - dist) / 2 + 0.1;
          const nx = dx / dist, nz = dz / dist;
          centered[i] = { x: centered[i].x - nx * push, z: centered[i].z - nz * push };
          centered[j] = { x: centered[j].x + nx * push, z: centered[j].z + nz * push };
          moved = true;
        } else if (dist <= 0.001) {
          // Coincident points - separate randomly
          const angle = Math.random() * Math.PI * 2;
          centered[j] = { x: centered[j].x + Math.cos(angle) * minSpacing, z: centered[j].z + Math.sin(angle) * minSpacing };
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  // 3. Adjust count if needed
  if (centered.length > targetCount) {
    // Remove points closest to their nearest neighbor (least important)
    while (centered.length > targetCount) {
      let minDist = Infinity, removeIdx = 0;
      for (let i = 0; i < centered.length; i++) {
        for (let j = 0; j < centered.length; j++) {
          if (i === j) continue;
          const d = Math.sqrt((centered[i].x - centered[j].x) ** 2 + (centered[i].z - centered[j].z) ** 2);
          if (d < minDist) { minDist = d; removeIdx = i; }
        }
      }
      centered.splice(removeIdx, 1);
    }
  } else if (centered.length < targetCount) {
    // Add interpolated points between the most distant consecutive pairs
    while (centered.length < targetCount) {
      let maxDist = 0, insertAfter = 0;
      for (let i = 0; i < centered.length; i++) {
        const j = (i + 1) % centered.length;
        const d = Math.sqrt((centered[i].x - centered[j].x) ** 2 + (centered[i].z - centered[j].z) ** 2);
        if (d > maxDist) { maxDist = d; insertAfter = i; }
      }
      const j = (insertAfter + 1) % centered.length;
      const mid = {
        x: (centered[insertAfter].x + centered[j].x) / 2,
        z: (centered[insertAfter].z + centered[j].z) / 2,
      };
      centered.splice(insertAfter + 1, 0, mid);
    }
  }

  // 4. Round to 2 decimal places
  return centered.map(p => ({
    x: Math.round(p.x * 100) / 100,
    z: Math.round(p.z * 100) / 100,
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { mode, prompt, droneCount, imageBase64 } = await req.json();
    const count = droneCount || 24;

    const userMessage = buildUserMessage(mode, prompt, count);

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
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
      model: mode === "image" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
      messages,
      temperature: 0.3, // Lower temperature for more consistent/precise output
      tools: [
        {
          type: "function",
          function: {
            name: "create_formation",
            description: `Create a drone formation with EXACTLY ${count} 2D coordinates. Each point has x and z in meters.`,
            parameters: {
              type: "object",
              properties: {
                points: {
                  type: "array",
                  description: `Array of EXACTLY ${count} drone positions`,
                  items: {
                    type: "object",
                    properties: {
                      x: { type: "number", description: "X coordinate in meters" },
                      z: { type: "number", description: "Z coordinate in meters" },
                    },
                    required: ["x", "z"],
                    additionalProperties: false,
                  },
                },
                formationName: { type: "string", description: "Short descriptive name for the formation" },
                suggestedHeight: { type: "number", description: "Suggested altitude in meters (15-80)" },
                suggestedTransitionTime: { type: "number", description: "Suggested transition time in seconds (8-30)" },
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
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const raw = JSON.parse(toolCall.function.arguments);
    const rawPoints = (raw.points || []).map((p: any) => ({ x: Number(p.x), z: Number(p.z) }));

    // Post-process for safety and accuracy
    const processedPoints = postProcess(rawPoints, count);

    console.log(`Formation "${raw.formationName}": requested=${count}, raw=${rawPoints.length}, final=${processedPoints.length}`);

    return new Response(JSON.stringify({
      points: processedPoints,
      formationName: raw.formationName || "AI Formation",
      suggestedHeight: Math.max(15, Math.min(80, raw.suggestedHeight || 25)),
      suggestedTransitionTime: Math.max(8, Math.min(30, raw.suggestedTransitionTime || 12)),
      rawPointCount: rawPoints.length,
    }), {
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
