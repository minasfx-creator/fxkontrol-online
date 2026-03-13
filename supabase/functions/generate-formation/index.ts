import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ── v4 System Prompt: Formation Designer ────────────────────

const SYSTEM_PROMPT = `You are a world-class drone light show formation designer. You output EXACT coordinates with mathematical precision.

RULES (VIOLATION = SHOW FAILURE):
1. Return EXACTLY N points (N specified per request). COUNT your array.
2. Coordinates in meters, centered at (0,0).
3. Minimum distance between ANY two points: 2.0m (safety regulation).
4. suggestedHeight: 20-80m. suggestedTransitionTime: 8-25s.

MATHEMATICAL RECIPES (USE THESE — don't improvise formulas):

Circle(N, R): x=R·cos(2πi/N), z=R·sin(2πi/N)
Filled Circle(N, R): concentric rings, ring k radius rk=R·(k+1)/K, points per ring proportional to 2π·rk
Heart(N, R): t=2πi/N → x=R·sin³(t)·0.8, z=R·(13cos(t)−5cos(2t)−2cos(3t)−cos(4t))/16
Star5(N, R): outer=R, inner=R×0.38, alternate vertices, distribute N along perimeter
Spiral(N, R, turns=3): t=i/(N−1), angle=2π·turns·t, x=t·R·cos(angle), z=t·R·sin(angle)
Grid(N, sp=2.5): cols=ceil(√N), center at origin
Text: 5×7 dot matrix per char, spacing=8m, scale to fit N drones
Diamond: 4 sides of rotated square, N/4 per side
Cross: horizontal + vertical bars, thickness=2 points
Wave: x spread linearly, z=A·sin(2π·x/wavelength)
Butterfly: two heart-like wings mirrored, thin body center line
Arrow: triangle tip + rectangular tail
Flag BR: green rectangle, yellow diamond, blue circle, white band with stars

EMOJI → SHAPE MAP:
⭐→Star5  ❤️→Heart  🌙→Crescent(thick arc)  🦋→Butterfly  🔔→Bell(parabola+top)  
🎄→LayeredTriangles  🎵→MusicNote(circle+stem+flag)  ✝️→Cross  ☮️→PeaceSign(circle+lines)  
♾️→Lemniscate  🏠→House(square+triangle roof)  🐬→DolphinArc  🎆→RadialBurst(concentric)
🌍→Circle  🚀→Rocket(cylinder+cone+fins)  ⚽→Circle  💎→Diamond  🎂→CakeLayers

SCALING: radius = clamp(sqrt(N)*2.2, 12, 150)
For N>200: Use FILLED shapes (concentric/scanline), not just outlines.
For N>500: Increase density, use multiple concentric layers. radius ~ sqrt(N)*2.5
For N>1000: Large-scale show. radius ~ sqrt(N)*3.0, use dense fill patterns.

CRITICAL: Your "points" array must have EXACTLY N elements. If you're unsure, use the mathematical formula and compute each point.`;

// ── v4 Full Show Prompt ─────────────────────────────────────

const FULL_SHOW_PROMPT = `You are a legendary drone show choreographer designing spectacular multi-formation shows.

SHOW STRUCTURE (4-7 formations):
1. OPENING: Simple, recognizable shape. Build anticipation. (hold: 12-18s)
2. DEVELOPMENT: 2-3 formations increasing complexity. Explore theme. (hold: 15-20s each)
3. CLIMAX: Most impressive formation. Maximum visual impact. (hold: 20-30s)
4. FINALE: Memorable closing symbol. Conclusive feel. (hold: 15-20s)

EACH FORMATION MUST have EXACTLY N points (N = drone count).

COLOR NARRATIVE (use colors that enhance the story):
Red=#FF2020 passion/fire  Blue=#2080FF calm/sky  Green=#20CC40 nature  
Gold=#FFD700 celebration  White=#FFFFFF stars/purity  Purple=#AA44FF magic  
Orange=#FF8800 energy  Pink=#FF66AA love/youth  Cyan=#00E5FF technology

TIMING:
- transitionDuration: 8-20s (longer = more dramatic)
- holdDuration: 12-25s (longer for complex shapes)
- Use colorTransition: "wave" for water/flow themes, "pulse" for energy, "rainbow" for celebration

THEME RECIPES:
"Aniversário/Birthday" → 🎂Cake → 🎈Balloons/Numbers → 🎆Firework → ⭐Star
"Brasil" → 🇧🇷Flag → ✝️ChristRedeemer → ⚽Ball → ⭐SouthernCross
"Réveillon/NewYear" → 🕐Clock → Numbers(year) → 🎆Firework → ⭐StarBurst
"Casamento/Wedding" → ❤️Heart → 💍Rings → 🕊️Dove → ❤️DoubleHeart
"Natal/Christmas" → 🎄Tree → ⭐Star → 🔔Bell → ❄️Snowflake
"Espaço/Space" → 🚀Rocket → 🪐Planet → 🌌Galaxy → ⭐Constellation

IMPORTANT: Every formation's "points" array MUST have exactly N elements.`;

// ── v4 Trajectory Prompt ────────────────────────────────────

const TRAJECTORY_SYSTEM_PROMPT = `You design drone movement choreography as a sequence of phases.

MOVEMENT TYPES:
expand/contract: scale outward/inward from center
rotate: spin around Y axis
wave: sinusoidal vertical oscillation with phase offset
spiral: helical motion (rotation + altitude)
pulse: rhythmic scale oscillation (breathing)
cascade: sequential ripple through formation
bloom: flower opening from center
shimmer: subtle random jitter for sparkle
firework: explosive outward burst
converge/scatter: gather to or spread from center
orbit: circular path around center

PRINCIPLES:
1. Start subtle, build to climax, resolve
2. Alternate fast/slow for drama
3. Use contrasting movements (expand→contract, rise→fall)
4. 4-8 phases, total 30-90 seconds`;

// ── AI call with retry + model fallback ─────────────────────

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
          temperature: temperature + (attempt * 0.03),
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        if (response.status === 429) throw { status: 429, message: "Limite de requisições excedido. Tente novamente em alguns segundos." };
        if (response.status === 402) throw { status: 402, message: "Créditos esgotados. Adicione créditos no workspace." };
        console.error(`AI error (${model}, attempt ${attempt}):`, response.status, t);
        lastError = new Error(`Erro do modelo AI: ${response.status}`);
        if (response.status >= 400 && response.status < 500) throw lastError;
        continue;
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
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
      if (e.status === 429 || e.status === 402) throw e;
      lastError = e;
      if (attempt < maxRetries) {
        console.warn(`Attempt ${attempt + 1} failed, retrying...`);
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  
  throw lastError;
}

