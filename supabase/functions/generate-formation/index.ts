import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ── Enhanced System Prompt ──────────────────────────────────

const SYSTEM_PROMPT = `You are an expert drone light show formation designer used by professional pyrotechnics companies. You output EXACT coordinates with mathematical precision.

ABSOLUTE RULES — VIOLATION = FAILURE:
1. Return EXACTLY N points where N is specified. COUNT your array before returning.
2. Coordinates in meters, centered at (0,0). Typical range: -60 to +60.
3. Minimum distance between ANY two points: 2.0 meters (FAA safety).
4. suggestedHeight: 15-80m based on formation complexity and audience perspective.
5. suggestedTransitionTime: 8-30s based on distance from previous formation.

MATHEMATICAL PRECISION RECIPES:

Circle(N, R):
  for i in 0..N-1: x = R·cos(2πi/N), z = R·sin(2πi/N)

Heart(N, R):
  for i in 0..N-1: t = 2πi/N
    x = R·sin³(t), z = R·(13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t))/16

Star(N, points=5):
  R_inner = R × 0.38
  for i in 0..N-1: angle = 2πi/N - π/2
    r = R if (i·10/N)%2 < 1 else R_inner
    x = r·cos(angle), z = r·sin(angle)

Grid(N, spacing=2.5m):
  cols = ceil(√N), rows = ceil(N/cols)
  for r,c in grid: x = (c - (cols-1)/2)·spacing, z = (r - (rows-1)/2)·spacing

Spiral(N, R, turns=3):
  for i in 0..N-1: t = i/N, angle = 2π·turns·t
    x = t·R·cos(angle), z = t·R·sin(angle)

Text/Letters: Use block font approach with 8-15 points per character. Letter width=6m, spacing=8m. Total MUST = N.

Filled shapes: Use concentric rings. Ring k at radius r_k has round(N · 2πr_k / Σ2πr_j) points.

Complex shapes (animals, logos, objects): Decompose into line segments. Sample N points proportionally along total perimeter.

Emoji interpretation: Map the emoji to its most recognizable 2D outline. 🦋 = butterfly wings, 🏠 = house outline, 🐬 = dolphin arc, etc.

SVG path data: If user provides d="..." path data, parse the path commands and sample N equidistant points along total arc length.

SCALING: radius = max(8, min(55, sqrt(N) × 1.8))

AUDIENCE PERSPECTIVE: Formations are viewed from ground level looking UP. Design for visual impact from below — spread horizontally, use asymmetry thoughtfully.

CRITICAL: The "points" array length MUST EQUAL the requested count. Triple-check before responding.`;

// ── Full Show System Prompt ─────────────────────────────────

const FULL_SHOW_PROMPT = `You are a professional drone light show choreographer. Design complete multi-formation shows.

Given a theme/description and drone count, create a sequence of 3-8 formations that tell a visual story.

Each formation should:
1. Have a distinct shape that relates to the theme
2. Flow naturally from the previous formation
3. Include color suggestions that enhance the narrative
4. Have appropriate timing (transition + hold durations)

Think about:
- Opening: Start simple, build anticipation
- Development: Increase complexity, use the theme
- Climax: Most impressive/complex formation
- Finale: Memorable closing formation, often circular or expanding

For colors, use hex codes. Consider color psychology and cultural associations.
For timing, vary the pace: some quick transitions for energy, some slow for drama.`;

// ── Trajectory System Prompt ────────────────────────────────

const TRAJECTORY_SYSTEM_PROMPT = `You are a drone choreography trajectory designer creating smooth, cinematic movement sequences.

Given a description, generate phases of movement. Each phase has a name, duration, movement type, and intensity.

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
- "rain": drones fall like raindrops with staggered timing

Design for audience viewing from ground level. Create 4-8 phases with smooth transitions.`;

