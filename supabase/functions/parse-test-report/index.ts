import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pdfBase64, fileName } = await req.json();
    if (!pdfBase64) throw new Error("No PDF data provided");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a pyrotechnic test report parser. Extract product specifications from FFIC/BAM test report content. Return structured data using the extract_product_spec tool.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Parse this FFIC test report PDF (filename: ${fileName}) and extract the product specification data. Look for: product name, caliber, tube dimensions (height, outer diameter, inner diameter in mm), effect charge weight (g), lift charge weight (g), burst charge weight (g), total weight (g), fuse delay range (min/max in seconds), UN number, classification code, and chemical composition table (compound names and percentages).` },
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_product_spec",
              description: "Extract structured product specification from a pyrotechnic test report.",
              parameters: {
                type: "object",
                properties: {
                  productName: { type: "string" },
                  caliber: { type: "string" },
                  tubeDimensions: {
                    type: "object",
                    properties: {
                      heightMM: { type: "number" },
                      outerDiaMM: { type: "number" },
                      innerDiaMM: { type: "number" },
                    },
                    required: ["heightMM", "outerDiaMM", "innerDiaMM"],
                  },
                  effectChargeG: { type: "number" },
                  liftChargeG: { type: "number" },
                  burstChargeG: { type: "number" },
                  totalWeightG: { type: "number" },
                  fuseDelayMin: { type: "number" },
                  fuseDelayMax: { type: "number" },
                  unNumber: { type: "string" },
                  classCode: { type: "string" },
                  chemicalComposition: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        compound: { type: "string" },
                        percentage: { type: "number" },
                      },
                      required: ["compound", "percentage"],
                    },
                  },
                },
                required: ["productName", "caliber", "tubeDimensions", "effectChargeG", "liftChargeG", "burstChargeG", "totalWeightG", "fuseDelayMin", "fuseDelayMax", "unNumber", "classCode", "chemicalComposition"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_product_spec" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("No structured output from AI");
    }

    const spec = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ spec }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-test-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