// ── Tool schemas (lightweight - no minItems/maxItems) ────────

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
            description: `EXACTLY ${count} drone positions (x,z in meters).`,
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
          suggestedHeight: { type: "number", description: "Altitude 20-80m" },
          suggestedTransitionTime: { type: "number", description: "Seconds 8-25" },
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
      description: `Design a complete drone show. Each formation MUST have EXACTLY ${count} points.`,
      parameters: {
        type: "object",
        properties: {
          showName: { type: "string" },
          formations: {
            type: "array",
            description: `4-7 formations, each with exactly ${count} points.`,
            items: {
              type: "object",
              properties: {
                formationName: { type: "string" },
                points: {
                  type: "array",
                  description: `EXACTLY ${count} points.`,
                  items: {
                    type: "object",
                    properties: { x: { type: "number" }, z: { type: "number" } },
                    required: ["x", "z"],
                    additionalProperties: false,
                  },
                },
                height: { type: "number" },
                transitionDuration: { type: "number" },
                holdDuration: { type: "number" },
                color: { type: "string" },
                endColor: { type: "string" },
                colorTransition: { type: "string", description: "linear, wave, pulse, rainbow, or instant" },
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
                movement: { type: "string", description: "expand, contract, rotate, wave, spiral, scatter, converge, pulse, cascade, bloom, shimmer, firework, helix, orbit, rain, or hold" },
                intensity: { type: "number", description: "0.0 to 1.0" },
                parameters: {
                  type: "object",
                  properties: {
                    axis: { type: "string" },
                    speed: { type: "number" },
                    scale: { type: "number" },
                    offset: { type: "number" },
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

// ── Hybrid generation: AI describes shape, server computes points ──

interface ShapeDescription {
  shapeType: string;
  params: Record<string, number>;
  formationName: string;
  suggestedHeight: number;
  suggestedTransitionTime: number;
}

function buildShapeDescriptorTool() {
  return {
    type: "function",
    function: {
      name: "describe_shape",
      description: "Describe the shape mathematically. The server will compute exact coordinates.",
      parameters: {
        type: "object",
        properties: {
          shapeType: { 
            type: "string", 
            description: "One of: circle, filled_circle, heart, star, spiral, grid, diamond, cross, wave, butterfly, arrow, crescent, ring, lemniscate, text, radial_burst, layered_triangles, house, music_note, peace_sign, rocket, cake, custom_outline" 
          },
          params: {
            type: "object",
            description: "Shape parameters: radius, innerRadius, turns, thickness, text, armLength, layers, points (for star), wavelength, amplitude, angle, rows, cols, spacing",
            properties: {
              radius: { type: "number" },
              innerRadius: { type: "number" },
              turns: { type: "number" },
              thickness: { type: "number" },
              text: { type: "string" },
              armLength: { type: "number" },
              layers: { type: "number" },
              starPoints: { type: "number" },
              wavelength: { type: "number" },
              amplitude: { type: "number" },
              angle: { type: "number" },
            },
            additionalProperties: false,
          },
          outlinePoints: {
            type: "array",
            description: "For custom_outline: 10-40 key vertices defining the shape outline. Server will interpolate N points along this path.",
            items: {
              type: "object",
              properties: { x: { type: "number" }, z: { type: "number" } },
              required: ["x", "z"],
              additionalProperties: false,
            },
          },
          formationName: { type: "string" },
          suggestedHeight: { type: "number" },
          suggestedTransitionTime: { type: "number" },
        },
        required: ["shapeType", "params", "formationName", "suggestedHeight", "suggestedTransitionTime"],
        additionalProperties: false,
      },
    },
  };
}

const SHAPE_DESCRIPTOR_PROMPT = `You are a drone formation shape interpreter. Given a description, identify the BEST matching shape type and parameters. The server will compute the exact drone positions.

Available shape types and their key params:
- circle: radius
- filled_circle: radius
- heart: radius
- star: radius, starPoints (default 5), innerRadius (default radius*0.38)
- spiral: radius, turns (default 3)
- grid: radius (used as total size)
- diamond: radius
- cross: radius, thickness (default 2)
- wave: radius (width), amplitude, wavelength
- butterfly: radius
- arrow: radius
- crescent: radius, innerRadius (default radius*0.7)
- ring: radius, innerRadius
- lemniscate: radius (infinity symbol)
- text: radius, text (the text string)
- radial_burst: radius, layers (default 3)
- layered_triangles: radius, layers (default 3) — Christmas tree shape
- house: radius
- music_note: radius
- peace_sign: radius
- rocket: radius
- cake: radius, layers (default 3)
- custom_outline: provide outlinePoints (10-40 key vertices) for any shape not listed above

SCALING: radius = clamp(sqrt(N)*2.2, 12, 90) where N is drone count.

For emojis: map to the closest shape type. 
For complex/unknown shapes: use custom_outline with 15-30 key vertices tracing the recognizable outline.
For text strings: use type="text" with params.text set to the string.`;

// ── Server-side shape generators ────────────────────────────

function generateShapePoints(
  shapeType: string, 
  count: number, 
  params: Record<string, number | string>,
  outlinePoints?: { x: number; z: number }[],
): { x: number; z: number }[] {
  const R = Number(params.radius) || Math.max(12, Math.min(90, Math.sqrt(count) * 2.2));
  
  switch (shapeType) {
    case 'circle': return genCircle(count, R);
    case 'filled_circle': return genFilledCircle(count, R);
    case 'heart': return genHeart(count, R);
    case 'star': return genStar(count, R, Number(params.starPoints) || 5, Number(params.innerRadius) || R * 0.38);
    case 'spiral': return genSpiral(count, R, Number(params.turns) || 3);
    case 'grid': return genGrid(count, R);
    case 'diamond': return genDiamond(count, R);
    case 'cross': return genCross(count, R, Number(params.thickness) || 2);
    case 'wave': return genWave(count, R, Number(params.amplitude) || R * 0.3, Number(params.wavelength) || R);
    case 'butterfly': return genButterfly(count, R);
    case 'arrow': return genArrow(count, R);
    case 'crescent': return genCrescent(count, R, Number(params.innerRadius) || R * 0.7);
    case 'ring': return genRing(count, R, Number(params.innerRadius) || R * 0.6);
    case 'lemniscate': return genLemniscate(count, R);
    case 'radial_burst': return genRadialBurst(count, R, Number(params.layers) || 3);
    case 'layered_triangles': return genLayeredTriangles(count, R, Number(params.layers) || 3);
    case 'house': return genHouse(count, R);
    case 'music_note': return genMusicNote(count, R);
    case 'peace_sign': return genPeaceSign(count, R);
    case 'rocket': return genRocket(count, R);
    case 'cake': return genCake(count, R, Number(params.layers) || 3);
    case 'text': return genText(count, R, String(params.text || 'A'));
    case 'custom_outline': return outlinePoints?.length ? genFromOutline(count, outlinePoints) : genFilledCircle(count, R);
    default: return genFilledCircle(count, R);
  }
}

function genCircle(n: number, R: number): { x: number; z: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return { x: R * Math.cos(a), z: R * Math.sin(a) };
  });
}

function genFilledCircle(n: number, R: number): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  const rings = Math.max(2, Math.ceil(Math.sqrt(n / Math.PI)));
  // Center point
  pts.push({ x: 0, z: 0 });
  let remaining = n - 1;
  for (let k = 1; k <= rings && remaining > 0; k++) {
    const r = (R * k) / rings;
    const circumference = 2 * Math.PI * r;
    const pointsInRing = Math.min(remaining, Math.max(6, Math.round(circumference / 2.2)));
    for (let i = 0; i < pointsInRing; i++) {
      const a = (2 * Math.PI * i) / pointsInRing;
      pts.push({ x: r * Math.cos(a), z: r * Math.sin(a) });
    }
    remaining -= pointsInRing;
  }
  // Fill any remaining with extra ring
  while (pts.length < n) {
    const a = (2 * Math.PI * (pts.length - 1)) / Math.max(1, n - pts.length);
    const r = R * (0.3 + Math.random() * 0.7);
    pts.push({ x: r * Math.cos(a), z: r * Math.sin(a) });
  }
  return pts.slice(0, n);
}

function genHeart(n: number, R: number): { x: number; z: number }[] {
  if (n <= 80) {
    // Outline only
    return Array.from({ length: n }, (_, i) => {
      const t = (2 * Math.PI * i) / n;
      return {
        x: R * 0.8 * Math.pow(Math.sin(t), 3),
        z: -R * (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) / 16,
      };
    });
  }
  // Filled heart for large counts
  const pts: { x: number; z: number }[] = [];
  const layers = Math.ceil(n / 40);
  for (let layer = layers; layer >= 1; layer--) {
    const scale = layer / layers;
    const r = R * scale;
    const perLayer = Math.round(n * scale / layers);
    for (let i = 0; i < perLayer && pts.length < n; i++) {
      const t = (2 * Math.PI * i) / perLayer;
      pts.push({
        x: r * 0.8 * Math.pow(Math.sin(t), 3),
        z: -r * (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) / 16,
      });
    }
  }
  while (pts.length < n) {
    const t = (2 * Math.PI * pts.length) / n;
    const r = R * 0.3;
    pts.push({ x: r * 0.8 * Math.pow(Math.sin(t), 3), z: -r * (13 * Math.cos(t)) / 16 });
  }
  return pts.slice(0, n);
}

function genStar(n: number, R: number, points: number, innerR: number): { x: number; z: number }[] {
  const vertices = points * 2;
  // Generate star outline vertices
  const starVerts: { x: number; z: number }[] = [];
  for (let i = 0; i < vertices; i++) {
    const angle = (Math.PI * 2 * i) / vertices - Math.PI / 2;
    const r = i % 2 === 0 ? R : innerR;
    starVerts.push({ x: r * Math.cos(angle), z: r * Math.sin(angle) });
  }
  // Distribute n points along star perimeter
  return distributeAlongPath(n, starVerts, true);
}

function genSpiral(n: number, R: number, turns: number): { x: number; z: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const angle = 2 * Math.PI * turns * t;
    const r = t * R;
    return { x: r * Math.cos(angle), z: r * Math.sin(angle) };
  });
}

function genGrid(n: number, R: number): { x: number; z: number }[] {
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const sp = (R * 2) / Math.max(cols - 1, 1);
  const pts: { x: number; z: number }[] = [];
  for (let r = 0; r < rows && pts.length < n; r++) {
    for (let c = 0; c < cols && pts.length < n; c++) {
      pts.push({ x: (c - (cols - 1) / 2) * sp, z: (r - (rows - 1) / 2) * sp });
    }
  }
  return pts;
}

function genDiamond(n: number, R: number): { x: number; z: number }[] {
  const corners = [{ x: 0, z: -R }, { x: R, z: 0 }, { x: 0, z: R }, { x: -R, z: 0 }];
  return distributeAlongPath(n, corners, true);
}

function genCross(n: number, R: number, thickness: number): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  const halfH = Math.floor(n * 0.5);
  const halfV = n - halfH;
  // Horizontal bar
  for (let i = 0; i < halfH; i++) {
    const t = i / halfH;
    const x = (t - 0.5) * R * 2;
    const z = ((i % 2) * 2 - 1) * thickness * 0.3;
    pts.push({ x, z });
  }
  // Vertical bar
  for (let i = 0; i < halfV; i++) {
    const t = i / halfV;
    const z = (t - 0.5) * R * 2;
    const x = ((i % 2) * 2 - 1) * thickness * 0.3;
    if (Math.abs(z) > thickness * 0.5 || Math.abs(x) > thickness * 0.5) {
      pts.push({ x, z });
    } else {
      pts.push({ x: ((i % 3) - 1) * thickness * 0.5, z });
    }
  }
  while (pts.length < n) pts.push({ x: (Math.random() - 0.5) * 2, z: (Math.random() - 0.5) * 2 });
  return pts.slice(0, n);
}

function genWave(n: number, R: number, amp: number, wl: number): { x: number; z: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const x = (t - 0.5) * R * 2;
    return { x, z: amp * Math.sin(2 * Math.PI * x / wl) };
  });
}

