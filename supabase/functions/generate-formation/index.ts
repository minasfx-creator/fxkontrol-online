import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert drone light show choreographer and computational geometry specialist. You generate precise 2D coordinates (x, z) for drone formations.

CRITICAL RULES FOR MAXIMUM ACCURACY:
1. Return ONLY valid JSON via the tool call. No extra text.
2. Points MUST be centered around (0,0) with the centroid at origin.
3. Coordinates are in meters. Typical range: -40 to 40.
4. The number of points MUST EXACTLY match the requested drone count. Count them carefully.
5. Minimum spacing between ANY two drones: 2.0 meters (FAA safety requirement).
6. suggestedHeight: 15-80 meters (scale with formation size).
7. suggestedTransitionTime: 8-30 seconds.

FORMATION QUALITY GUIDELINES:
- OUTLINE SHAPES: Place points at EQUAL arc-length intervals. Use parametric equations.
  - Heart: x=16sin³(t), z=13cos(t)-5cos(2t)-2cos(3t)-cos(4t), t∈[0,2π]
  - Star: alternate between inner and outer radius at angular intervals
  - Circle: simple θ = 2π*i/N
- FILLED SHAPES: Use concentric layers or Poisson disk sampling within the boundary.
- TEXT/LETTERS: Each letter needs 8-15 points minimum. Space letters 8-12m apart. Use sans-serif block forms.
- COMPLEX SHAPES: Allocate 60% of points to distinctive features, 40% to fill.
- Viewers see this from BELOW looking UP - do NOT mirror shapes.
- For symmetric shapes: compute one side, then mirror precisely.

SCALING FORMULA:
- radius ≈ sqrt(N) * 1.8 meters. Min: 8m, Max: 50m.
- More drones → proportionally larger formation for readability.

SVG PATH SUPPORT:
- If the prompt contains SVG path data (d="..."), parse the path and sample N points along it evenly.
- Normalize to fit within the radius constraint.

EMOJI SUPPORT:
- If the prompt is an emoji (🌟⭐❤️🎄🎵 etc.), create the recognizable shape of that emoji.
- Stars: 5 points with inner/outer radius alternation.
- Hearts: parametric heart curve.
- Trees: triangle + rectangle trunk.`;

const FEW_SHOT_EXAMPLES = {
  text: `Example: "heart" with 24 drones → sample 24 points on parametric heart curve, scale to ~15m radius, verify 2m minimum spacing.
Example: "LOVE" with 50 drones → L(10pts) O(12pts) V(10pts) E(10pts) + 8 fill pts. Letters ~8m wide, spaced 10m apart.`,
  image: `Extract PRIMARY contour of the main subject. Ignore background. Place drones along the most recognizable outline edges at equal intervals. For portraits: focus on face silhouette. For logos: trace the main shape.`,
  generative: `Create visually stunning patterns using mathematical beauty:
