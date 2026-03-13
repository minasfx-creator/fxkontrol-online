import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ── v4 System Prompt: Formation Designer ────────────────────

const SYSTEM_PROMPT = `You are a world-class drone light show formation designer with 15+ years of experience at companies like Intel, Dronisos, and CollMot. You output EXACT coordinates with mathematical precision.

RULES (VIOLATION = SHOW FAILURE):
1. Return EXACTLY N points (N specified per request). COUNT your array.
2. Coordinates in meters, centered at (0,0).
3. Minimum distance between ANY two points: 2.0m (safety regulation — FAA Part 107 compliant).
4. suggestedHeight: 20-80m. suggestedTransitionTime: 8-25s.
5. For complex shapes: prioritize RECOGNIZABILITY from audience perspective (ground level, 200m away).

MATHEMATICAL RECIPES (USE THESE — don't improvise formulas):

Circle(N, R): x=R·cos(2πi/N), z=R·sin(2πi/N)
Filled Circle(N, R): Fibonacci/sunflower spiral — angle=i·137.508°, r=R·√(i/N)
Heart(N, R): t=2πi/N → x=R·sin³(t)·0.8, z=R·(13cos(t)−5cos(2t)−2cos(3t)−cos(4t))/16
Star(N, R, points=5): outer=R, inner=R×0.38, alternate vertices, distribute N along perimeter. For filled: concentric scaled stars.
Spiral(N, R, turns=3): t=i/(N−1), angle=2π·turns·t, x=t·R·cos(angle), z=t·R·sin(angle)
Grid(N, sp=2.5): cols=ceil(√N), center at origin
Text: 5×7 dot matrix per char, spacing=8m, scale to fit N drones. For large N, thicken strokes.
Diamond: 4 sides of rotated square, N/4 per side
Cross: horizontal + vertical bars, thickness=2-4 points
Wave: x spread linearly, z=A·sin(2π·x/wavelength), for filled use multiple phase-shifted rows
Butterfly: two heart-like wings mirrored, thin body center line
Arrow: triangle tip + rectangular tail
Snowflake: 6-fold symmetry, fractal arms with branches
Hexagon: 6-sided polygon, filled with concentric hexagons
Galaxy/Vortex: logarithmic spiral arms (2-4), core cluster
Treble Clef: staff curves with characteristic S and loop
Crown: zigzag top + rectangular base
Anchor: vertical shaft + curved arms + cross bar
Phoenix/Bird: spread wings (parabolic arcs) + body + tail
DNA/Helix: two interleaved sine waves with connecting rungs
Globe: meridians + parallels, sphere projected to 2D
Flag BR: green rectangle, yellow diamond, blue circle, white band with stars
Mandala: concentric rings with rotational symmetry patterns

EMOJI → SHAPE MAP:
⭐→Star5  ❤️→Heart  🌙→Crescent(thick arc)  🦋→Butterfly  🔔→Bell(parabola+top)  
🎄→LayeredTriangles  🎵→MusicNote(circle+stem+flag)  ✝️→Cross  ☮️→PeaceSign(circle+lines)  
♾️→Lemniscate  🏠→House(square+triangle roof)  🐬→DolphinArc  🎆→RadialBurst(concentric)
🌍→Globe  🚀→Rocket(cylinder+cone+fins)  ⚽→Circle  💎→Diamond  🎂→CakeLayers
👑→Crown  ⚓→Anchor  🌸→Flower(petal arcs)  🦅→Bird(spread wings)  🧬→DNA  
🎭→Theater masks  🏰→Castle  🎪→Tent  🌺→Mandala  ❄️→Snowflake6  🔱→Trident
🦁→Lion face  🐉→Dragon  🏛️→Columns  ⛵→Sailboat  🎸→Guitar  🏆→Trophy

SCALING: radius = clamp(sqrt(N)*2.2, 12, 150)
For N>200: Use FILLED shapes (concentric/scanline), not just outlines. Ensure 60%+ are interior points.
For N>500: Increase density, use multiple concentric layers. radius ~ sqrt(N)*2.5
For N>1000: Large-scale show. radius ~ sqrt(N)*3.0, use dense fill patterns.
For N>2000: Stadium-scale. radius ~ sqrt(N)*3.5, multiple density zones.

AUDIENCE PERSPECTIVE OPTIMIZATION:
- Shapes are viewed from GROUND LEVEL at ~200m distance
- Vertical axis (z in your output) is MORE impactful than horizontal spread
- Make shapes slightly taller than wide (1.2:1 ratio) for better visibility
- Keep most points in the upper 2/3 of the shape — drones near ground are less visible

CRITICAL: Your "points" array must have EXACTLY N elements. If you're unsure, use the mathematical formula and compute each point.`;