function genButterfly(n: number, R: number): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  const wingN = Math.floor(n * 0.45);
  const bodyN = n - wingN * 2;
  // Right wing (heart-like)
  for (let i = 0; i < wingN; i++) {
    const t = (Math.PI * i) / wingN;
    const r = R * 0.7;
    pts.push({ x: Math.abs(r * 0.8 * Math.pow(Math.sin(t), 3)) + R * 0.1, z: -r * (Math.cos(t) * 0.8) });
  }
  // Left wing (mirrored)
  for (let i = 0; i < wingN; i++) {
    const t = (Math.PI * i) / wingN;
    const r = R * 0.7;
    pts.push({ x: -(Math.abs(r * 0.8 * Math.pow(Math.sin(t), 3)) + R * 0.1), z: -r * (Math.cos(t) * 0.8) });
  }
  // Body
  for (let i = 0; i < bodyN; i++) {
    const t = i / (bodyN - 1);
    pts.push({ x: 0, z: (t - 0.5) * R * 1.2 });
  }
  return pts.slice(0, n);
}

function genArrow(n: number, R: number): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  const tipN = Math.floor(n * 0.4);
  const tailN = n - tipN;
  // Arrow tip (triangle)
  const tipVerts = [{ x: 0, z: -R }, { x: R * 0.5, z: 0 }, { x: -R * 0.5, z: 0 }];
  pts.push(...distributeAlongPath(tipN, tipVerts, true));
  // Tail (rectangle)
  const tw = R * 0.15;
  for (let i = 0; i < tailN; i++) {
    const t = i / (tailN - 1);
    const z = t * R * 0.8;
    const x = ((i % 2) * 2 - 1) * tw;
    pts.push({ x, z });
  }
  return pts.slice(0, n);
}

