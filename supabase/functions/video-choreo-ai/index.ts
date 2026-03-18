import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { frameDataUrls, droneCount, context, mode, analysisDepth, depthEstimation, objectSegmentation } = await req.json();

    if (!frameDataUrls || !Array.isArray(frameDataUrls) || frameDataUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: "frameDataUrls array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const maxFrames = Math.min(frameDataUrls.length, 12);
    const selectedFrames = selectKeyFrames(frameDataUrls, maxFrames);
    const drones = droneCount || 300;
    const depth = analysisDepth || 'cinematic';

    const systemPrompt = buildSystemPrompt(drones, depth, !!depthEstimation, !!objectSegmentation);

    const userContent: any[] = [];

    userContent.push({
      type: "text",
      text: buildUserPrompt(selectedFrames.length, drones, context, mode, depth, !!depthEstimation, !!objectSegmentation),
    });

    for (let i = 0; i < selectedFrames.length; i++) {
      userContent.push({
        type: "text",
        text: `[Frame ${i + 1}/${selectedFrames.length} — T=${((i / (selectedFrames.length - 1)) * 100).toFixed(0)}% of video]`,
      });
      userContent.push({
        type: "image_url",
        image_url: { url: selectedFrames[i] },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.6,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a few seconds." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `AI processing failed (${response.status})` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No response from AI model" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsed = JSON.parse(jsonMatch[1].trim());
    } catch {
      try {
        parsed = JSON.parse(content);
      } catch {
        console.error("Failed to parse AI response:", content.substring(0, 500));
        return new Response(
          JSON.stringify({ error: "Failed to parse AI response", raw: content.substring(0, 200) }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Post-process: ensure all formations have enough points
    if (parsed.formations) {
      for (const f of parsed.formations) {
        if (!f.points || f.points.length < drones) {
          f.points = generateShapePoints(f.shape || 'scatter', drones, f.height || 30, f.spread || 1.0);
        }
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("video-choreo-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── System Prompt Builder ────────────────────────────────────

function buildSystemPrompt(droneCount: number, depth: string, depthEstimation: boolean, objectSegmentation: boolean): string {
  let prompt = `You are a world-class drone show choreographer and cinematic director. You design drone light shows performed by swarms of ${droneCount} LED-equipped drones.

## Your Expertise
- Temporal storytelling through aerial formations
- Motion analysis: detecting movement direction, speed, camera angles
- Emotional arc design: building tension, climax, and resolution
- Color theory for aerial displays (considering night sky contrast)
- Physics-aware transitions (drones have max velocity ~15m/s)
- Audience perspective optimization (ground-level viewing angle ~30-60°)

## Analysis Protocol (${depth} mode)

### Phase 1: Scene Understanding
For each frame, identify:
- Primary subjects and objects
- Scene composition and visual weight
- Motion vectors (what's moving, direction, speed)
- Lighting conditions and dominant colors
- Emotional tone and energy level

### Phase 2: Temporal Narrative
Across all frames, determine:
- Story arc (beginning → development → climax → resolution)
- Motion continuity between frames
- Rhythm and pacing
- Recurring visual motifs

### Phase 3: Formation Design
For each formation:
- Choose shapes that REPRESENT the meaning (not pixel copies)
- Design transitions that FLOW naturally
- Use height dramatically (low=intimate, high=epic)
- Apply color psychology (warm=energy, cool=calm, white=climax)

## Output Format (strict JSON)
{
  "analysis": "Detailed description of video content and visual narrative",
  "narrative": "The emotional story arc you'll create with the drone show",
  "motionAnalysis": "Description of movement patterns detected across frames",
  "formations": [
    {
      "frameIndex": 0,
      "description": "Detailed description of what this formation represents and why",
      "shape": "shape name — use specific terms: heart, star, spiral, wave, text:WORD, bird, tree, crown, ring, helix, phoenix, diamond, infinity, arrow, firework-burst, cascade, dna-helix, butterfly, globe",
      "emotion": "calm|building|energetic|dramatic|playful|majestic|mysterious|euphoric|intimate|triumphant",
      "intensity": 0.7,
      "color": "#hexcolor (primary LED color)",
      "secondaryColor": "#hexcolor (accent color for gradients/patterns)",
      "colorGradient": "none|radial|linear-vertical|linear-horizontal|spiral",
      "height": 35,
      "heightVariation": 0.4,
      "spread": 1.0,
      "rotation": 0,
      "tilt": 0,
      "density": 1.0,
      "transitionStyle": "smooth|burst|spiral|cascade|morph|wave-propagation|scatter-reform|ripple|bloom|collapse",
      "transitionEasing": "ease-in-out|ease-in|ease-out|linear|bounce|elastic",
      "points": [{"x": 0, "z": 0, "y": 30}],
      "suggestedHoldDuration": 4,
      "suggestedTransitionDuration": 5,
      "motionDuringHold": "static|breathe|rotate-slow|pulse|sway|shimmer",
      "ledEffect": "solid|blink|breathe|rainbow-wave|sparkle|gradient-shift"
    }
  ],
  "globalSuggestions": {
    "musicStyle": "suggested music genre/mood",
    "tempo": "slow|medium|fast|variable",
    "totalDuration": 90,
    "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4"],
    "showStyle": "narrative|abstract|celebration|cinematic|musical",
    "audienceDirection": "north|south|east|west (primary viewing direction)",
    "climaxFormationIndex": 3,
    "openingEffect": "gradual-ascent|burst-scatter|spiral-up|wave-launch",
    "finaleEffect": "firework-scatter|heartbeat-pulse|slow-descent|bloom-out"
  }
}

CRITICAL RULES:
- Generate EXACTLY ${droneCount} points per formation as x,z coordinates in meters centered at (0,0)
- y coordinate is HEIGHT in meters (range 10-120m, most formations 25-60m)
- Maximum formation radius: ~45m from center
- Minimum safe distance between drones: 1.5m
- Create formations that tell a STORY — not pixel reproductions
- Transitions must be physically achievable (~15m/s max drone speed)
- Each formation should have a CLEAR reason for existing in the narrative
- Color choices must work against a DARK NIGHT SKY
- Formations should be recognizable from GROUND LEVEL (optimize for ~30° viewing angle)
- Use HEIGHT as a dramatic tool: climax = higher, intimate = lower
- Generate at least 5 and at most 12 formations for a compelling show`;

  if (depthEstimation) {
    prompt += `

## Depth Estimation (ENABLED)
For each formation, you MUST also provide a "depthLayers" field with depth analysis:
- Identify foreground, midground, and background elements
- Assign height multipliers: foreground=1.0 (lowest), midground=1.3, background=1.6
- Each point should have a "depthLayer" property: "foreground"|"midground"|"background"
- Use depth to create TRUE 3D formations, not flat projections
- Objects closer to camera should be lower, farther objects higher
- This creates dramatic parallax when viewed from ground level

Add to each formation:
"depthLayers": {
  "foreground": { "heightMultiplier": 1.0, "count": N },
  "midground": { "heightMultiplier": 1.3, "count": N },
  "background": { "heightMultiplier": 1.6, "count": N }
}`;
  }

  if (objectSegmentation) {
    prompt += `

## Object Segmentation (ENABLED)
For each frame, you MUST identify distinct objects/subjects and provide a "segments" field:
- Detect separate objects (people, animals, vehicles, text, logos, abstract shapes)
- Each segment gets its own drone group with independent color and movement
- Provide bounding boxes as normalized coordinates (0-1) for each segment
- Segments can have different motionDuringHold behaviors
- This enables multi-layer formations where different objects move independently

Add to each formation:
"segments": [
  {
    "label": "person",
    "boundingBox": { "x": 0.2, "y": 0.1, "w": 0.3, "h": 0.6 },
    "dronePercentage": 0.4,
    "color": "#hex",
    "motionDuringHold": "breathe",
    "depthLayer": "foreground"
  }
]`;
  }

  return prompt;
}

function buildUserPrompt(
  frameCount: number,
  droneCount: number,
  context: string | undefined,
  mode: string | undefined,
  depth: string,
): string {
  let prompt = `## Show Parameters
- Drone fleet: ${droneCount} drones with full-color RGB LEDs
- Analysis depth: ${depth}
- Frame count: ${frameCount} key frames from source video

`;

  if (context) {
    prompt += `## Creative Direction from Client
${context}

`;
  }

  prompt += `## Task
Analyze the ${frameCount} frames below in sequence. They represent key moments from a video. 

1. First, understand the STORY the video tells
2. Identify MOTION patterns and temporal flow
3. Design a drone show that CAPTURES THE ESSENCE of this video
4. Each formation should represent a meaningful moment
5. Transitions should feel natural and physically achievable
6. Create an emotional arc: opening → build → climax → resolution

Generate the full JSON response with all ${droneCount} coordinate points per formation.`;

  return prompt;
}

// ─── Shape Point Generator (server-side fallback) ─────────────

function generateShapePoints(
  shape: string,
  count: number,
  height: number,
  spread: number,
): { x: number; z: number; y: number }[] {
  const points: { x: number; z: number; y: number }[] = [];
  const r = 25 * spread;

  if (shape.startsWith('text:')) {
    // Simple text-like grid
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / Math.ceil(Math.sqrt(count)));
      const col = i % Math.ceil(Math.sqrt(count));
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      points.push({
        x: (col / cols - 0.5) * r * 2,
        z: (row / rows - 0.5) * r,
        y: height + (Math.random() - 0.5) * 4,
      });
    }
  } else if (shape === 'heart') {
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      const noise = 1 + (Math.random() - 0.5) * 0.3;
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hz = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      points.push({
        x: (hx / 16) * r * noise,
        z: (hz / 16) * r * noise,
        y: height + (Math.random() - 0.5) * 6,
      });
    }
  } else if (shape === 'star') {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const spike = i % 2 === 0 ? 1.0 : 0.45;
      const dist = r * spike * (0.8 + Math.random() * 0.4);
      points.push({
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        y: height + (Math.random() - 0.5) * 5,
      });
    }
  } else if (shape === 'spiral' || shape === 'helix') {
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 6;
      const radius = (i / count) * r;
      points.push({
        x: Math.cos(t) * radius,
        z: Math.sin(t) * radius,
        y: height + (i / count) * 20 - 10,
      });
    }
  } else if (shape === 'ring' || shape === 'circle') {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const ringR = r * (0.85 + Math.random() * 0.3);
      points.push({
        x: Math.cos(angle) * ringR,
        z: Math.sin(angle) * ringR,
        y: height + (Math.random() - 0.5) * 3,
      });
    }
  } else if (shape === 'wave') {
    for (let i = 0; i < count; i++) {
      const x = (i / count - 0.5) * r * 2;
      const wave = Math.sin((i / count) * Math.PI * 4) * r * 0.4;
      points.push({
        x,
        z: wave,
        y: height + Math.sin((i / count) * Math.PI * 2) * 8,
      });
    }
  } else if (shape === 'firework-burst') {
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const dist = r * (0.3 + Math.random() * 0.7);
      points.push({
        x: Math.sin(phi) * Math.cos(theta) * dist,
        z: Math.sin(phi) * Math.sin(theta) * dist,
        y: height + Math.cos(phi) * dist * 0.6,
      });
    }
  } else if (shape === 'phoenix' || shape === 'bird' || shape === 'butterfly') {
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      const wing = Math.abs(Math.sin(t * 2)) * r;
      const body = Math.cos(t) * r * 0.15;
      const side = Math.sin(t) > 0 ? 1 : -1;
      points.push({
        x: side * wing * (0.8 + Math.random() * 0.4),
        z: body + Math.sin(t * 3) * 3,
        y: height + Math.abs(Math.sin(t)) * 10,
      });
    }
  } else if (shape === 'globe' || shape === 'sphere') {
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      points.push({
        x: Math.sin(phi) * Math.cos(theta) * r * 0.8,
        z: Math.sin(phi) * Math.sin(theta) * r * 0.8,
        y: height + Math.cos(phi) * r * 0.5,
      });
    }
  } else if (shape === 'diamond') {
    for (let i = 0; i < count; i++) {
      const t = (i / count) * 4;
      const segment = Math.floor(t);
      const frac = t - segment;
      let x = 0, z = 0;
      if (segment === 0) { x = frac; z = frac; }
      else if (segment === 1) { x = 1 - frac; z = frac; }
      else if (segment === 2) { x = -frac; z = 1 - frac; }
      else { x = frac - 1; z = -frac; }
      const noise = (Math.random() - 0.5) * 0.15;
      points.push({
        x: (x + noise) * r,
        z: (z + noise) * r,
        y: height + (Math.random() - 0.5) * 4,
      });
    }
  } else if (shape === 'infinity') {
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      const scale = 1 / (1 + Math.sin(t) * Math.sin(t) * 0.5);
      points.push({
        x: Math.cos(t) * r * scale,
        z: Math.sin(t) * Math.cos(t) * r * 0.6 * scale,
        y: height + (Math.random() - 0.5) * 4,
      });
    }
  } else if (shape === 'cascade') {
    for (let i = 0; i < count; i++) {
      const layer = Math.floor((i / count) * 8);
      const inLayer = (i / count) * 8 - layer;
      const layerR = r * (1 - layer * 0.1);
      const angle = inLayer * Math.PI * 2;
      points.push({
        x: Math.cos(angle) * layerR * (0.3 + inLayer * 0.7),
        z: Math.sin(angle) * layerR * (0.3 + inLayer * 0.7),
        y: height + layer * 5 - 15,
      });
    }
  } else {
    // Default: scattered sphere
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * r;
      points.push({
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        y: height + (Math.random() - 0.5) * 10,
      });
    }
  }

  return points.slice(0, count);
}

// ─── Key Frame Selection ──────────────────────────────────────

function selectKeyFrames(frames: string[], count: number): string[] {
  if (frames.length <= count) return frames;
  const step = (frames.length - 1) / (count - 1);
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(frames[Math.round(i * step)]);
  }
  return result;
}