- Golden spiral: r = φ^(θ/90°), sample N points along the spiral
- Fibonacci sunflower: θ = 2π * i * φ⁻¹, r = sqrt(i) * scale
- Lissajous: x=A*sin(a*t+δ), z=B*sin(b*t)
- Sacred geometry: Flower of Life (overlapping circles)
- Fractal: Simplified Koch snowflake or Sierpinski to N points`,
};

function buildUserMessage(mode: string, prompt: string, droneCount: number): string {
  const base = `Generate a drone formation with EXACTLY ${droneCount} drones. You MUST return exactly ${droneCount} points.`;
  const hint = FEW_SHOT_EXAMPLES[mode as keyof typeof FEW_SHOT_EXAMPLES] || "";

  if (mode === "text") {
    return `${base}\nShape: "${prompt}"\n${hint}\nIMPORTANT: Count your points. You need EXACTLY ${droneCount}. Double-check before returning.`;
  }
  if (mode === "image") {
    return `${base}\nAnalyze the image and recreate its main shape/silhouette using exactly ${droneCount} points.\n${hint}`;
  }
  if (mode === "generative") {
    return `${base}\nTheme: "${prompt || 'abstract geometric'}"\n${hint}\nCreate a unique, symmetrical, visually impressive pattern with EXACTLY ${droneCount} points.`;
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

  // 2. Enforce minimum spacing with iterative relaxation
  for (let iter = 0; iter < 20; iter++) {
    let moved = false;
    for (let i = 0; i < centered.length; i++) {
      for (let j = i + 1; j < centered.length; j++) {
        const dx = centered[j].x - centered[i].x;
        const dz = centered[j].z - centered[i].z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < minSpacing && dist > 0.001) {
          const push = (minSpacing - dist) / 2 + 0.05;
          const nx = dx / dist, nz = dz / dist;
          centered[i] = { x: centered[i].x - nx * push, z: centered[i].z - nz * push };
          centered[j] = { x: centered[j].x + nx * push, z: centered[j].z + nz * push };
          moved = true;
        } else if (dist <= 0.001) {
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
    // Remove least-important points (closest to neighbors)
    while (centered.length > targetCount) {
      let minDist = Infinity, removeIdx = 0;
      for (let i = 0; i < centered.length; i++) {
        let closest = Infinity;
        for (let j = 0; j < centered.length; j++) {
          if (i === j) continue;
          const d = Math.sqrt((centered[i].x - centered[j].x) ** 2 + (centered[i].z - centered[j].z) ** 2);
          if (d < closest) closest = d;
        }
        if (closest < minDist) { minDist = closest; removeIdx = i; }
      }
      centered.splice(removeIdx, 1);
    }
  } else if (centered.length < targetCount) {
    // Add interpolated points between most distant consecutive pairs
    while (centered.length < targetCount) {
      let maxDist = 0, insertAfter = 0;
      for (let i = 0; i < centered.length; i++) {
        const j = (i + 1) % centered.length;
        const d = Math.sqrt((centered[i].x - centered[j].x) ** 2 + (centered[i].z - centered[j].z) ** 2);
        if (d > maxDist) { maxDist = d; insertAfter = i; }
      }
      const j = (insertAfter + 1) % centered.length;
      // Add some jitter to avoid coincident points
      const jitter = () => (Math.random() - 0.5) * 0.3;
      const mid = {
        x: (centered[insertAfter].x + centered[j].x) / 2 + jitter(),
        z: (centered[insertAfter].z + centered[j].z) / 2 + jitter(),
      };
      centered.splice(insertAfter + 1, 0, mid);
    }
  }

  // 4. Re-center after adjustments
  cx = 0; cz = 0;
  for (const p of centered) { cx += p.x; cz += p.z; }
  cx /= centered.length; cz /= centered.length;

  // 5. Round to 2 decimal places
  return centered.map(p => ({
    x: Math.round((p.x - cx) * 100) / 100,
    z: Math.round((p.z - cz) * 100) / 100,
  }));
}

/** Optimize transition paths between two formations using greedy nearest-neighbor matching */
function optimizeTransitionOrder(
  from: { x: number; z: number }[],
  to: { x: number; z: number }[],
): { x: number; z: number }[] {
  if (from.length === 0 || to.length === 0 || from.length !== to.length) return to;
  
  const n = from.length;
  const result: { x: number; z: number }[] = new Array(n);
  const used = new Set<number>();
  
  // Greedy matching: for each source point, find nearest unmatched target
  for (let i = 0; i < n; i++) {
    let bestJ = -1, bestDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (used.has(j)) continue;
      const d = Math.sqrt((from[i].x - to[j].x) ** 2 + (from[i].z - to[j].z) ** 2);
      if (d < bestDist) { bestDist = d; bestJ = j; }
    }
    result[i] = to[bestJ];
    used.add(bestJ);
  }
  
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { mode, prompt, droneCount, imageBase64, previousFormation } = await req.json();
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
      temperature: 0.2,
      tools: [
        {
          type: "function",
          function: {
            name: "create_formation",
            description: `Create a drone formation with EXACTLY ${count} 2D coordinates. Each point has x and z in meters. You MUST provide exactly ${count} points.`,
            parameters: {
              type: "object",
              properties: {
                points: {
                  type: "array",
                  description: `Array of EXACTLY ${count} drone positions. COUNT CAREFULLY.`,
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
                formationName: { type: "string", description: "Short descriptive name" },
                suggestedHeight: { type: "number", description: "Altitude in meters (15-80)" },
                suggestedTransitionTime: { type: "number", description: "Transition time in seconds (8-30)" },
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
    let processedPoints = postProcess(rawPoints, count);
    
    // Optimize transition order if previous formation provided
    if (previousFormation && Array.isArray(previousFormation) && previousFormation.length === processedPoints.length) {
      processedPoints = optimizeTransitionOrder(previousFormation, processedPoints);
    }

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
