

## Sistema de Acreditação por IA para Órgãos Fiscalizadores

### Visão Geral

Criar um módulo de **Acreditação Inteligente de Documentação** que valida automaticamente por IA se toda a documentação necessária para cada órgão fiscalizador (Exército/SFPC, DECEA/ANAC, Bombeiros, Prefeitura) está completa, correta e em conformidade — gerando um **Relatório de Acreditação** com score de conformidade, pendências e documentos prontos para submissão.

### Componentes

**1. Tabela `accreditation_packages` no banco de dados**

Armazena pacotes de acreditação por evento/show, com status, órgão alvo, documentos vinculados e resultado da validação IA.

Campos: `id`, `user_id`, `event_id`, `agency` (enum: exercito, decea, bombeiros, prefeitura, anac), `status` (draft, validating, approved, rejected, submitted), `documents` (JSONB — lista de docs com nome, tipo, status, observações), `ai_validation_result` (JSONB — score, itens ok/pendentes/falhas), `created_at`, `updated_at`.

**2. Edge Function `validate-accreditation` (IA)**

Recebe o pacote de documentos e o órgão alvo. Usa Lovable AI (Gemini) com conhecimento regulatório embarcado no prompt para:
- Validar completude (todos os docs obrigatórios estão presentes?)
- Verificar coerência (datas, nomes, CNPJs consistentes entre docs?)
- Checkar conformidade (NFPA, R-105, RBAC-E, NRs aplicáveis)
- Gerar score 0-100% de conformidade
- Listar pendências específicas com orientação de como resolver
- Retornar resultado estruturado via tool calling

**3. Checklist Regulatório por Órgão (`src/utils/regulatoryChecklist.ts`)**

Definição estática dos documentos obrigatórios por órgão:

| Órgão | Documentos Obrigatórios |
|---|---|
| Exército (SFPC) | CR válido, Guia de Tráfego, R-105 compliance, relação de produtos |
| DECEA | Solicitação NOTAM, coordenadas GPS, KMZ, período, responsável técnico |
| Bombeiros | AVCB/CLCB, plano de segurança, laudo técnico, ART |
| Prefeitura | Alvará, licença evento, seguro RC |
| ANAC (drones) | Registro SISANT, autorização SARPAS, certificado piloto, seguro RETA |

**4. Painel de Acreditação na UI (`src/pages/AccreditationDashboard.tsx`)**

- Seletor de evento e órgão alvo
- Upload/vinculação de documentos (usa storage bucket existente)
- Botão "Validar com IA" → chama edge function
- Resultado visual: score circular, lista de itens ✅/⚠️/❌
- Botão "Gerar Pacote de Submissão" → exporta PDF/DOCX com todos os docs + relatório de conformidade
- Timeline de status (draft → validando → aprovado → submetido)

**5. Integração com Joi**

Atualizar o system prompt da Joi para reconhecer pedidos de acreditação e guiar o usuário:
- "Joi, preciso liberar o show X no Exército" → Joi lista docs necessários, verifica o que já tem, sugere próximos passos
- "Joi, valida minha documentação para o DECEA" → Joi aciona a validação IA e apresenta resultado

**6. Geração Automática de Documentos Faltantes**

Quando a IA detectar documentos faltantes, a Joi pode gerar automaticamente:
- Requerimento ao SFPC (preenchido com dados do evento)
- Solicitação de NOTAM (com coordenadas e KMZ anexo)
- Declaração de responsabilidade técnica
- Ofício para Bombeiros/Prefeitura

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/utils/regulatoryChecklist.ts` | Criar — checklists por órgão |
| `src/pages/AccreditationDashboard.tsx` | Criar — painel de acreditação |
| `supabase/functions/validate-accreditation/index.ts` | Criar — validação IA |
| `src/components/FXKAssistant.tsx` | Atualizar — integrar atalhos de acreditação |
| `supabase/functions/fxk-ai-chat/index.ts` | Atualizar — prompt com contexto de acreditação |
| Migration SQL | Criar tabela `accreditation_packages` com RLS |

### Detalhes Técnicos

```text
Fluxo de acreditação:
  Usuário seleciona evento + órgão
  → Sistema carrega checklist obrigatório do órgão
  → Usuário vincula/upload documentos existentes
  → Clique "Validar com IA"
  → Edge function recebe docs + checklist + órgão
  → IA analisa completude, coerência e conformidade
  → Retorna: { score: 87, items: [...], pendencias: [...] }
  → UI renderiza resultado com ações sugeridas
  → Docs faltantes: Joi pode gerar automaticamente
  → Pacote completo: exporta PDF consolidado para submissão

Modelo IA: google/gemini-3-flash-preview (structured output via tool calling)
Storage: bucket 'assets' existente para upload de docs
```

