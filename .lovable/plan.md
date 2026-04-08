

# Ciclo #45 — Aprimoramento Joi Show Creation Engine

## Análise de Gaps

| # | Gap | Local | Impacto |
|---|-----|-------|---------|
| 1 | **Contexto não inclui IDs dos timeline items** — Joi não consegue usar `update_effect` porque o contexto injetado (L394-396) só mostra contagem por tipo, não os IDs individuais. Impossível editar cues existentes | `FXKAssistant.tsx` L382-396 | Alto |
| 2 | **Sem comando `add_effects_batch`** — Para shows grandes, cada efeito é um `add_effect` separado dentro de `create_choreography`. Sem validação de posição antes de disparar. Se posição falha, todos os cues daquela posição falham silenciosamente | `joiCommandExecutor.ts` L331-375 | Médio |
| 3 | **`create_choreography` não retorna IDs criados** — Após criar um show, Joi não sabe os IDs dos efeitos que criou, impedindo edição posterior (update_effect requer ID) | `joiCommandExecutor.ts` L331-375 | Alto |
| 4 | **System prompt não orienta sobre `positionName` no `add_effect`** — O catálogo mostra effectId mas o prompt não enfatiza usar `positionName` (mais robusto que `positionIndex`) para cues individuais fora de choreography | `systemPrompt.ts` L76-78 | Baixo |
| 5 | **Modelo `gemini-3-flash-preview` menos preciso para JSON** — Para geração de shows complexos com dezenas de cues JSON, um modelo com melhor reasoning (gemini-2.5-pro ou gpt-5-mini) reduziria erros de formatação | `fxk-ai-chat/index.ts` L22 | Médio |

## Implementação

### 1. Contexto enriquecido com IDs (`FXKAssistant.tsx`)

Alterar o bloco de contexto (L382-396) para incluir IDs dos timeline items (últimos 30 para não estourar contexto):

```
Efeitos (5): joi-fx-abc [mort-01 @ P1, t=5.0s], joi-fx-def [shell-08 @ P3, t=12.0s], ...
```

Isso permite que Joi use `update_effect` com o ID correto.

### 2. `create_choreography` retorna IDs criados (`joiCommandExecutor.ts`)

Modificar o case `create_choreography` para coletar e retornar os IDs de todos os efeitos criados no campo `detail`, formatado como lista. Permite que Joi referencie efeitos em mensagens de follow-up.

### 3. Upgrade do modelo para shows (`fxk-ai-chat/index.ts`)

Trocar `google/gemini-3-flash-preview` → `google/gemini-2.5-flash` — melhor conformidade JSON com custo razoável.

### 4. System prompt: reforçar `positionName` e pós-criação (`systemPrompt.ts`)

Adicionar seção curta ao prompt:
- Preferir `positionName` sobre `positionIndex` para cues individuais
- Após `create_choreography`, informar ao usuário os IDs criados para permitir edição
- Nota sobre limite de 30 efeitos no contexto

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Enriquecer contexto com IDs dos timeline items |
| 2 | `create_choreography` retorna IDs no detail |
| 3 | Upgrade modelo para gemini-2.5-flash |
| 4 | Atualizar system prompt |
| 5 | Build verification |