// ── AI call ─────────────────────────────────────────────────

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
    if (response.status === 429) throw { status: 429, message: "Limite de requisições excedido. Tente novamente em alguns segundos." };
    if (response.status === 402) throw { status: 402, message: "Créditos esgotados. Adicione créditos no workspace." };
    const t = await response.text();
    console.error(`AI error (${model}):`, response.status, t);
    throw new Error(`Erro do modelo AI: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("Modelo não retornou dados estruturados");
  return JSON.parse(toolCall.function.arguments);
}

// ── Tool schemas ────────────────────────────────────────────

function buildFormationTool(count: number) {
  return {
    type: "function",
    function: {
      name: "create_formation",
      description: `Create a drone formation with EXACTLY ${count} points.`,
      parameters: {
        type: "object",
        properties: {
          points: {
            type: "array",
            description: `EXACTLY ${count} drone positions. The array MUST contain exactly ${count} elements.`,
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
          suggestedHeight: { type: "number", description: "Altitude 15-80m" },
          suggestedTransitionTime: { type: "number", description: "Transition time 8-30s" },
        },
        required: ["points", "formationName", "suggestedHeight", "suggestedTransitionTime"],
        additionalProperties: false,
      },
    },
  };
}

function buildFullShowTool(count: number) {
  return {
    type: "function",
    function: {
      name: "create_full_show",
      description: `Design a complete drone light show with multiple formations, each using EXACTLY ${count} drones.`,
      parameters: {
        type: "object",
        properties: {
          showName: { type: "string", description: "Show title" },
          formations: {
            type: "array",
            description: "Sequence of 3-8 formations",
            items: {
              type: "object",
              properties: {
                formationName: { type: "string" },
                points: {
                  type: "array",
                  description: `EXACTLY ${count} points per formation.`,
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
                height: { type: "number", description: "Altitude 15-80m" },
                transitionDuration: { type: "number", description: "Transition time in seconds" },
                holdDuration: { type: "number", description: "Hold time in seconds" },
                color: { type: "string", description: "Hex color for drones" },
                endColor: { type: "string", description: "End hex color (for color transition)" },
                colorTransition: { type: "string", enum: ["linear", "wave", "pulse", "rainbow", "instant"] },
              },
              required: ["formationName", "points", "height", "transitionDuration", "holdDuration", "color"],
              additionalProperties: false,
            },
          },
          totalDuration: { type: "number" },
          description: { type: "string" },
        },
        required: ["showName", "formations", "totalDuration", "description"],
        additionalProperties: false,
      },
    },
  };
}

function buildTrajectoryTool() {
  return {
    type: "function",
    function: {
      name: "create_trajectory_sequence",
      description: "Create a choreography sequence of movement phases.",
      parameters: {
        type: "object",
        properties: {
          phases: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                duration: { type: "number" },
                movement: { type: "string", enum: ["expand", "contract", "rotate", "wave", "spiral", "scatter", "converge", "pulse", "cascade", "morph", "orbit", "bloom", "rain", "hold", "custom"] },
                intensity: { type: "number", description: "0-1" },
                parameters: {
                  type: "object",
                  properties: {
                    axis: { type: "string", enum: ["x", "y", "z", "xz"] },
                    speed: { type: "number" },
                    scale: { type: "number" },
                    offset: { type: "number" },
                    targetFormation: { type: "string" },
                  },
                  additionalProperties: false,
                },
              },
              required: ["name", "duration", "movement", "intensity"],
              additionalProperties: false,
            },
          },
          totalDuration: { type: "number" },
          description: { type: "string" },
        },
        required: ["phases", "totalDuration", "description"],
        additionalProperties: false,
      },
    },
  };
}

// ── Post-processing ─────────────────────────────────────────

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

  // Adjust count
  if (pts.length > targetCount) {
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

// ── Build user message ──────────────────────────────────────

function buildUserMessage(mode: string, prompt: string, droneCount: number): string {
  const N = droneCount;
  const base = `Generate a drone formation with EXACTLY ${N} points. The "points" array MUST have exactly ${N} elements.`;

  if (mode === "text") {
    return `${base}\n\nShape: "${prompt}"\n\nUse the mathematical recipes from your instructions. If the shape is an emoji, interpret its visual form. If it contains SVG path data, sample along the path. EXACTLY ${N} points.`;
  }
  if (mode === "image") {
    return `${base}\n\nAnalyze the uploaded image. Extract the main subject's outline/silhouette. Place EXACTLY ${N} drone points along the most recognizable contour edges at equal intervals. Focus on the primary shape, ignore background.`;
  }
  if (mode === "generative") {
    return `${base}\n\nCreate a visually stunning pattern for theme: "${prompt || 'abstract geometric'}"\n\nUse mathematical beauty: golden ratio spirals, Fibonacci patterns, Lissajous curves, sacred geometry, fractals, or organic forms. Make it MEMORABLE and SYMMETRICAL. EXACTLY ${N} points.`;
  }
  if (mode === "full-show") {
    return `Design a complete drone light show with EXACTLY ${N} drones per formation.\n\nTheme: "${prompt}"\n\nCreate 4-6 formations that tell a visual story. Each formation MUST have exactly ${N} points. Include colors and timing that match the theme. Consider audience perspective from below.`;
  }
  throw new Error(`Invalid mode: ${mode}`);
}

// ── Process single formation result ─────────────────────────

function processFormationResult(
  raw: any,
  count: number,
  previousFormation?: { x: number; z: number }[],
): { points: { x: number; z: number }[]; rawCount: number } {
  const rawPoints = (raw.points || [])
    .map((p: any) => ({ x: Number(p.x), z: Number(p.z) }))
    .filter((p: any) => !isNaN(p.x) && !isNaN(p.z));

  let processedPoints = postProcess(rawPoints, count);

  if (previousFormation && previousFormation.length === processedPoints.length) {
    processedPoints = optimizeTransitionOrder(previousFormation, processedPoints);
  }

  return { points: processedPoints, rawCount: rawPoints.length };
}