function genCrescent(n: number, R: number, innerR: number): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 1.5 * i) / n + Math.PI * 0.25;
    // Check if point is inside inner circle offset
    const outerX = R * Math.cos(a), outerZ = R * Math.sin(a);
    const shift = R * 0.3;
    const distToInner = Math.hypot(outerX - shift, outerZ);
    if (distToInner > innerR) {
      pts.push({ x: outerX, z: outerZ });
    } else {
      // Push point to edge of crescent
      const t = i / n;
      const angle = Math.PI * 0.25 + t * Math.PI * 1.5;
      pts.push({ x: R * Math.cos(angle), z: R * Math.sin(angle) });
    }
  }
  if (pts.length < n) {
    // Fill with outer arc
    while (pts.length < n) {
      const a = (2 * Math.PI * pts.length) / n;
      pts.push({ x: R * Math.cos(a), z: R * Math.sin(a) });
    }
  }
  return pts.slice(0, n);
}

function genRing(n: number, R: number, innerR: number): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  const rings = 3;
  for (let k = 0; k < rings && pts.length < n; k++) {
    const r = innerR + (R - innerR) * k / (rings - 1);
    const perRing = Math.round(n / rings);
    for (let i = 0; i < perRing && pts.length < n; i++) {
      const a = (2 * Math.PI * i) / perRing + k * 0.2;
      pts.push({ x: r * Math.cos(a), z: r * Math.sin(a) });
    }
  }
  while (pts.length < n) {
    const a = (2 * Math.PI * pts.length) / 20;
    pts.push({ x: R * Math.cos(a), z: R * Math.sin(a) });
  }
  return pts.slice(0, n);
}

function genLemniscate(n: number, R: number): { x: number; z: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * i) / n;
    const denom = 1 + Math.sin(t) * Math.sin(t);
    return { x: R * Math.cos(t) / denom, z: R * Math.sin(t) * Math.cos(t) / denom };
  });
}

function genRadialBurst(n: number, R: number, layers: number): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  pts.push({ x: 0, z: 0 });
  let remaining = n - 1;
  for (let layer = 1; layer <= layers && remaining > 0; layer++) {
    const r = (R * layer) / layers;
    const perLayer = layer === layers ? remaining : Math.round(remaining * 0.4);
    for (let i = 0; i < perLayer; i++) {
      const a = (2 * Math.PI * i) / perLayer + layer * 0.15;
      pts.push({ x: r * Math.cos(a), z: r * Math.sin(a) });
    }
    remaining -= perLayer;
  }
  return pts.slice(0, n);
}

function genLayeredTriangles(n: number, R: number, layers: number): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  const perLayer = Math.ceil(n / layers);
  for (let layer = 0; layer < layers && pts.length < n; layer++) {
    const y = -R + (2 * R * layer) / (layers - 1 || 1);
    const width = R * (1 - layer / layers) * 0.8;
    const count = Math.min(perLayer, n - pts.length);
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0.5;
      pts.push({ x: (t - 0.5) * width * 2, z: y });
    }
  }
  // Tree trunk
  if (pts.length < n) {
    const trunkN = Math.min(4, n - pts.length);
    for (let i = 0; i < trunkN; i++) {
      pts.push({ x: ((i % 2) - 0.5) * R * 0.1, z: R * 1.05 + i * 2 });
    }
  }
  return pts.slice(0, n);
}

function genHouse(n: number, R: number): { x: number; z: number }[] {
  const houseVerts = [
    { x: -R * 0.6, z: R * 0.5 },  // bottom-left
    { x: R * 0.6, z: R * 0.5 },   // bottom-right
    { x: R * 0.6, z: -R * 0.2 },  // top-right wall
    { x: R * 0.8, z: -R * 0.2 },  // roof overhang right
    { x: 0, z: -R * 0.8 },        // roof peak
    { x: -R * 0.8, z: -R * 0.2 }, // roof overhang left
    { x: -R * 0.6, z: -R * 0.2 }, // top-left wall
  ];
  return distributeAlongPath(n, houseVerts, true);
}

function genMusicNote(n: number, R: number): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  // Note head (circle)
  const headN = Math.floor(n * 0.4);
  const headR = R * 0.25;
  for (let i = 0; i < headN; i++) {
    const a = (2 * Math.PI * i) / headN;
    pts.push({ x: headR * Math.cos(a) - R * 0.15, z: R * 0.4 + headR * Math.sin(a) });
  }
  // Stem
  const stemN = Math.floor(n * 0.35);
  for (let i = 0; i < stemN; i++) {
    const t = i / (stemN - 1);
    pts.push({ x: R * 0.1, z: R * 0.4 - t * R * 1.0 });
  }
  // Flag
  const flagN = n - pts.length;
  for (let i = 0; i < flagN; i++) {
    const t = i / (flagN - 1);
    pts.push({ x: R * 0.1 + Math.sin(t * Math.PI) * R * 0.3, z: -R * 0.6 + t * R * 0.4 });
  }
  return pts.slice(0, n);
}

function genPeaceSign(n: number, R: number): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  const circleN = Math.floor(n * 0.6);
  const linesN = n - circleN;
  // Circle
  for (let i = 0; i < circleN; i++) {
    const a = (2 * Math.PI * i) / circleN;
    pts.push({ x: R * Math.cos(a), z: R * Math.sin(a) });
  }
  // Vertical line
  const vn = Math.floor(linesN * 0.4);
  for (let i = 0; i < vn; i++) {
    const t = i / (vn - 1);
    pts.push({ x: 0, z: (t - 0.5) * R * 2 });
  }
  // Diagonal lines
  const dn = linesN - vn;
  const half = Math.floor(dn / 2);
  for (let i = 0; i < half; i++) {
    const t = i / (half - 1 || 1);
    pts.push({ x: t * R * 0.7, z: t * R * 0.7 });
  }
  for (let i = 0; i < dn - half; i++) {
    const t = i / ((dn - half) - 1 || 1);
    pts.push({ x: -t * R * 0.7, z: t * R * 0.7 });
  }
  return pts.slice(0, n);
}

