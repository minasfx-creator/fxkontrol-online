import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ── System prompt with extreme precision focus ──────────────

const SYSTEM_PROMPT = `You are a drone light show formation generator. You output EXACT coordinates.

ABSOLUTE RULES — VIOLATION = FAILURE:
1. You MUST return EXACTLY N points where N is specified. Not N-1, not N+1. EXACTLY N.
2. Before returning, COUNT your points array. If length ≠ N, fix it.
3. Coordinates are in meters, centered at (0,0). Range: typically -50 to +50.
4. Minimum distance between ANY two points: 2.0 meters.
5. suggestedHeight: 15-80m. suggestedTransitionTime: 8-30s.

HOW TO GENERATE EXACTLY N POINTS:
- Step 1: Determine the shape boundary/outline mathematically.
- Step 2: Sample EXACTLY N points using parametric sampling: t_i = i/N for i=0..N-1
- Step 3: Verify count = N before returning.

SHAPE RECIPES:
• Circle: x=R*cos(2π*i/N), z=R*sin(2π*i/N), R=sqrt(N)*1.5
• Heart: x=16*sin³(t), z=13*cos(t)-5*cos(2t)-2*cos(3t)-cos(4t), scale to R
• Star(5pt): alternate between R_outer and R_inner=R*0.38 at angles 2π*i/10
• Grid: cols=ceil(sqrt(N)), spacing=2.5m, centered
• Text/Letters: Block font, 8-15 pts per char, 10m letter spacing. Total MUST = N.
• Filled shapes: Concentric rings. Ring_k has round(N * ring_k_circumference / total_circumference) points.
• Emoji shapes: Map emoji to its recognizable geometric form.
• SVG paths: Parse d="..." and sample N equidistant points along total path length.

SCALING: radius = max(8, min(50, sqrt(N) * 1.8))

CRITICAL: The "points" array length MUST EQUAL the requested count. Double-check before responding.`;

// ── Trajectory generation system prompt ──────────────────────

const TRAJECTORY_SYSTEM_PROMPT = `You are a drone choreography trajectory designer. You create smooth, cinematic drone movement sequences described in natural language.

Given a description of desired drone movement, you generate a sequence of keyframe waypoints for each phase of the choreography.

OUTPUT RULES:
1. Each phase has: name, duration (seconds), and a movement pattern.
2. Movement patterns are parametric: for drone index i (0-based) out of N total drones, compute position at time t (0-1).
3. All coordinates in meters. Y = altitude (up). X,Z = horizontal.
4. Transitions between phases should be smooth (avoid discontinuities).
5. Consider visual impact from ground-level audience perspective.

MOVEMENT VOCABULARY:
- "expand" / "contract": scale formation outward/inward
- "rotate": spin around Y axis
- "wave": sinusoidal vertical oscillation with phase offset per drone
- "spiral": helical motion combining rotation and altitude change  
- "scatter": random spread from formation
- "converge": gather to center point
- "pulse": rhythmic scale oscillation
- "cascade": sequential movement rippling through drones
- "morph": interpolate between two shape definitions
- "orbit": circular path around a center point
- "bloom": flower-like opening pattern
- "rain": drones fall like raindrops with staggered timing`;

// ── Helper: build user message ──────────────────────────────

function buildUserMessage(mode: string, prompt: string, droneCount: number): string {
  const N = droneCount;
  const base = `Generate a drone formation with EXACTLY ${N} points. The "points" array MUST have exactly ${N} elements. Count carefully.`;

  if (mode === "text") {
    return `${base}\n\nShape requested: "${prompt}"\n\nRemember: EXACTLY ${N} points. Not more, not less. Count your output.`;
  }
  if (mode === "image") {
    return `${base}\n\nAnalyze the uploaded image. Extract the main subject's outline/silhouette. Place EXACTLY ${N} drone points along the most recognizable contour edges at equal intervals. Focus on the primary shape, ignore background details.`;
  }
  if (mode === "generative") {
    return `${base}\n\nCreate a visually stunning, unique pattern for theme: "${prompt || 'abstract geometric'}"\n\nUse mathematical beauty: golden ratio spirals, Fibonacci patterns, Lissajous curves, sacred geometry, fractals, or organic forms. Make it MEMORABLE and SYMMETRICAL. EXACTLY ${N} points.`;
  }
  throw new Error(`Invalid mode: ${mode}`);
}