// ── Main handler ────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { mode, prompt, droneCount, imageBase64, previousFormation, generateTrajectory, generateFullShow } = await req.json();
    const count = droneCount || 24;

    // ── Full Show generation ────────────────────────────────
    if (generateFullShow) {
      const userMsg = buildUserMessage("full-show", prompt, count);
      const messages = [
        { role: "system", content: FULL_SHOW_PROMPT + "\n\n" + SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ];

      const raw = await callAI(
        LOVABLE_API_KEY,
        "google/gemini-2.5-pro",
        messages,
        [buildFullShowTool(count)],
        { type: "function", function: { name: "create_full_show" } },
        0.3,
      );

      // Post-process each formation
      const formations = (raw.formations || []).map((f: any, idx: number) => {
        const prev = idx > 0 ? raw.formations[idx - 1].points : null;
        const { points } = processFormationResult(f, count, prev?.map((p: any) => ({ x: Number(p.x), z: Number(p.z) })));
        return {
          formationName: f.formationName || `Formation ${idx + 1}`,
          points,
          height: Math.max(15, Math.min(80, f.height || 25)),
          transitionDuration: Math.max(5, Math.min(30, f.transitionDuration || 12)),
          holdDuration: Math.max(5, Math.min(60, f.holdDuration || 15)),
          color: f.color || '#00B4D8',
          endColor: f.endColor || undefined,
          colorTransition: f.colorTransition || 'linear',
        };
      });

      console.log(`Full show "${raw.showName}": ${formations.length} formations, ${count} drones each`);

      return new Response(JSON.stringify({
        showName: raw.showName || "AI Show",
        formations,
        totalDuration: raw.totalDuration || formations.reduce((sum: number, f: any) => sum + f.transitionDuration + f.holdDuration, 0),
        description: raw.description || "",
        model: "google/gemini-2.5-pro",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Trajectory generation ───────────────────────────────
    if (generateTrajectory) {
      const trajMessages = [
        { role: "system", content: TRAJECTORY_SYSTEM_PROMPT },
        { role: "user", content: `Create a drone choreography for ${count} drones: "${prompt}"\n\nMake it visually stunning with smooth transitions. Design for ground-level audience.` },
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

    // ── Single Formation generation ─────────────────────────
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

    // Model selection
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
      if (e.status === 429 || e.status === 402) throw e;
      console.warn(`Primary model ${primaryModel} failed, trying fallback...`);
      const fallback = primaryModel === "google/gemini-2.5-pro" ? "google/gemini-2.5-flash" : "google/gemini-2.5-pro";
      raw = await callAI(LOVABLE_API_KEY, fallback, messages, [tool], toolChoice, 0.1);
      usedModel = fallback;
    }

    const { points: processedPoints, rawCount } = processFormationResult(raw, count, previousFormation);

    // Auto-retry with Pro if Flash was far off
    if (rawCount !== count && Math.abs(rawCount - count) > count * 0.3 && usedModel !== "google/gemini-2.5-pro") {
      console.warn(`Flash returned ${rawCount}/${count}, retrying with Pro...`);
      try {
        const retryRaw = await callAI(LOVABLE_API_KEY, "google/gemini-2.5-pro", messages, [tool], toolChoice, 0.05);
        const retryResult = processFormationResult(retryRaw, count, previousFormation);
        if (Math.abs(retryResult.rawCount - count) < Math.abs(rawCount - count)) {
          const result = retryResult;
          raw = retryRaw;
          usedModel = "google/gemini-2.5-pro (retry)";
          console.log(`Retry succeeded: ${retryResult.rawCount} points`);
          return new Response(JSON.stringify({
            points: result.points,
            formationName: retryRaw.formationName || "AI Formation",
            suggestedHeight: Math.max(15, Math.min(80, retryRaw.suggestedHeight || 25)),
            suggestedTransitionTime: Math.max(8, Math.min(30, retryRaw.suggestedTransitionTime || 12)),
            rawPointCount: retryResult.rawCount,
            model: usedModel,
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch { /* keep original */ }
    }

    console.log(`Formation "${raw.formationName}": requested=${count}, raw=${rawCount}, final=${processedPoints.length}, model=${usedModel}`);

    return new Response(JSON.stringify({
      points: processedPoints,
      formationName: raw.formationName || "AI Formation",
      suggestedHeight: Math.max(15, Math.min(80, raw.suggestedHeight || 25)),
      suggestedTransitionTime: Math.max(8, Math.min(30, raw.suggestedTransitionTime || 12)),
      rawPointCount: rawCount,
      model: usedModel,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const status = e.status || 500;
    console.error("generate-formation error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro desconhecido" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