function genRocket(n: number, R: number): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  // Body (ellipse)
  const bodyN = Math.floor(n * 0.5);
  for (let i = 0; i < bodyN; i++) {
    const t = i / (bodyN - 1);
    const z = (t - 0.5) * R * 1.4;
    const x = Math.sin(t * Math.PI) * R * 0.25;
    pts.push({ x, z });
    if (pts.length < n) pts.push({ x: -x, z });
  }
  // Nose cone
  const noseN = Math.floor(n * 0.15);
  for (let i = 0; i < noseN && pts.length < n; i++) {
    const t = i / (noseN - 1 || 1);
    pts.push({ x: (1 - t) * R * 0.25 * ((i % 2) * 2 - 1), z: -R * 0.7 - t * R * 0.3 });
  }
  // Fins
  const finN = n - pts.length;
  const halfFin = Math.floor(finN / 2);
  for (let i = 0; i < halfFin; i++) {
    const t = i / (halfFin - 1 || 1);
    pts.push({ x: R * 0.25 + t * R * 0.3, z: R * 0.5 + t * R * 0.2 });
  }
  for (let i = 0; i < finN - halfFin; i++) {
    const t = i / ((finN - halfFin) - 1 || 1);
    pts.push({ x: -(R * 0.25 + t * R * 0.3), z: R * 0.5 + t * R * 0.2 });
  }
  return pts.slice(0, n);
}

function genCake(n: number, R: number, layers: number): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  const perLayer = Math.floor(n * 0.8 / layers);
  const candleN = n - perLayer * layers;
  for (let layer = 0; layer < layers; layer++) {
    const w = R * (1 - layer * 0.2);
    const z = R * 0.5 - (layer * R * 0.35);
    // Top and bottom lines of each layer
    const halfL = Math.floor(perLayer / 2);
    for (let i = 0; i < halfL; i++) {
      const t = i / (halfL - 1 || 1);
      pts.push({ x: (t - 0.5) * w * 2, z });
    }
    for (let i = 0; i < perLayer - halfL; i++) {
      const t = i / ((perLayer - halfL) - 1 || 1);
      pts.push({ x: (t - 0.5) * w * 2, z: z + R * 0.2 });
    }
  }
  // Candles on top
  for (let i = 0; i < candleN && pts.length < n; i++) {
    const x = (i / (candleN - 1 || 1) - 0.5) * R * 0.8;
    pts.push({ x, z: -R * 0.5 - R * 0.15 });
  }
  return pts.slice(0, n);
}

function genText(n: number, R: number, text: string): { x: number; z: number }[] {
  // Simple 5x7 dot matrix font for basic characters
  const charWidth = 5, charHeight = 7, charSpacing = 2;
  const chars = text.toUpperCase().slice(0, 10); // Max 10 chars
  const totalWidth = chars.length * (charWidth + charSpacing) - charSpacing;
  const scale = (R * 2) / Math.max(totalWidth, charHeight);
  
  // Generate all character dots
  const allDots: { x: number; z: number }[] = [];
  for (let ci = 0; ci < chars.length; ci++) {
    const charDots = getCharDots(chars[ci]);
    const offsetX = ci * (charWidth + charSpacing) - totalWidth / 2;
    for (const dot of charDots) {
      allDots.push({ x: (offsetX + dot.x) * scale, z: (dot.z - charHeight / 2) * scale });
    }
  }
  
  if (allDots.length === 0) return genGrid(n, R);
  
  // Distribute n points along the dot positions
  if (allDots.length >= n) {
    // Subsample
    const step = allDots.length / n;
    return Array.from({ length: n }, (_, i) => allDots[Math.floor(i * step)]);
  }
  // Need to add more points - duplicate with jitter
  const pts = [...allDots];
  while (pts.length < n) {
    const base = allDots[pts.length % allDots.length];
    pts.push({ x: base.x + (Math.random() - 0.5) * scale * 0.5, z: base.z + (Math.random() - 0.5) * scale * 0.5 });
  }
  return pts.slice(0, n);
}

function getCharDots(ch: string): { x: number; z: number }[] {
  // Minimal 5x7 bitmap font for common characters
  const fonts: Record<string, string[]> = {
    'A': ['01110','10001','10001','11111','10001','10001','10001'],
    'B': ['11110','10001','10001','11110','10001','10001','11110'],
    'C': ['01110','10001','10000','10000','10000','10001','01110'],
    'D': ['11110','10001','10001','10001','10001','10001','11110'],
    'E': ['11111','10000','10000','11110','10000','10000','11111'],
    'F': ['11111','10000','10000','11110','10000','10000','10000'],
    'G': ['01110','10001','10000','10111','10001','10001','01110'],
    'H': ['10001','10001','10001','11111','10001','10001','10001'],
    'I': ['01110','00100','00100','00100','00100','00100','01110'],
    'L': ['10000','10000','10000','10000','10000','10000','11111'],
    'M': ['10001','11011','10101','10101','10001','10001','10001'],
    'N': ['10001','11001','10101','10011','10001','10001','10001'],
    'O': ['01110','10001','10001','10001','10001','10001','01110'],
    'P': ['11110','10001','10001','11110','10000','10000','10000'],
    'R': ['11110','10001','10001','11110','10100','10010','10001'],
    'S': ['01110','10001','10000','01110','00001','10001','01110'],
    'T': ['11111','00100','00100','00100','00100','00100','00100'],
    'U': ['10001','10001','10001','10001','10001','10001','01110'],
    'V': ['10001','10001','10001','10001','01010','01010','00100'],
    'W': ['10001','10001','10001','10101','10101','11011','10001'],
    'X': ['10001','10001','01010','00100','01010','10001','10001'],
    'Y': ['10001','10001','01010','00100','00100','00100','00100'],
    'Z': ['11111','00001','00010','00100','01000','10000','11111'],
    '0': ['01110','10011','10101','10101','10101','11001','01110'],
    '1': ['00100','01100','00100','00100','00100','00100','01110'],
    '2': ['01110','10001','00001','00110','01000','10000','11111'],
    '3': ['01110','10001','00001','00110','00001','10001','01110'],
    '4': ['00010','00110','01010','10010','11111','00010','00010'],
    '5': ['11111','10000','11110','00001','00001','10001','01110'],
    '6': ['01110','10000','10000','11110','10001','10001','01110'],
    '7': ['11111','00001','00010','00100','01000','01000','01000'],
    '8': ['01110','10001','10001','01110','10001','10001','01110'],
    '9': ['01110','10001','10001','01111','00001','00001','01110'],
    ' ': ['00000','00000','00000','00000','00000','00000','00000'],
    '!': ['00100','00100','00100','00100','00100','00000','00100'],
    '?': ['01110','10001','00001','00110','00100','00000','00100'],
    '❤': ['01010','11111','11111','11111','01110','00100','00000'],
    '⭐': ['00100','00100','11111','01110','01010','10001','00000'],
  };
  const rows = fonts[ch] || fonts['?'] || [];
  const dots: { x: number; z: number }[] = [];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      if (rows[r][c] === '1') dots.push({ x: c, z: r });
    }
  }
  return dots;
}