// ── Post-processing for safety ──────────────────────────────

function postProcess(
  points: { x: number; z: number }[],
  targetCount: number,
  minSpacing: number = 2.0,
): { x: number; z: number }[] {
  if (points.length === 0) return [];

  // Center at origin
  let cx = 0, cz = 0;
  for (const p of points) { cx += p.x; cz += p.z; }
  cx /= points.length; cz /= points.length;
  let pts = points.map(p => ({ x: p.x - cx, z: p.z - cz }));

  // Adjust count FIRST (before spacing enforcement)
  if (pts.length > targetCount) {
    // Remove points that are closest to their nearest neighbor (least important)
    while (pts.length > targetCount) {
      let minDist = Infinity, removeIdx = 0;
      for (let i = 0; i < pts.length; i++) {
        let closest = Infinity;
        for (let j = 0; j < pts.length; j++) {
          if (i === j) continue;
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z);
          if (d < closest) closest = d;
        }
        if (closest < minDist) { minDist = closest; removeIdx = i; }
      }
      pts.splice(removeIdx, 1);
    }
  } else if (pts.length < targetCount) {
    // Add interpolated points between most distant pairs
    while (pts.length < targetCount) {
      let maxDist = 0, bestI = 0, bestJ = 1;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z);
          if (d > maxDist) { maxDist = d; bestI = i; bestJ = j; }
        }
      }
      const jitter = () => (Math.random() - 0.5) * 0.2;
      pts.push({
        x: (pts[bestI].x + pts[bestJ].x) / 2 + jitter(),
        z: (pts[bestI].z + pts[bestJ].z) / 2 + jitter(),
      });
    }
  }

  // Enforce minimum spacing with relaxation
  for (let iter = 0; iter < 30; iter++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x;
        const dz = pts[j].z - pts[i].z;
        const dist = Math.hypot(dx, dz);
        if (dist < minSpacing && dist > 0.001) {
          const push = (minSpacing - dist) / 2 + 0.05;
          const nx = dx / dist, nz = dz / dist;
          pts[i] = { x: pts[i].x - nx * push, z: pts[i].z - nz * push };
          pts[j] = { x: pts[j].x + nx * push, z: pts[j].z + nz * push };
          moved = true;
        } else if (dist <= 0.001) {
          const a = Math.random() * Math.PI * 2;
          pts[j] = { x: pts[j].x + Math.cos(a) * minSpacing, z: pts[j].z + Math.sin(a) * minSpacing };
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  // Re-center and round
  cx = 0; cz = 0;
  for (const p of pts) { cx += p.x; cz += p.z; }
  cx /= pts.length; cz /= pts.length;
  return pts.map(p => ({
    x: Math.round((p.x - cx) * 100) / 100,
    z: Math.round((p.z - cz) * 100) / 100,
  }));
}

// ── Transition optimizer ────────────────────────────────────

function optimizeTransitionOrder(
  from: { x: number; z: number }[],
  to: { x: number; z: number }[],
): { x: number; z: number }[] {
  if (from.length === 0 || to.length === 0 || from.length !== to.length) return to;
  const n = from.length;
  const result = new Array(n);
  const used = new Set<number>();
  for (let i = 0; i < n; i++) {
    let bestJ = -1, bestDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (used.has(j)) continue;
      const d = Math.hypot(from[i].x - to[j].x, from[i].z - to[j].z);
      if (d < bestDist) { bestDist = d; bestJ = j; }
    }
    result[i] = to[bestJ];
    used.add(bestJ);
  }
  return result;
}

