import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ── Enhanced System Prompt (v3) ─────────────────────────────

const SYSTEM_PROMPT = `You are a world-class drone light show formation designer used by the largest professional pyrotechnics and drone show companies (Intel Shooting Star, Verge Aero, Dronisos, Celestial).

You output EXACT coordinates with mathematical precision and artistic vision.

ABSOLUTE RULES — VIOLATION = SHOW FAILURE:
1. Return EXACTLY N points where N is specified. COUNT your array before returning. If N=304, you MUST return 304 points.
2. Coordinates in meters, centered at (0,0). Typical range: -60 to +60 for small shows, -120 to +120 for large (>200 drones).
3. Minimum distance between ANY two points: 2.0 meters (FAA/ANAC safety regulation).
4. suggestedHeight: 15-80m based on formation complexity, drone count, and audience perspective.
5. suggestedTransitionTime: 8-30s based on maximum travel distance between formations.

MATHEMATICAL PRECISION RECIPES:

Circle(N, R): for i in 0..N-1: x = R·cos(2πi/N), z = R·sin(2πi/N)

Filled Circle(N, R): Use concentric rings. rings = ceil(sqrt(N/π)), points per ring k proportional to circumference.

Heart(N, R): for i in 0..N-1: t = 2πi/N
  x = R·sin³(t), z = R·(13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t))/16

Star(N, points=5, R):
  R_inner = R × 0.38, vertices = points*2
  Distribute N drones along the star perimeter proportionally.

Grid(N, spacing=2.5m): cols = ceil(√N), rows = ceil(N/cols)

Spiral(N, R, turns=3): for i in 0..N-1: t = i/(N-1), angle = 2π·turns·t
  x = t·R·cos(angle), z = t·R·sin(angle)

Text/Letters: Block font, 8-15 points per character. Width=6m, spacing=8m.
  For large N, use filled block letters with multiple rows of points per stroke.

Filled shapes: Concentric rings or scanline fill. Ring k at radius r_k gets round(N · 2πr_k / Σ2πr_j) points.

Complex shapes (animals, logos, national symbols): Decompose into line segments defining the outline. Sample N points along total perimeter, with higher density at important features (eyes, edges, corners).

Country flags: Use geometric decomposition. Stars = star formula. Stripes = horizontal lines. Diamonds = rotated squares. Colors should be specified.

Emoji: Map to most recognizable 2D outline. 🦋 = butterfly wings with body, 🏠 = house with roof, 🐬 = dolphin arc, 🎄 = layered triangle tree.

SVG path: Parse d="" path commands, sample N equidistant points along total arc length.

SCALING FORMULA: radius = max(10, min(70, sqrt(N) × 2.0))
For N > 200: radius = max(20, min(100, sqrt(N) × 2.5))

AUDIENCE PERSPECTIVE: Formations viewed from ground level looking UP. Design for maximum visual impact from below. Spread horizontally for readability. Use asymmetry thoughtfully. Consider that vertical details compress at viewing angle.

LARGE FORMATIONS (N > 100):
- Use filled shapes rather than outlines for visual density
- Increase spacing proportionally  
- Add internal detail/texture to large shapes
- Consider using multiple concentric layers

CRITICAL: The "points" array length MUST EQUAL N. Count every element. If you have 303 and need 304, add one more point.`;

// ── Full Show System Prompt (v3) ────────────────────────────