function genFromOutline(n: number, outline: { x: number; z: number }[]): { x: number; z: number }[] {
  if (n <= outline.length * 3) {
    return distributeAlongPath(n, outline, true);
  }
  // For large N: fill the outline with concentric scaled versions
  const pts = distributeAlongPath(Math.floor(n * 0.6), outline, true);
  let remaining = n - pts.length;
  let scale = 0.7;
  while (remaining > 0 && scale > 0.1) {
    const innerOutline = outline.map(p => ({ x: p.x * scale, z: p.z * scale }));
    const inner = distributeAlongPath(Math.min(remaining, Math.floor(n * 0.3)), innerOutline, true);
    pts.push(...inner);
    remaining -= inner.length;
    scale -= 0.25;
  }
  while (pts.length < n) pts.push({ x: (Math.random() - 0.5) * 2, z: (Math.random() - 0.5) * 2 });
  return pts.slice(0, n);
}

// ── Path utilities ──────────────────────────────────────────

function distributeAlongPath(n: number, vertices: { x: number; z: number }[], closed: boolean): { x: number; z: number }[] {
  if (vertices.length < 2) return vertices;
  // Compute total path length
  let totalLen = 0;
  const segLens: number[] = [];
  const vCount = closed ? vertices.length : vertices.length - 1;
  for (let i = 0; i < vCount; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    segLens.push(len);
    totalLen += len;
  }
  
  const pts: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const targetDist = (i / n) * totalLen;
    let accumulated = 0;
    for (let s = 0; s < segLens.length; s++) {
      if (accumulated + segLens[s] >= targetDist || s === segLens.length - 1) {
        const t = segLens[s] > 0 ? (targetDist - accumulated) / segLens[s] : 0;
        const a = vertices[s];
        const b = vertices[(s + 1) % vertices.length];
        pts.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
        break;
      }
      accumulated += segLens[s];
    }
  }
  return pts;
}

// ── Spatial grid for O(n) neighbor lookups ──────────────────

class SpatialGrid {
  private cells = new Map<string, number[]>();
  private cellSize: number;
  constructor(cellSize: number) { this.cellSize = cellSize; }
  