// ── v4 Full Show Prompt ─────────────────────────────────────

const FULL_SHOW_PROMPT = `You are a legendary drone show choreographer — the Spielberg of the sky. You design spectacular multi-formation shows that tell visual stories and evoke deep emotional responses.

SHOW STRUCTURE (5-8 formations for maximum narrative impact):
1. PRELUDE: Subtle, small formation rising from ground. Build curiosity. (hold: 8-12s)
2. OPENING: Recognizable theme symbol. Establish the story. (hold: 12-18s)
3. DEVELOPMENT: 2-3 formations of increasing complexity. Explore theme variations. Use contrasting colors and scales. (hold: 15-22s each)
4. CLIMAX: The most impressive, largest formation. Maximum visual impact. Fill the sky. (hold: 20-30s)
5. RESOLUTION: Meaningful closing symbol. Emotional conclusion. (hold: 15-20s)
6. FINALE: All drones converge, pulse, then scatter upward like released lanterns. (hold: 10-15s)

EACH FORMATION MUST have EXACTLY N points (N = drone count).

COLOR NARRATIVE (colors should evolve to tell a story):
Red=#FF2020 passion/fire/danger  Blue=#2080FF calm/sky/trust  Green=#20CC40 nature/growth  
Gold=#FFD700 celebration/achievement  White=#FFFFFF stars/purity/peace  Purple=#AA44FF magic/mystery  
Orange=#FF8800 energy/warmth  Pink=#FF66AA love/youth  Cyan=#00E5FF technology/future
Warm White=#FFE4B5 nostalgia/comfort  Crimson=#DC143C drama/intensity  Emerald=#50C878 hope/renewal
Amber=#FFBF00 golden hour/luxury  Electric Blue=#7DF9FF excitement/innovation

COLOR TRANSITIONS (choose based on emotional intent):
- "wave": for flow/water/organic themes — color ripples through formation
- "pulse": for energy/heartbeat/music — color pulses outward from center
- "rainbow": for celebration/pride/joy — full spectrum sweep
- "cascade": for revelation/unveiling — top-to-bottom color change
- "sparkle": for magic/stars — random twinkling color transitions
- "linear": for clean/professional — smooth uniform transition

TIMING MASTERY:
- transitionDuration: 8-20s (faster = energy, slower = drama/awe)
- holdDuration: 12-30s (complex shapes need longer for audience to recognize)
- CONTRAST: Follow a fast transition with a long hold, and vice versa
- Use 2-3s of hold AFTER transition for audience to "breathe" before next change

THEME RECIPES (use as inspiration, not rigid templates):
"Aniversário/Birthday" → Sparkles→🎂Cake→Numbers(age)→🎈Balloons→🎆Firework→⭐Star
"Brasil" → 🇧🇷Flag→✝️ChristRedeemer→⚽Ball→🌺Mandala→⭐SouthernCross→🦜Parrot
"Réveillon/NewYear" → 🕐Clock→🔟Countdown→🎆Firework→🌟StarBurst→ChampagneGlass→"2027"
"Casamento/Wedding" → 💐Bouquet→❤️Heart→💍Rings→🕊️Dove→❤️DoubleHeart→👑Crown
"Natal/Christmas" → ⭐StarOfBethlehem→🎄Tree→🔔Bell→❄️Snowflake→🎁Gift→☮️Peace
"Espaço/Space" → 🚀Rocket→🪐Saturn→🌌Galaxy→⭐Constellation→🛸UFO→🌍Earth
"Música/Music" → 🎵Note→🎸Guitar→🎹Piano→🎶DoubleNotes→🎤Mic→🎵BigNote
"Natureza/Nature" → 🌱Sprout→🌿Fern→🦋Butterfly→🌸Flower→🌳Tree→🌍Globe
"Tecnologia/Tech" → ⚡Bolt→💻Chip→🧬DNA→🤖Robot→🌐Globe→♾️Infinity
"Amor/Love" → 💫Sparkle→🌹Rose→❤️Heart→💕DoubleHearts→💎Diamond→👑Crown

CRITICAL SHOW DESIGN PRINCIPLES:
1. SCALE PROGRESSION: Start small, grow to maximum, then resolve
2. COMPLEXITY ARC: Simple→Complex→MaxComplex→SimpleFinal
3. COLOR JOURNEY: Cool/subtle → Warm/vibrant → Peak color → Meaningful final color
4. AUDIENCE DIRECTION: Alternate between high/low formations to guide eyes
5. SILENCE MOMENTS: Brief holds between major formations for emotional processing

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

const SHAPE_DESCRIPTOR_PROMPT = `You are a drone formation shape interpreter with deep knowledge of geometry and visual design. Given a description, identify the BEST matching shape type and parameters. The server will compute the exact drone positions.