const FULL_SHOW_PROMPT = `You are a legendary drone show choreographer who has designed shows for Olympics ceremonies, World Cup openings, and national celebrations.

Given a theme and drone count, create a SPECTACULAR multi-formation show that tells a visual story.

SHOW STRUCTURE:
1. OPENING (1-2 formations): Start with something recognizable related to the theme. Build anticipation. Simple shapes that establish the visual language.
2. DEVELOPMENT (2-3 formations): Increase complexity. Explore different aspects of the theme. Show variety in shape types (outline, filled, text, symbols).
3. CLIMAX (1-2 formations): The most impressive, complex formation. Maximum visual impact. This is the "money shot."
4. FINALE (1 formation): Memorable closing. Often a symbol of unity, celebration, or the main theme icon. Should feel conclusive.

EACH FORMATION MUST:
1. Have EXACTLY N points (the drone count)
2. Have a distinct, recognizable shape related to the theme
3. Flow naturally from the previous formation (consider drone travel distances)
4. Include a meaningful color that enhances the narrative
5. Have appropriate timing: quick transitions for energy, slow for drama

COLOR PSYCHOLOGY:
- Red: passion, love, celebration, fire
- Blue: calm, sky, water, trust
- Green: nature, growth, hope
- Gold/Yellow: celebration, sun, wealth, achievement
- White: purity, stars, snow, peace
- Purple: royalty, mystery, magic
- Orange: warmth, sunset, autumn, energy
- Pink: love, youth, spring

TIMING GUIDELINES:
- Simple transition (same general area): 8-12s
- Complex transition (complete reshape): 12-20s  
- Dramatic reveal (slow build): 18-30s
- Hold duration: 10-25s (longer for complex shapes, shorter for simple)
- Total show: typically 2-5 minutes

THEME INTERPRETATION:
- "Aniversário" → cake, balloons, numbers, confetti, gifts, fireworks
- "Brasil" → flag, Christ Redeemer, Sugarloaf, toucan, soccer ball, Southern Cross
- "Réveillon" → fireworks, champagne, clock, numbers (year), stars
- "Casamento" → hearts, rings, doves, flowers, initials
- "Natal" → tree, star, snowflake, bell, gifts, Santa
- "Espaço" → rocket, planets, stars, constellation, astronaut
- "Natureza" → butterfly, flower, tree, wave, mountain

Always include the country/region's cultural symbols when relevant to the theme.`;

// ── Trajectory System Prompt (v3) ───────────────────────────

const TRAJECTORY_SYSTEM_PROMPT = `You are a drone choreography trajectory designer creating smooth, cinematic movement sequences for professional shows.

Given a description, generate phases of movement. Each phase has a name, duration, movement type, and intensity.

MOVEMENT VOCABULARY:
- "expand" / "contract": scale formation outward/inward from center
- "rotate": spin around Y axis (vertical)
- "wave": sinusoidal vertical oscillation with phase offset per drone
- "spiral": helical motion combining rotation and altitude change  
- "scatter": controlled random spread from formation
- "converge": gather to center point
- "pulse": rhythmic scale oscillation (breathing effect)
- "cascade": sequential movement rippling through drones (wave-like)
- "morph": interpolate between two shape definitions
- "orbit": circular path around a center point
- "bloom": flower-like opening pattern from center
- "rain": drones fall like raindrops with staggered timing
- "shimmer": subtle random position jitter for sparkle effect
- "firework": explosive outward burst then fade
- "helix": DNA-like double spiral motion

CHOREOGRAPHY PRINCIPLES:
1. Start subtle, build intensity
2. Vary pace: fast bursts + slow moments create drama
3. Sync to imagined music beats
4. Use contrasting movements (expand→contract, rise→fall)
5. End with a memorable flourish
6. Total duration typically 30-120 seconds

Design for audience viewing from ground level. Create 4-8 phases with smooth transitions.`;

// ── AI call with retry logic ────────────────────────────────