  private key(x: number, z: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(z / this.cellSize)}`;
  }
  
  clear() { this.cells.clear(); }
  
  insert(idx: number, x: number, z: number) {
    const k = this.key(x, z);
    const arr = this.cells.get(k);
    if (arr) arr.push(idx); else this.cells.set(k, [idx]);
  }
  
  rebuild(pts: { x: number; z: number }[]) {
    this.clear();
    for (let i = 0; i < pts.length; i++) this.insert(i, pts[i].x, pts[i].z);
  }
  
  neighbors(x: number, z: number, radius: number): number[] {
    const result: number[] = [];
    const r = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const arr = this.cells.get(`${cx + dx},${cz + dz}`);
        if (arr) result.push(...arr);
      }
    }
    return result;
  }
}

// ── Post-processing (optimized for N up to 5000+) ───────────

function postProcess(
  points: { x: number; z: number }[],
  targetCount: number,
  minSpacing: number = 2.0,
): { x: number; z: number }[] {
  if (points.length === 0) return generateFallbackGrid(targetCount, minSpacing);

  // Center at origin
  let cx = 0, cz = 0;
  for (const p of points) { cx += p.x; cz += p.z; }
  cx /= points.length; cz /= points.length;
  let pts = points.map(p => ({ x: p.x - cx, z: p.z - cz }));

  // Adjust count - use efficient methods for large N
  if (pts.length > targetCount) {
    // For large arrays, use random sampling + keep shape integrity
    if (pts.length - targetCount > 100) {
      // Subsample keeping every nth point
      const step = pts.length / targetCount;
      const sampled: { x: number; z: number }[] = [];
      for (let i = 0; i < targetCount; i++) {
        sampled.push(pts[Math.floor(i * step)]);
      }
      pts = sampled;
    } else {
      // Small difference: remove closest pairs using spatial grid
      const grid = new SpatialGrid(minSpacing * 2);
      while (pts.length > targetCount) {
        grid.rebuild(pts);
        let minDist = Infinity, removeIdx = 0;
        for (let i = 0; i < pts.length; i++) {
          const nearby = grid.neighbors(pts[i].x, pts[i].z, minSpacing * 3);
          for (const j of nearby) {
            if (i === j) continue;
            const d = Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z);
            if (d < minDist) { minDist = d; removeIdx = i; }
          }
        }
        pts.splice(removeIdx, 1);
      }
    }
  } else if (pts.length < targetCount) {
    // Add points by subdividing - for large gaps use batch approach
    if (targetCount - pts.length > pts.length) {
      // Need to more than double: use parametric interpolation along shape
      const original = [...pts];
      while (pts.length < targetCount) {
        const idx = pts.length % original.length;
        const next = (idx + 1) % original.length;
        const t = 0.3 + Math.random() * 0.4;
        pts.push({
          x: original[idx].x + (original[next].x - original[idx].x) * t + (Math.random() - 0.5) * 0.5,
          z: original[idx].z + (original[next].z - original[idx].z) * t + (Math.random() - 0.5) * 0.5,
        });
      }
    } else {
      // Small gap: add midpoints between farthest pairs
      while (pts.length < targetCount) {
        // Sample random pairs to find far ones (avoid O(n²))
        let maxDist = 0, bestI = 0, bestJ = 1;
        const samples = Math.min(pts.length, 200);
        for (let s = 0; s < samples; s++) {
          const i = Math.floor(Math.random() * pts.length);
          const j = Math.floor(Math.random() * pts.length);
          if (i === j) continue;
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z);
          if (d > maxDist) { maxDist = d; bestI = i; bestJ = j; }
        }
        pts.push({
          x: (pts[bestI].x + pts[bestJ].x) / 2 + (Math.random() - 0.5) * 0.3,
          z: (pts[bestI].z + pts[bestJ].z) / 2 + (Math.random() - 0.5) * 0.3,
        });
      }
    }
  }

  // Enforce minimum spacing using spatial grid (O(n*k) instead of O(n²))
  const grid = new SpatialGrid(minSpacing * 1.5);
  const maxIter = pts.length > 1000 ? 30 : 60;
  for (let iter = 0; iter < maxIter; iter++) {
    grid.rebuild(pts);
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      const nearby = grid.neighbors(pts[i].x, pts[i].z, minSpacing * 1.5);
      for (const j of nearby) {
        if (j <= i) continue;
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
      pts.push({ x: (c - (cols - 1) / 2) * spacing, z: (r - (rows - 1) / 2) * spacing });
    }
  }
  return pts;
}

// ── Transition optimizer (nearest-neighbor) ─────────────────

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

// ── Process formation result ────────────────────────────────

function processFormationResult(
  rawPoints: { x: number; z: number }[],
  count: number,
  previousFormation?: { x: number; z: number }[],
): { x: number; z: number }[] {
  let processed = postProcess(rawPoints, count);
  if (previousFormation && previousFormation.length === processed.length) {
    processed = optimizeTransitionOrder(previousFormation, processed);
  }
  return processed;
}

// ── Model selection ─────────────────────────────────────────

function selectModels(mode: string, count: number, isFullShow: boolean): { primary: string; fallback: string } {
  if (isFullShow || mode === "image") {
    return { primary: "google/gemini-2.5-pro", fallback: "google/gemini-2.5-flash" };
  }
  // Use flash for most single formations (faster), pro for complex/large
  if (count > 200 || mode === "generative") {
    return { primary: "google/gemini-2.5-flash", fallback: "google/gemini-2.5-pro" };
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

    // ── Full Show generation (two-phase: structure → per-formation points) ──
    if (generateFullShow) {
      console.log(`Full show request: "${prompt}", ${count} drones`);
      
      const messages = [
        { role: "system", content: FULL_SHOW_PROMPT + "\n\n" + SYSTEM_PROMPT },
        { role: "user", content: `Design a complete drone light show with EXACTLY ${count} drones per formation.\n\nTheme: "${prompt}"\n\nCreate 4-6 formations that tell a visual story. Each formation MUST have exactly ${count} points. Use the mathematical recipes. Include dramatic colors and timing. COUNTING IS CRITICAL: every points array = ${count} elements.` },
      ];

      const { primary, fallback } = selectModels("full-show", count, true);
      let raw: any;
      let usedModel = primary;

      try {
        raw = await callAI(LOVABLE_API_KEY, primary, messages, [buildFullShowTool(count)], { type: "function", function: { name: "create_full_show" } }, 0.2);
      } catch (e: any) {
        if (e.status === 429 || e.status === 402) throw e;
        console.warn(`Full show ${primary} failed, trying ${fallback}...`);
        usedModel = fallback;
        raw = await callAI(LOVABLE_API_KEY, fallback, messages, [buildFullShowTool(count)], { type: "function", function: { name: "create_full_show" } }, 0.2);
      }

      // Post-process each formation
      const formations = (raw.formations || []).map((f: any, idx: number) => {
        const rawPts = (f.points || []).map((p: any) => ({ x: Number(p.x), z: Number(p.z) })).filter((p: any) => !isNaN(p.x) && !isNaN(p.z));
        const prev = idx > 0
          ? (raw.formations[idx - 1]._processed || raw.formations[idx - 1].points || []).map((p: any) => ({ x: Number(p.x), z: Number(p.z) }))
          : null;
        
        let points: { x: number; z: number }[];
        if (rawPts.length < count * 0.3) {
          // AI returned too few points — use server-side generation based on name
          console.warn(`Formation "${f.formationName}": only ${rawPts.length}/${count} points, generating server-side`);
          const shapeType = inferShapeType(f.formationName);
          points = generateShapePoints(shapeType, count, { radius: Math.max(12, Math.sqrt(count) * 2.2) });
          points = postProcess(points, count);
        } else {
          points = processFormationResult(rawPts, count, prev);
        }
        
        f._processed = points;
        return {
          formationName: f.formationName || `Formation ${idx + 1}`,
          points,
          height: Math.max(20, Math.min(80, f.height || 30)),
          transitionDuration: Math.max(8, Math.min(25, f.transitionDuration || 12)),
          holdDuration: Math.max(10, Math.min(30, f.holdDuration || 15)),
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
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Trajectory generation ───────────────────────────────
    if (generateTrajectory) {
      const trajMessages = [
        { role: "system", content: TRAJECTORY_SYSTEM_PROMPT },
        { role: "user", content: `Create an epic drone choreography for ${count} drones: "${prompt}"\n\nDesign for maximum visual impact from ground level. 4-8 phases, 30-90 seconds total.` },
      ];

      let trajResult: any;
      try {
        trajResult = await callAI(LOVABLE_API_KEY, "google/gemini-2.5-flash", trajMessages, [buildTrajectoryTool()], { type: "function", function: { name: "create_trajectory_sequence" } }, 0.3);
      } catch (e: any) {
        if (e.status === 429 || e.status === 402) throw e;
        trajResult = await callAI(LOVABLE_API_KEY, "google/gemini-2.5-pro", trajMessages, [buildTrajectoryTool()], { type: "function", function: { name: "create_trajectory_sequence" } }, 0.3);
      }

      return new Response(JSON.stringify(trajResult), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Single Formation: HYBRID approach ───────────────────
    // For large counts or complex shapes: AI describes shape → server computes points
    // For small counts: AI can still generate points directly
    
    const useHybrid = count > 60 || mode === "generative";
    
    if (useHybrid && mode !== "image") {
      console.log(`Hybrid generation: "${prompt}", ${count} drones`);
      
      const shapeMessages = [
        { role: "system", content: SHAPE_DESCRIPTOR_PROMPT },
        { role: "user", content: `Describe the best shape for ${count} drones matching: "${prompt || 'circle'}"\n\nChoose the shape type and parameters. For complex/unusual shapes, use custom_outline with 15-30 key vertices. Radius should be approximately ${Math.round(Math.sqrt(count) * 2.2)}m.` },
      ];

      let shapeDesc: any;
      try {
        shapeDesc = await callAI(LOVABLE_API_KEY, "google/gemini-2.5-flash", shapeMessages, [buildShapeDescriptorTool()], { type: "function", function: { name: "describe_shape" } }, 0.1);
      } catch (e: any) {
        if (e.status === 429 || e.status === 402) throw e;
        // Fallback: infer shape from prompt
        console.warn("Shape descriptor failed, inferring from prompt");
        const inferred = inferShapeType(prompt || "circle");
        shapeDesc = { 
          shapeType: inferred, 
          params: { radius: Math.max(12, Math.sqrt(count) * 2.2) },
          formationName: prompt || "Formation",
          suggestedHeight: 30,
          suggestedTransitionTime: 12,
        };
      }

      const rawPoints = generateShapePoints(
        shapeDesc.shapeType || 'filled_circle',
        count,
        shapeDesc.params || {},
        shapeDesc.outlinePoints,
      );

      const prev = previousFormation?.map((p: any) => ({ x: Number(p.x), z: Number(p.z) }));
      const processed = processFormationResult(rawPoints, count, prev);

      console.log(`Hybrid: shape=${shapeDesc.shapeType}, name="${shapeDesc.formationName}", ${processed.length} points`);

      return new Response(JSON.stringify({
        points: processed,
        formationName: shapeDesc.formationName || "AI Formation",
        suggestedHeight: Math.max(20, Math.min(80, shapeDesc.suggestedHeight || 30)),
        suggestedTransitionTime: Math.max(8, Math.min(25, shapeDesc.suggestedTransitionTime || 12)),
        rawPointCount: rawPoints.length,
        model: "hybrid (server-computed)",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Direct AI generation (small counts or image mode) ───
    console.log(`Direct AI generation: mode=${mode}, "${prompt}", ${count} drones`);
    
    const scaleHint = `Use a radius of approximately ${Math.round(Math.sqrt(count) * 2.2)}m.`;
    let userMessage: string;
    
    if (mode === "image") {
      userMessage = `Generate a drone formation with EXACTLY ${count} points. ${scaleHint}\n\nAnalyze the uploaded image. Extract the main subject's outline/silhouette. Place EXACTLY ${count} drone points along the recognizable contour. For filled areas use scanline. EXACTLY ${count} points.`;
    } else {
      userMessage = `Generate a drone formation with EXACTLY ${count} points. ${scaleHint}\n\nShape: "${prompt}"\n\nUse the mathematical recipes. EXACTLY ${count} points. COUNT THEM.`;
    }

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

    const { primary, fallback } = selectModels(mode, count, false);
    let raw: any;
    let usedModel = primary;

    try {
      raw = await callAI(LOVABLE_API_KEY, primary, messages, [tool], toolChoice, 0.1);
    } catch (e: any) {
      if (e.status === 429 || e.status === 402) throw e;
      console.warn(`${primary} failed, trying ${fallback}...`);
      raw = await callAI(LOVABLE_API_KEY, fallback, messages, [tool], toolChoice, 0.1);
      usedModel = fallback;
    }

    const rawPoints = (raw.points || []).map((p: any) => ({ x: Number(p.x), z: Number(p.z) })).filter((p: any) => !isNaN(p.x) && !isNaN(p.z));
    const prev = previousFormation?.map((p: any) => ({ x: Number(p.x), z: Number(p.z) }));
    const processed = processFormationResult(rawPoints, count, prev);

    // If AI result was very poor, retry with hybrid approach
    if (rawPoints.length < count * 0.3 && mode !== "image") {
      console.warn(`Direct AI returned only ${rawPoints.length}/${count}, falling back to hybrid`);
      const inferred = inferShapeType(prompt || raw.formationName || "circle");
      const hybridPts = generateShapePoints(inferred, count, { radius: Math.max(12, Math.sqrt(count) * 2.2) });
      const hybridProcessed = processFormationResult(hybridPts, count, prev);
      
      return new Response(JSON.stringify({
        points: hybridProcessed,
        formationName: raw.formationName || prompt || "AI Formation",
        suggestedHeight: Math.max(20, Math.min(80, raw.suggestedHeight || 30)),
        suggestedTransitionTime: Math.max(8, Math.min(25, raw.suggestedTransitionTime || 12)),
        rawPointCount: rawPoints.length,
        model: `${usedModel} → hybrid fallback`,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Direct: "${raw.formationName}", raw=${rawPoints.length}, final=${processed.length}, model=${usedModel}`);

    return new Response(JSON.stringify({
      points: processed,
      formationName: raw.formationName || "AI Formation",
      suggestedHeight: Math.max(20, Math.min(80, raw.suggestedHeight || 30)),
      suggestedTransitionTime: Math.max(8, Math.min(25, raw.suggestedTransitionTime || 12)),
      rawPointCount: rawPoints.length,
      model: usedModel,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    const status = e.status || 500;
    console.error("generate-formation error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro desconhecido" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Shape type inference from name/prompt ───────────────────

function inferShapeType(name: string): string {
  const lower = name.toLowerCase();
  const map: [RegExp, string][] = [
    [/heart|coração|❤|💕|💗/, 'heart'],
    [/star|estrela|⭐|✨/, 'star'],
    [/circle|círculo|⭕/, 'circle'],
    [/spiral|espiral|🌀/, 'spiral'],
    [/grid|grade|quadr/, 'grid'],
    [/diamond|diamante|losango|💎/, 'diamond'],
    [/cross|cruz|✝|✚/, 'cross'],
    [/wave|onda|🌊/, 'wave'],
    [/butterfly|borboleta|🦋/, 'butterfly'],
    [/arrow|flecha|seta|➡/, 'arrow'],
    [/crescent|lua|moon|🌙/, 'crescent'],
    [/ring|anel|💍/, 'ring'],
    [/infinity|infinit|♾/, 'lemniscate'],
    [/burst|explos|firework|fogo|🎆/, 'radial_burst'],
    [/tree|árvore|natal|🎄/, 'layered_triangles'],
    [/house|casa|🏠/, 'house'],
    [/music|nota|🎵|🎶/, 'music_note'],
    [/peace|paz|☮/, 'peace_sign'],
    [/rocket|foguete|🚀/, 'rocket'],
    [/cake|bolo|🎂/, 'cake'],
    [/ball|bola|⚽/, 'filled_circle'],
    [/flag|bandeira/, 'grid'],
    [/bell|sino|🔔/, 'filled_circle'],
    [/snow|neve|❄/, 'star'],
    [/flower|flor|🌸/, 'radial_burst'],
    [/sun|sol|☀/, 'radial_burst'],
    [/trophy|troféu|🏆/, 'house'],
    [/dolphin|golfinho|🐬/, 'crescent'],
  ];
  for (const [regex, shape] of map) {
    if (regex.test(lower)) return shape;
  }
  return 'filled_circle';
}
