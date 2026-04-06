import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";

const CHECKLIST_DATA: Record<string, { label: string; requiredDocs: string[] }> = {
  exercito: {
    label: "Exército (SFPC)",
    requiredDocs: [
      "Certificado de Registro (CR)",
      "Título de Registro (TR)",
      "Guia de Tráfego",
      "Relação de Produtos",
      "Conformidade R-105",
      "Certificado de Habilitação (Blaster)",
      "Seguro RC Produtos Controlados",
    ],
  },
  decea: {
    label: "DECEA / NOTAM",
    requiredDocs: [
      "Solicitação de NOTAM",
      "Coordenadas GPS do Evento",
      "Raio de Restrição (NM)",
      "Altitude Máxima (pés AGL)",
      "Período (Data/Hora UTC)",
      "Responsável Técnico",
    ],
  },
  bombeiros: {
    label: "Corpo de Bombeiros",
    requiredDocs: [
      "AVCB / CLCB",
      "Plano de Segurança",
      "Laudo Técnico de Segurança",
      "ART (Anotação de Responsabilidade Técnica)",
      "Planta de Distanciamento",
    ],
  },
  prefeitura: {
    label: "Prefeitura Municipal",
    requiredDocs: [
      "Alvará de Funcionamento",
      "Licença de Evento",
      "Seguro de Responsabilidade Civil",
      "Contrato Social da Empresa",
    ],
  },
  anac: {
    label: "ANAC (Drones)",
    requiredDocs: [
      "Registro SISANT",
      "Autorização SARPAS",
      "Certificado do Piloto",
      "Seguro RETA",
      "Conformidade RBAC-E nº 94",
      "Classificação de Operação",
    ],
  },
};

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const { agency, documents, eventName } = await req.json();

    if (!agency || !CHECKLIST_DATA[agency]) {
      return new Response(JSON.stringify({ error: "Órgão inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const checklist = CHECKLIST_DATA[agency];
    const docList = (documents || []) as { name: string; description?: string }[];
    const docNames = docList.map((d: { name: string }) => d.name).join(", ");

    const prompt = `Você é um auditor regulatório especializado em pirotecnia, drones e eventos no Brasil.

Órgão fiscalizador: ${checklist.label}
Evento: ${eventName || "Não especificado"}

Documentos obrigatórios para este órgão:
${checklist.requiredDocs.map((d, i) => `${i + 1}. ${d}`).join("\n")}

Documentos fornecidos pelo usuário:
${docNames || "Nenhum documento fornecido"}

Detalhes dos documentos:
${docList.map((d: { name: string; description?: string }) => `- ${d.name}: ${d.description || "sem detalhes"}`).join("\n") || "Nenhum"}

Analise a completude e conformidade da documentação. Use a função validate_result para retornar o resultado.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um auditor regulatório do Brasil especializado em pirotecnia, drones e shows. Responda SOMENTE via tool calling." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "validate_result",
              description: "Retorna o resultado da validação de conformidade documental",
              parameters: {
                type: "object",
                properties: {
                  score: { type: "number", description: "Score de conformidade de 0 a 100" },
                  status: { type: "string", enum: ["approved", "pending", "rejected"], description: "Status geral da validação" },
                  summary: { type: "string", description: "Resumo executivo da análise em português" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        status: { type: "string", enum: ["ok", "missing", "incomplete", "expired"] },
                        observation: { type: "string" },
                      },
                      required: ["name", "status", "observation"],
                    },
                  },
                  recommendations: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de recomendações e próximos passos",
                  },
                },
                required: ["score", "status", "summary", "items", "recommendations"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "validate_result" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Aguarde alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos AI esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("No structured response from AI");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("validate-accreditation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