// ── AI call with retry + model fallback ─────────────────────

async function callAI(
  apiKey: string,
  model: string,
  messages: any[],
  tools: any[],
  toolChoice: any,
  temperature: number = 0.1,
): Promise<any> {
  const response = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, tools, tool_choice: toolChoice, temperature }),
  });

  if (!response.ok) {
    if (response.status === 429) throw { status: 429, message: "Rate limit exceeded. Try again shortly." };
    if (response.status === 402) throw { status: 402, message: "Credits exhausted." };
    const t = await response.text();
    console.error(`AI error (${model}):`, response.status, t);
    throw new Error(`AI error: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call in response");
  return JSON.parse(toolCall.function.arguments);
}

// ── Build tool schema ───────────────────────────────────────

function buildFormationTool(count: number) {
  return {
    type: "function",
    function: {
      name: "create_formation",
      description: `Create a drone formation. The points array MUST have EXACTLY ${count} elements.`,
      parameters: {
        type: "object",
        properties: {
          points: {
            type: "array",
            description: `EXACTLY ${count} drone positions. You MUST provide exactly ${count} items.`,
            minItems: count,
            maxItems: count,
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
          suggestedHeight: { type: "number", description: "Suggested altitude 15-80m" },
          suggestedTransitionTime: { type: "number", description: "Transition time 8-30s" },
        },
        required: ["points", "formationName", "suggestedHeight", "suggestedTransitionTime"],
        additionalProperties: false,
      },
    },
  };
}

// ── Trajectory tool schema ──────────────────────────────────

function buildTrajectoryTool() {
  return {
    type: "function",
    function: {
      name: "create_trajectory_sequence",
      description: "Create a choreography sequence of movement phases for drones.",
      parameters: {
        type: "object",
        properties: {
          phases: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Phase name" },
                duration: { type: "number", description: "Duration in seconds" },
                movement: { type: "string", enum: ["expand", "contract", "rotate", "wave", "spiral", "scatter", "converge", "pulse", "cascade", "morph", "orbit", "bloom", "rain", "hold", "custom"] },
                intensity: { type: "number", description: "0-1 intensity of the movement" },
                parameters: {
                  type: "object",
                  properties: {
                    axis: { type: "string", enum: ["x", "y", "z", "xz"] },
                    speed: { type: "number" },
                    scale: { type: "number" },
                    offset: { type: "number" },
                    targetFormation: { type: "string", description: "Target shape name if morphing" },
                  },
                  additionalProperties: false,
                },
              },
              required: ["name", "duration", "movement", "intensity"],
              additionalProperties: false,
            },
          },
          totalDuration: { type: "number", description: "Total sequence duration in seconds" },
          description: { type: "string", description: "Natural language description of the choreography" },
        },
        required: ["phases", "totalDuration", "description"],
        additionalProperties: false,
      },
    },
  };
}

// ── Main handler ────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { mode, prompt, droneCount, imageBase64, previousFormation, generateTrajectory } = await req.json();

    // ── Trajectory generation mode ──────────────────────────
    if (generateTrajectory) {
      const trajMessages = [
        { role: "system", content: TRAJECTORY_SYSTEM_PROMPT },
        { role: "user", content: `Create a drone choreography sequence for ${droneCount || 24} drones based on this description: "${prompt}"\n\nMake it visually stunning, with smooth transitions between phases. Consider audience perspective from below.` },
      ];

      const trajResult = await callAI(
        LOVABLE_API_KEY,
        "google/gemini-2.5-pro",
        trajMessages,
        [buildTrajectoryTool()],
        { type: "function", function: { name: "create_trajectory_sequence" } },
        0.3,
      );

      return new Response(JSON.stringify(trajResult), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Formation generation mode ───────────────────────────
    const count = droneCount || 24;
    const userMessage = buildUserMessage(mode, prompt, count);
    const tool = buildFormationTool(count);
    const toolChoice = { type: "function", function: { name: "create_formation" } };

    const messages: any[] = [{ role: "system", content: SYSTEM_PROMPT }];

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

    // Model selection strategy:
    // - Image mode: gemini-2.5-pro (best multimodal)
    // - Text with high count (>100): gemini-2.5-pro (better precision)
    // - Text with low count: gemini-2.5-flash (faster, good enough)
    // - Generative: gemini-2.5-pro (creativity + precision)
    let primaryModel: string;
    if (mode === "image") {
      primaryModel = "google/gemini-2.5-pro";
    } else if (mode === "generative" || count > 100) {
      primaryModel = "google/gemini-2.5-pro";
    } else {
      primaryModel = "google/gemini-2.5-flash";
    }

    let raw: any;
    let usedModel = primaryModel;

    try {
      raw = await callAI(LOVABLE_API_KEY, primaryModel, messages, [tool], toolChoice, 0.1);
    } catch (e: any) {
      // If primary fails with non-rate-limit error, try fallback model
      if (e.status === 429 || e.status === 402) throw e;
      console.warn(`Primary model ${primaryModel} failed, trying fallback...`);
      const fallback = primaryModel === "google/gemini-2.5-pro" ? "google/gemini-2.5-flash" : "google/gemini-2.5-pro";
      raw = await callAI(LOVABLE_API_KEY, fallback, messages, [tool], toolChoice, 0.1);
      usedModel = fallback;
    }

    const rawPoints = (raw.points || []).map((p: any) => ({ x: Number(p.x), z: Number(p.z) })).filter((p: any) => !isNaN(p.x) && !isNaN(p.z));

    // Post-process
    let processedPoints = postProcess(rawPoints, count);

    // Optimize transition if previous formation provided
    if (previousFormation && Array.isArray(previousFormation) && previousFormation.length === processedPoints.length) {
      processedPoints = optimizeTransitionOrder(previousFormation, processedPoints);
    }

    // Validation: if count is WAY off and we used flash, retry with pro
    if (rawPoints.length !== count && Math.abs(rawPoints.length - count) > count * 0.3 && usedModel !== "google/gemini-2.5-pro") {
      console.warn(`Flash returned ${rawPoints.length}/${count}, retrying with Pro...`);
      try {
        const retryRaw = await callAI(LOVABLE_API_KEY, "google/gemini-2.5-pro", messages, [tool], toolChoice, 0.05);
        const retryPoints = (retryRaw.points || []).map((p: any) => ({ x: Number(p.x), z: Number(p.z) })).filter((p: any) => !isNaN(p.x) && !isNaN(p.z));
        // Use retry if it's closer to target count
        if (Math.abs(retryPoints.length - count) < Math.abs(rawPoints.length - count)) {
          processedPoints = postProcess(retryPoints, count);
          if (previousFormation && Array.isArray(previousFormation) && previousFormation.length === processedPoints.length) {
            processedPoints = optimizeTransitionOrder(previousFormation, processedPoints);
          }
          raw = retryRaw;
          usedModel = "google/gemini-2.5-pro (retry)";
          console.log(`Retry succeeded: ${retryPoints.length} points`);
        }
      } catch { /* keep original result */ }
    }

    console.log(`Formation "${raw.formationName}": requested=${count}, raw=${rawPoints.length}, final=${processedPoints.length}, model=${usedModel}`);

    return new Response(JSON.stringify({
      points: processedPoints,
      formationName: raw.formationName || "AI Formation",
      suggestedHeight: Math.max(15, Math.min(80, raw.suggestedHeight || 25)),
      suggestedTransitionTime: Math.max(8, Math.min(30, raw.suggestedTransitionTime || 12)),
      rawPointCount: rawPoints.length,
      model: usedModel,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const status = e.status || 500;
    console.error("generate-formation error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
