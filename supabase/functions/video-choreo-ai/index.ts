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

    const { frameDataUrls, droneCount, context, mode } = await req.json();

    if (!frameDataUrls || !Array.isArray(frameDataUrls) || frameDataUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: "frameDataUrls array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit frames to prevent excessive token usage
    const maxFrames = Math.min(frameDataUrls.length, 8);
    const selectedFrames = selectKeyFrames(frameDataUrls, maxFrames);

    const systemPrompt = `You are an expert drone show choreographer and visual designer. You analyze video frames and create semantic drone formations that capture the MEANING and EMOTION of the video content, not just silhouettes.

Your job:
1. Analyze each frame deeply - identify objects, scenes, emotions, movements, narrative
2. For each frame, generate a meaningful drone formation that represents the semantic content
3. Suggest colors, heights, and transitions that match the mood
4. Create a narrative arc across formations

Output JSON with this exact structure:
{
  "analysis": "Brief description of what the video shows",
  "narrative": "The story arc you'll create with drone formations",
  "formations": [
    {
      "frameIndex": 0,
      "description": "What this formation represents",
      "shape": "semantic shape name (e.g. 'heart', 'wave', 'explosion', 'bird', 'text:HELLO')",
      "emotion": "calm|energetic|dramatic|playful|majestic|mysterious",
      "color": "#hexcolor",
      "secondaryColor": "#hexcolor",
      "height": 30,
      "heightVariation": 0.3,
      "spread": 1.0,
      "rotation": 0,
      "transitionStyle": "smooth|burst|spiral|cascade|morph",
      "points": [{"x": 0, "z": 0, "y": 30}],
      "suggestedHoldDuration": 3,
      "suggestedTransitionDuration": 4
    }
  ],
  "globalSuggestions": {
    "musicStyle": "suggested music genre",
    "tempo": "slow|medium|fast",
    "totalDuration": 60,
    "colorPalette": ["#hex1", "#hex2", "#hex3"]
  }
}

IMPORTANT:
- Generate ${droneCount || 300} drone points per formation as x,z coordinates (meters, centered at 0,0)
- y coordinate is height in meters (10-120m range)
- Create formations that tell a story, not just replicate pixels
- Use creative shapes: hearts, stars, spirals, text, animals, abstract patterns
- Each formation should flow naturally into the next
- Maximum radius of formations: ~40m from center`;

    const userContent: any[] = [];
    
    // Add context if provided
    if (context) {
      userContent.push({
        type: "text",
        text: `Context from user: ${context}\n\nMode: ${mode || 'semantic'}\nDrone count: ${droneCount || 300}\n\nAnalyze the following ${selectedFrames.length} key frames from the video and generate semantic drone formations:`
      });
    } else {
      userContent.push({
        type: "text", 
        text: `Drone count: ${droneCount || 300}\nMode: ${mode || 'semantic'}\n\nAnalyze the following ${selectedFrames.length} key frames from the video and generate semantic drone formations:`
      });
    }

    // Add frame images
    for (let i = 0; i < selectedFrames.length; i++) {
      userContent.push({
        type: "text",
        text: `Frame ${i + 1} of ${selectedFrames.length}:`
      });
      userContent.push({
        type: "image_url",
        image_url: { url: selectedFrames[i] }
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.7,
        max_tokens: 8000,
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

    // Extract JSON from response (may be wrapped in markdown code blocks)
    let parsed;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsed = JSON.parse(jsonMatch[1].trim());
    } catch (parseErr) {
      // Try direct parse
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

/**
 * Select evenly-spaced key frames from the full set
 */
function selectKeyFrames(frames: string[], count: number): string[] {
  if (frames.length <= count) return frames;
  const step = (frames.length - 1) / (count - 1);
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(frames[Math.round(i * step)]);
  }
  return result;
}