Available shape types and their key params:
- circle: radius — simple outline circle
- filled_circle: radius — uniformly filled disc (Fibonacci spiral distribution)
- heart: radius — romantic heart shape, filled for large N
- star: radius, starPoints (default 5), innerRadius (default radius*0.38) — classic star
- spiral: radius, turns (default 3) — Archimedean spiral
- grid: radius (used as total size) — rectangular grid
- diamond: radius — rotated square / diamond shape
- cross: radius, thickness (default 2) — plus/cross shape
- wave: radius (width), amplitude, wavelength — sinusoidal wave
- butterfly: radius — mirrored wings with body
- arrow: radius — directional arrow (triangle tip + rectangular tail)
- crescent: radius, innerRadius (default radius*0.7) — moon crescent
- ring: radius, innerRadius — concentric ring/donut
- lemniscate: radius — infinity symbol (figure-8)
- text: radius, text (the text string) — dot-matrix rendered text
- radial_burst: radius, layers (default 3) — radial explosion pattern
- layered_triangles: radius, layers (default 3) — Christmas tree / pyramid
- house: radius — house with triangular roof
- music_note: radius — musical note symbol
- peace_sign: radius — peace symbol (circle + lines)
- rocket: radius — rocket with nose cone and fins
- cake: radius, layers (default 3) — tiered cake with candles
- custom_outline: provide outlinePoints (10-40 key vertices) for any shape not listed above

SCALING: radius = clamp(sqrt(N)*2.2, 12, 150) where N is drone count. For N>500: sqrt(N)*2.5. For N>1000: sqrt(N)*3.0

SHAPE SELECTION INTELLIGENCE:
- For emojis: map to the closest shape type directly
- For abstract concepts: choose the shape that best SYMBOLIZES the concept
- For complex/unknown shapes: use custom_outline with 20-35 key vertices tracing the outline
- For brand logos or letters: use type="text" or custom_outline
- For animals: use custom_outline with characteristic silhouette vertices
- When in doubt, prefer filled_circle over circle for N>100 (more visually impactful)