async function callAI(
  apiKey: string,
  model: string,
  messages: any[],
  tools: any[],
  toolChoice: any,
  temperature: number = 0.1,
  maxRetries: number = 2,
): Promise<any> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(GATEWAY, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          model, 
          messages, 
          tools, 
          tool_choice: toolChoice, 
          temperature: temperature + (attempt * 0.05), // slightly increase randomness on retry
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        if (response.status === 429) throw { status: 429, message: "Limite de requisições excedido. Tente novamente em alguns segundos." };
        if (response.status === 402) throw { status: 402, message: "Créditos esgotados. Adicione créditos no workspace." };
        console.error(`AI error (${model}, attempt ${attempt}):`, response.status, t);
        lastError = new Error(`Erro do modelo AI: ${response.status}`);
        
        // Don't retry on 4xx errors (except 429)
        if (response.status >= 400 && response.status < 500) {
          // Try with simplified schema on schema errors
          if (t.includes("too many states") || t.includes("schema")) {
            console.warn("Schema too complex, will try simplified version");
            throw { status: response.status, message: "Schema complexo demais", schemaError: true };
          }
          throw lastError;
        }
        continue;
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        // Try to extract from content if tool_calls missing
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          try {
            const parsed = JSON.parse(content);
            if (parsed.points || parsed.formations || parsed.phases) return parsed;
          } catch { /* not JSON */ }
        }
        lastError = new Error("Modelo não retornou dados estruturados");
        continue;
      }
      return JSON.parse(toolCall.function.arguments);
    } catch (e: any) {
      if (e.status === 429 || e.status === 402 || e.schemaError) throw e;
      lastError = e;
      if (attempt < maxRetries) {
        console.warn(`Attempt ${attempt + 1} failed, retrying...`);
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  
  throw lastError;
}

// ── Tool schemas (no minItems/maxItems to avoid schema explosion) ──

function buildFormationTool(count: number) {
  return {
    type: "function",
    function: {
      name: "create_formation",
      description: `Create a drone formation with EXACTLY ${count} points. The points array MUST contain exactly ${count} elements.`,
      parameters: {
        type: "object",
        properties: {
          points: {
            type: "array",
            description: `EXACTLY ${count} drone positions. You MUST return exactly ${count} points, no more, no less.`,
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
          formationName: { type: "string", description: "Short descriptive name for this formation" },
          suggestedHeight: { type: "number", description: "Suggested altitude in meters (15-80)" },
          suggestedTransitionTime: { type: "number", description: "Transition time in seconds (8-30)" },
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
      description: `Design a complete drone light show. Each formation MUST have EXACTLY ${count} points.`,
      parameters: {
        type: "object",
        properties: {
          showName: { type: "string", description: "Show title" },
          formations: {
            type: "array",
            description: `Sequence of 3-8 formations. Each MUST have exactly ${count} points.`,
            items: {
              type: "object",
              properties: {
                formationName: { type: "string", description: "Descriptive formation name" },
                points: {
                  type: "array",
                  description: `EXACTLY ${count} drone positions.`,
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
                color: { type: "string", description: "Hex color for drones e.g. #FF0000" },
                endColor: { type: "string", description: "End hex color for color transition effect" },
                colorTransition: { type: "string", description: "Color transition mode: linear, wave, pulse, rainbow, or instant" },
              },
              required: ["formationName", "points", "height", "transitionDuration", "holdDuration", "color"],
              additionalProperties: false,
            },
          },
          totalDuration: { type: "number", description: "Total show duration in seconds" },
          description: { type: "string", description: "Brief show description" },
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
                name: { type: "string", description: "Phase name" },
                duration: { type: "number", description: "Duration in seconds" },
                movement: { type: "string", description: "Movement type: expand, contract, rotate, wave, spiral, scatter, converge, pulse, cascade, morph, orbit, bloom, rain, shimmer, firework, helix, or hold" },
                intensity: { type: "number", description: "Intensity 0.0 to 1.0" },
                parameters: {
                  type: "object",
                  properties: {
                    axis: { type: "string", description: "Axis: x, y, z, or xz" },
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

// ── Post-processing (improved) ──────────────────────────────

function postProcess(
  points: { x: number; z: number }[],
  targetCount: number,
  minSpacing: number = 2.0,
): { x: number; z: number }[] {
  if (points.length === 0) {
    // Generate fallback grid if AI returned nothing
    console.warn("No points from AI, generating fallback grid");
    return generateFallbackGrid(targetCount, minSpacing);
  }

  // Center at origin
  let cx = 0, cz = 0;
  for (const p of points) { cx += p.x; cz += p.z; }
  cx /= points.length; cz /= points.length;
  let pts = points.map(p => ({ x: p.x - cx, z: p.z - cz }));

  // Adjust count: remove closest pairs or add midpoints
  if (pts.length > targetCount) {
    // Remove points that are closest to another point (least important)
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
    // Add points by subdividing longest edges
    while (pts.length < targetCount) {
      let maxDist = 0, bestI = 0, bestJ = 1;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z);
          if (d > maxDist) { maxDist = d; bestI = i; bestJ = j; }
        }
      }
      const jitter = () => (Math.random() - 0.5) * 0.3;
      pts.push({
        x: (pts[bestI].x + pts[bestJ].x) / 2 + jitter(),
        z: (pts[bestI].z + pts[bestJ].z) / 2 + jitter(),
      });
    }
  }

  // Enforce minimum spacing with improved relaxation
  for (let iter = 0; iter < 50; iter++) {
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

function generateFallbackGrid(count: number, spacing: number): { x: number; z: number }[] {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const pts: { x: number; z: number }[] = [];
  for (let r = 0; r < rows && pts.length < count; r++) {
    for (let c = 0; c < cols && pts.length < count; c++) {
      pts.push({
        x: (c - (cols - 1) / 2) * spacing,
        z: (r - (rows - 1) / 2) * spacing,
      });
    }
  }
  return pts;
}

// ── Transition optimizer (nearest-neighbor assignment) ───────

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
  const scaleHint = N > 200 ? `Use a radius of approximately ${Math.round(Math.sqrt(N) * 2.5)}m for good visibility.` : `Use a radius of approximately ${Math.round(Math.sqrt(N) * 2.0)}m.`;

  if (mode === "text") {
    return `Generate a drone formation with EXACTLY ${N} points. The "points" array MUST have exactly ${N} elements. ${scaleHint}

Shape: "${prompt}"

Use the mathematical recipes from your instructions. If the shape is an emoji, interpret its visual form and create a recognizable outline with ${N > 50 ? 'filled interior' : 'clear outline'} using ${N} drones. If it contains SVG path data, sample along the path. EXACTLY ${N} points. COUNT THEM.`;
  }
  if (mode === "image") {
    return `Generate a drone formation with EXACTLY ${N} points. ${scaleHint}

Analyze the uploaded image. Extract the main subject's outline/silhouette. Place EXACTLY ${N} drone points along the most recognizable contour edges at equal intervals. For filled areas, use scanline or concentric approaches. Focus on the primary shape, ignore background. EXACTLY ${N} points.`;
  }
  if (mode === "generative") {
    return `Generate a drone formation with EXACTLY ${N} points. ${scaleHint}

Create a visually stunning ${N > 100 ? 'filled' : ''} pattern for theme: "${prompt || 'abstract geometric'}"

Use mathematical beauty: golden ratio spirals, Fibonacci patterns, Lissajous curves, sacred geometry, fractals, or organic forms. Make it MEMORABLE, VISUALLY DENSE, and BEAUTIFUL from ground level. EXACTLY ${N} points.`;
  }
  if (mode === "full-show") {
    return `Design a complete drone light show with EXACTLY ${N} drones per formation. ${scaleHint}

Theme: "${prompt}"

Create 4-6 formations that tell a visual story related to the theme. Each formation MUST have exactly ${N} points in its points array. Include culturally appropriate colors and dramatic timing. Consider the narrative arc: opening → development → climax → finale. Every single formation must have exactly ${N} points. COUNT THEM.`;
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

// ── Model selection logic ───────────────────────────────────

function selectModel(mode: string, count: number, isFullShow: boolean): { primary: string; fallback: string } {
  // Use Flash for most things (faster, cheaper), Pro for complex/large
  if (isFullShow) {
    return { primary: "google/gemini-2.5-pro", fallback: "google/gemini-2.5-flash" };
  }
  if (mode === "image") {
    return { primary: "google/gemini-2.5-pro", fallback: "google/gemini-2.5-flash" };
  }
  if (mode === "generative" || count > 150) {
    return { primary: "google/gemini-2.5-pro", fallback: "google/gemini-2.5-flash" };
  }
  return { primary: "google/gemini-2.5-flash", fallback: "google/gemini-2.5-pro" };
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

      const { primary, fallback } = selectModel("full-show", count, true);
      let raw: any;
      let usedModel = primary;

      try {
        raw = await callAI(LOVABLE_API_KEY, primary, messages, [buildFullShowTool(count)], { type: "function", function: { name: "create_full_show" } }, 0.25);
      } catch (e: any) {
        if (e.status === 429 || e.status === 402) throw e;
        console.warn(`Full show primary model ${primary} failed, trying ${fallback}...`);
        usedModel = fallback;
        raw = await callAI(LOVABLE_API_KEY, fallback, messages, [buildFullShowTool(count)], { type: "function", function: { name: "create_full_show" } }, 0.25);
      }

      // Post-process each formation with transition optimization
      const formations = (raw.formations || []).map((f: any, idx: number) => {
        const prev = idx > 0
          ? (raw.formations[idx - 1].points || []).map((p: any) => ({ x: Number(p.x), z: Number(p.z) }))
          : null;
        const { points } = processFormationResult(f, count, prev);
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

      console.log(`Full show "${raw.showName}": ${formations.length} formations, ${count} drones each, model=${usedModel}`);

      return new Response(JSON.stringify({
        showName: raw.showName || "AI Show",
        formations,
        totalDuration: raw.totalDuration || formations.reduce((sum: number, f: any) => sum + f.transitionDuration + f.holdDuration, 0),
        description: raw.description || "",
        model: usedModel,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Trajectory generation ───────────────────────────────
    if (generateTrajectory) {
      const trajMessages = [
        { role: "system", content: TRAJECTORY_SYSTEM_PROMPT },
        { role: "user", content: `Create an epic drone choreography for ${count} drones: "${prompt}"\n\nDesign for maximum visual impact from ground level. Use contrasting movements. Build intensity toward a climax.` },
      ];

      let trajResult: any;
      try {
        trajResult = await callAI(LOVABLE_API_KEY, "google/gemini-2.5-flash", trajMessages, [buildTrajectoryTool()], { type: "function", function: { name: "create_trajectory_sequence" } }, 0.3);
      } catch (e: any) {
        if (e.status === 429 || e.status === 402) throw e;
        trajResult = await callAI(LOVABLE_API_KEY, "google/gemini-2.5-pro", trajMessages, [buildTrajectoryTool()], { type: "function", function: { name: "create_trajectory_sequence" } }, 0.3);
      }

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

    const { primary: primaryModel, fallback: fallbackModel } = selectModel(mode, count, false);
    let raw: any;
    let usedModel = primaryModel;

    try {
      raw = await callAI(LOVABLE_API_KEY, primaryModel, messages, [tool], toolChoice, 0.1);
    } catch (e: any) {
      if (e.status === 429 || e.status === 402) throw e;
      console.warn(`Primary model ${primaryModel} failed, trying ${fallbackModel}...`);
      raw = await callAI(LOVABLE_API_KEY, fallbackModel, messages, [tool], toolChoice, 0.1);
      usedModel = fallbackModel;
    }

    const { points: processedPoints, rawCount } = processFormationResult(raw, count, previousFormation);

    // Auto-retry with Pro if Flash result was very inaccurate
    if (rawCount !== count && Math.abs(rawCount - count) > count * 0.3 && usedModel !== "google/gemini-2.5-pro") {
      console.warn(`${usedModel} returned ${rawCount}/${count}, retrying with Pro...`);
      try {
        const retryRaw = await callAI(LOVABLE_API_KEY, "google/gemini-2.5-pro", messages, [tool], toolChoice, 0.05);
        const retryResult = processFormationResult(retryRaw, count, previousFormation);
        if (Math.abs(retryResult.rawCount - count) < Math.abs(rawCount - count)) {
          console.log(`Pro retry succeeded: ${retryResult.rawCount}/${count} points`);
          return new Response(JSON.stringify({
            points: retryResult.points,
            formationName: retryRaw.formationName || "AI Formation",
            suggestedHeight: Math.max(15, Math.min(80, retryRaw.suggestedHeight || 25)),
            suggestedTransitionTime: Math.max(8, Math.min(30, retryRaw.suggestedTransitionTime || 12)),
            rawPointCount: retryResult.rawCount,
            model: "google/gemini-2.5-pro (retry)",
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch { /* keep original result */ }
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