AUDIENCE PERSPECTIVE: Shapes will be viewed from ground level. Make them slightly taller than wide.`;

// ── Server-side shape generators ────────────────────────────

function generateShapePoints(
  shapeType: string, 
  count: number, 
  params: Record<string, number | string>,
  outlinePoints?: { x: number; z: number }[],
): { x: number; z: number }[] {
  const scaleFactor = count > 1000 ? 3.0 : count > 500 ? 2.5 : 2.2;
  const R = Number(params.radius) || Math.max(12, Math.min(200, Math.sqrt(count) * scaleFactor));
  
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
    case 'globe': return genGlobe(count, R);
    case 'trophy': return genTrophy(count, R);
    case 'snowflake': return genSnowflake(count, R);
    case 'crown': return genCrown(count, R);
    case 'flag_br': return genFlagBR(count, R);
    case 'dragon': return genDragon(count, R);
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
  // Use sunflower/Fibonacci spiral for optimal uniform distribution (no post-processing needed)
  const pts: { x: number; z: number }[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.5°
  for (let i = 0; i < n; i++) {
    const r = R * Math.sqrt(i / n); // sqrt for uniform area distribution
    const theta = i * goldenAngle;
    pts.push({ x: r * Math.cos(theta), z: r * Math.sin(theta) });
  }
  return pts;
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

  // Adjust count
  if (pts.length > targetCount) {
    const step = pts.length / targetCount;
    const sampled: { x: number; z: number }[] = [];
    for (let i = 0; i < targetCount; i++) {
      sampled.push(pts[Math.floor(i * step)]);
    }
    pts = sampled;
  } else if (pts.length < targetCount) {
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
  }

  // Enforce minimum spacing - skip for very large N (server shapes are pre-spaced)
  if (pts.length <= 800) {
    const maxIter = pts.length > 500 ? 15 : 40;
    const grid = new SpatialGrid(minSpacing * 1.5);
    
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

// ── Transition optimizer (spatial-grid accelerated) ─────────

function optimizeTransitionOrder(
  from: { x: number; z: number }[],
  to: { x: number; z: number }[],
): { x: number; z: number }[] {
  if (from.length === 0 || to.length === 0 || from.length !== to.length) return to;
  const n = from.length;
  
  // For small N, use exact nearest-neighbor
  if (n <= 500) {
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
  
  // For large N: spatial grid accelerated matching
  const grid = new SpatialGrid(10);
  for (let j = 0; j < n; j++) grid.insert(j, to[j].x, to[j].z);
  
  const result = new Array(n);
  const used = new Set<number>();
  
  for (let i = 0; i < n; i++) {
    let bestJ = -1, bestDist = Infinity;
    // Search in expanding radius
    for (let searchR = 10; searchR <= 400; searchR *= 2) {
      const candidates = grid.neighbors(from[i].x, from[i].z, searchR);
      for (const j of candidates) {
        if (used.has(j)) continue;
        const d = Math.hypot(from[i].x - to[j].x, from[i].z - to[j].z);
        if (d < bestDist) { bestDist = d; bestJ = j; }
      }
      if (bestJ !== -1) break;
    }
    // Fallback: find any unused
    if (bestJ === -1) {
      for (let j = 0; j < n; j++) {
        if (!used.has(j)) { bestJ = j; break; }
      }
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
  if (isFullShow) {
    return { primary: "google/gemini-3-flash-preview", fallback: "google/gemini-2.5-flash" };
  }
  if (mode === "image") {
    return { primary: "google/gemini-2.5-pro", fallback: "google/gemini-3-flash-preview" };
  }
  if (count > 500) {
    return { primary: "google/gemini-3-flash-preview", fallback: "google/gemini-2.5-pro" };
  }
  return { primary: "google/gemini-3-flash-preview", fallback: "google/gemini-2.5-flash" };
}

// ── Main handler ────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { mode, prompt, droneCount, imageBase64, previousFormation, generateTrajectory, generateFullShow } = await req.json();
    const count = droneCount || 24;

    // ── Full Show generation (TWO-PHASE: AI designs structure → server computes all points) ──
    if (generateFullShow) {
      console.log(`Full show request: "${prompt}", ${count} drones`);
      
      // Phase 1: AI designs the show structure (NO points — just names, colors, timing)
      const structureTool = {
        type: "function",
        function: {
          name: "design_show_structure",
          description: `Design a drone show structure. Do NOT generate points — only describe each formation. The server will compute all ${count} drone positions.`,
          parameters: {
            type: "object",
            properties: {
              showName: { type: "string" },
              formations: {
                type: "array",
                description: "5-8 formations describing the show narrative.",
                items: {
                  type: "object",
                  properties: {
                    formationName: { type: "string", description: "Descriptive name of the shape (e.g. 'Heart', 'Star', 'Christmas Tree', 'Snowflake')" },
                    shapeDescription: { type: "string", description: "Brief description of the intended shape for server-side generation" },
                    height: { type: "number", description: "Altitude in meters 20-80" },
                    transitionDuration: { type: "number", description: "Seconds 8-25" },
                    holdDuration: { type: "number", description: "Seconds 10-30" },
                    color: { type: "string", description: "Hex color e.g. #FF2020" },
                    endColor: { type: "string", description: "End color for hold transition" },
                    colorTransition: { type: "string", description: "linear, wave, pulse, rainbow, cascade, sparkle, or instant" },
                  },
                  required: ["formationName", "shapeDescription", "height", "transitionDuration", "holdDuration", "color"],
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

      const messages = [
        { role: "system", content: FULL_SHOW_PROMPT },
        { role: "user", content: `Design a complete drone light show structure for ${count} drones.\n\nTheme: "${prompt}"\n\nIMPORTANT: Do NOT generate point coordinates. Only describe each formation's shape, colors, timing, and narrative purpose. The server will generate all ${count} drone positions for each formation using mathematical recipes.\n\nCreate 5-7 formations that tell a compelling visual story with dramatic color transitions.` },
      ];

      const { primary, fallback } = selectModels("full-show", count, true);
      let raw: any;
      let usedModel = primary;

      try {
        raw = await callAI(LOVABLE_API_KEY, primary, messages, [structureTool], { type: "function", function: { name: "design_show_structure" } }, 0.3, 1);
      } catch (e: any) {
        if (e.status === 429 || e.status === 402) throw e;
        console.warn(`Full show ${primary} failed, trying ${fallback}...`);
        usedModel = fallback;
        raw = await callAI(LOVABLE_API_KEY, fallback, messages, [structureTool], { type: "function", function: { name: "design_show_structure" } }, 0.3, 1);
      }

      console.log(`AI designed show "${raw.showName}" with ${raw.formations?.length || 0} formations (model=${usedModel})`);

      // Phase 2: Server generates ALL points using mathematical recipes
      const formations = (raw.formations || []).map((f: any, idx: number) => {
        const shapeName = f.formationName || f.shapeDescription || 'circle';
        const shapeType = inferShapeType(shapeName);
        const sf = count > 1000 ? 3.0 : count > 500 ? 2.5 : 2.2;
        const radius = Math.max(12, Math.sqrt(count) * sf);
        
        let points = generateShapePoints(shapeType, count, { radius });
        
        // Center and round
        let cx = 0, cz = 0;
        for (const p of points) { cx += p.x; cz += p.z; }
        cx /= points.length; cz /= points.length;
        points = points.map(p => ({
          x: Math.round((p.x - cx) * 100) / 100,
          z: Math.round((p.z - cz) * 100) / 100,
        }));

        // Optimize transition from previous formation
        if (idx > 0) {
          const prevPts = (raw.formations[idx - 1]._serverPoints || []);
          if (prevPts.length === points.length && count <= 1000) {
            points = optimizeTransitionOrder(prevPts, points);
          }
        }
        
        f._serverPoints = points;

        console.log(`  Formation ${idx + 1}: "${shapeName}" → ${shapeType}, ${points.length} pts, h=${f.height}m, color=${f.color}`);
        
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

    // ── Single Formation generation ───────────────────────────
    // For large N (>500): skip AI entirely, use server-side math (fast, reliable)
    // For medium N (60-500): hybrid (AI describes shape → server computes)
    // For small N (<60): direct AI generation
    
    const usePureServer = count > 500 && mode !== "image";
    const useHybrid = !usePureServer && (count > 60 || mode === "generative");
    
    if (usePureServer) {
      console.log(`Pure server generation: "${prompt}", ${count} drones`);
      const sf = count > 1000 ? 3.0 : 2.5;
      const inferred = inferShapeType(prompt || "circle");
      const rawPoints = generateShapePoints(inferred, count, { radius: Math.max(15, Math.sqrt(count) * sf) });
      
      const prev = previousFormation?.map((p: any) => ({ x: Number(p.x), z: Number(p.z) }));
      // For large N, skip relaxation — server shapes use Fibonacci/parametric spacing
      let processed = rawPoints;
      // Just center and round
      let cx2 = 0, cz2 = 0;
      for (const p of processed) { cx2 += p.x; cz2 += p.z; }
      cx2 /= processed.length; cz2 /= processed.length;
      processed = processed.map(p => ({
        x: Math.round((p.x - cx2) * 100) / 100,
        z: Math.round((p.z - cz2) * 100) / 100,
      }));
      
      // Optimize transition order for previous formation (skip for very large)
      if (prev && prev.length === processed.length && count <= 1000) {
        processed = optimizeTransitionOrder(prev, processed);
      }
      
      console.log(`Pure server: shape=${inferred}, ${processed.length} points`);
      
      return new Response(JSON.stringify({
        points: processed,
        formationName: prompt || inferred,
        suggestedHeight: Math.max(25, Math.min(80, 20 + count * 0.02)),
        suggestedTransitionTime: Math.max(10, Math.min(30, 8 + count * 0.005)),
        rawPointCount: processed.length,
        model: "server-computed (instant)",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    if (useHybrid && mode !== "image") {
      console.log(`Hybrid generation: "${prompt}", ${count} drones`);
      
      const sf = count > 200 ? 2.5 : 2.2;
      const shapeMessages = [
        { role: "system", content: SHAPE_DESCRIPTOR_PROMPT },
        { role: "user", content: `Describe the best shape for ${count} drones matching: "${prompt || 'circle'}"\n\nChoose the shape type and parameters. For complex/unusual shapes, use custom_outline with 15-30 key vertices. Radius should be approximately ${Math.round(Math.sqrt(count) * sf)}m.` },
      ];

      let shapeDesc: any;
      try {
        shapeDesc = await callAI(LOVABLE_API_KEY, "google/gemini-2.5-flash", shapeMessages, [buildShapeDescriptorTool()], { type: "function", function: { name: "describe_shape" } }, 0.1);
      } catch (e: any) {
        if (e.status === 429 || e.status === 402) throw e;
        console.warn("Shape descriptor failed, inferring from prompt");
        const inferred = inferShapeType(prompt || "circle");
        shapeDesc = { 
          shapeType: inferred, 
          params: { radius: Math.max(12, Math.sqrt(count) * sf) },
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
    
    const sf = count > 1000 ? 3.0 : count > 500 ? 2.5 : 2.2;
    const scaleHint = `Use a radius of approximately ${Math.round(Math.sqrt(count) * sf)}m.`;
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
    [/heart|coração|❤|💕|💗|💓|amor|love/, 'heart'],
    [/star|estrela|⭐|✨|🌟|stella/, 'star'],
    [/circle|círculo|⭕|round|redondo/, 'circle'],
    [/vortex|vórtex|🌪️|whirlpool|tornado|turbilhão/, 'spiral'],
    [/spiral|espiral|🌀/, 'spiral'],
    [/geodesic|geodésic|buckminster|icosahedr/, 'filled_circle'],
    [/phoenix|fênix|🔥.*bird|firebird/, 'butterfly'],
    [/cube|cubo|🧊|hexahedr/, 'grid'],
    [/grid|grade|quadr|matrix|matriz/, 'grid'],
    [/diamond|diamante|losango|💎|gem/, 'diamond'],
    [/cross|cruz|✝|✚|plus/, 'cross'],
    [/wave|onda|🌊|sea|mar|ocean/, 'wave'],
    [/butterfly|borboleta|🦋|papillon/, 'butterfly'],
    [/arrow|flecha|seta|➡|→/, 'arrow'],
    [/crescent|lua|moon|🌙|meia.?lua/, 'crescent'],
    [/ring|anel|💍|donut|rosca/, 'ring'],
    [/infinity|infinit|♾|8.*deitado|lemniscate/, 'lemniscate'],
    [/burst|explos|firework|fogo.*artif|🎆|boom/, 'radial_burst'],
    [/tree|árvore|natal|🎄|christmas.*tree|pinheiro/, 'layered_triangles'],
    [/house|casa|🏠|lar|home/, 'house'],
    [/music|nota|🎵|🎶|🎤|song|canção/, 'music_note'],
    [/peace|paz|☮|harmonia/, 'peace_sign'],
    [/rocket|foguete|🚀|launch|lançamento/, 'rocket'],
    [/cake|bolo|🎂|birthday.*cake/, 'cake'],
    [/ball|bola|⚽|🏀|sphere|esfera/, 'filled_circle'],
    [/flag|bandeira|🏳|🏴/, 'grid'],
    [/bell|sino|🔔|campanha/, 'filled_circle'],
    [/snow|neve|❄|floco|snowflake/, 'star'],
    [/flower|flor|🌸|🌺|🌻|🌷|petal/, 'radial_burst'],
    [/sun|sol|☀|🌞/, 'radial_burst'],
    [/trophy|troféu|🏆|cup|taça/, 'house'],
    [/dolphin|golfinho|🐬|whale|baleia/, 'crescent'],
    [/crown|coroa|👑|king|queen|rei|rainha/, 'star'],
    [/anchor|âncora|⚓/, 'cross'],
    [/guitar|guitarra|🎸|violão/, 'music_note'],
    [/bird|pássaro|🦅|eagle|águia/, 'butterfly'],
    [/dna|helix|🧬|genética/, 'spiral'],
    [/globe|globo|🌍|🌎|🌏|earth|terra|mundo/, 'filled_circle'],
    [/eye|olho|👁|vision|visão/, 'crescent'],
    [/shield|escudo|🛡/, 'diamond'],
    [/lightning|raio|⚡|bolt|relâmpago/, 'arrow'],
    [/skull|caveira|💀/, 'filled_circle'],
    [/cat|gato|🐱/, 'filled_circle'],
    [/dog|cachorro|🐶/, 'filled_circle'],
    [/dragon|dragão|🐉/, 'butterfly'],
    [/castle|castelo|🏰/, 'layered_triangles'],
    [/tent|tenda|🎪|circus|circo/, 'layered_triangles'],
    [/leaf|folha|🍃|🍂/, 'heart'],
    [/wing|asa|angel|anjo/, 'butterfly'],
    [/planet|planeta|🪐|saturn|saturno/, 'ring'],
    [/galaxy|galáxia|🌌/, 'spiral'],
    [/mandala|🌺|pattern|padrão/, 'radial_burst'],
    [/hexagon|hexágono|hex|🔷/, 'filled_circle'],
    [/triangle|triângulo|🔺/, 'layered_triangles'],
    [/square|quadrado|⬛/, 'grid'],
    [/pentagon|pentágono/, 'star'],
    [/atom|átomo|⚛/, 'ring'],
    [/yin.*yang|☯/, 'filled_circle'],
    [/trident|tridente|🔱/, 'cross'],
    [/robot|robô|🤖/, 'grid'],
    [/alien|et|👽/, 'filled_circle'],
    [/minas|belo.?horizonte|mg/, 'filled_circle'],
    [/brazil|brasil|🇧🇷/, 'diamond'],
  ];
  for (const [regex, shape] of map) {
    if (regex.test(lower)) return shape;
  }
  if (/^[a-zA-Z0-9\s]{1,10}$/.test(name.trim())) return 'text';
  return 'filled_circle';
}
