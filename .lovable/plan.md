

# Joi Show Creation — Aprimoramento Ciclo #34

## Problemas Identificados

| # | Bug/Gap | Impacto |
|---|---------|---------|
| 1 | **Presets operacionais nunca aparecem** — `getContextPresets()` retorna `PRESETS_COMMAND` ou `PRESETS_EDITOR` (documentação/licenças). Os `OPERATIONAL_PRESETS` de `JoiCommandPresets.tsx` (Réveillon, Casamento, Finale, etc.) nunca são exibidos ao usuário | Crítico — usuário não vê os presets de shows |
| 2 | **Joi não conhece o projeto atual** — System prompt não recebe contexto das posições e efeitos já existentes. Joi não pode "adicionar mais efeitos nas posições existentes" ou "modificar a coreografia" | Alto — não consegue iterar sobre shows |
| 3 | **create_choreography não reporta falhas individuais** — Se 3 de 20 cues falham, retorna só "Coreografia criada" sem detalhe das falhas | Médio — esconde problemas |
| 4 | **Faltam comandos: clear_project, list_positions, list_effects** — Joi não pode listar o que já existe nem limpar o projeto para recomeçar | Médio — UX limitada |
| 5 | **System prompt não instrui sobre erro recovery** — Se um efeito não é encontrado, Joi não sabe sugerir alternativas | Baixo — UX |

## Plano de Implementação

### 1. `src/components/FXKAssistant.tsx` — Mostrar presets operacionais + enviar contexto do projeto

- Modificar `getContextPresets()` para incluir os `OPERATIONAL_PRESETS` na tela do editor (combinar com `PRESETS_EDITOR` ou substituir por tabbed view)
- No `send()`, antes de enviar mensagens à API, injetar um **system context message** com o estado atual do projeto:
  ```
  { role: "system", content: `[CONTEXTO DO PROJETO]\nPosições: ${positions.map(p => `${p.name} (${p.type}) @ (${p.x}, ${p.z})`).join(', ')}\nEfeitos na timeline: ${timelineItems.length}\nTempo atual: ${currentTime}s` }
  ```

### 2. `src/utils/joiCommandExecutor.ts` — Novos comandos + melhorar feedback

**Novos comandos:**
- `clear_project` — Remove todas posições e efeitos (com confirmação visual)
- `list_positions` — Retorna lista das posições existentes no label do resultado
- `list_effects` — Retorna lista dos efeitos na timeline

**Melhorar `create_choreography`:**
- Rastrear falhas individuais de cues e incluir no detail: `"15 posições + 42 cues (3 falharam)"`
- Adicionar `add_cue_marker` automático para seções do show (Abertura, Build, Clímax, Finale) se `params.sections` presente

### 3. `supabase/functions/fxk-ai-chat/systemPrompt.ts` — Contexto + error recovery

- Adicionar seção sobre como usar contexto do projeto: "Quando o usuário pedir para modificar o show, leia o [CONTEXTO DO PROJETO] para saber as posições e efeitos existentes"
- Adicionar guia de error recovery: "Se um effectId falhar, sugira effectIds alternativos similares"
- Documentar novos comandos: `clear_project`, `list_positions`, `list_effects`
- Adicionar instruções para criar seções com cue markers automáticos

### 4. `src/components/JoiCommandPresets.tsx` — Refinar presets

- Adicionar preset **"MODIFICAR SHOW"** — prompt que pede à Joi para analisar o projeto atual e sugerir melhorias
- Adicionar preset **"LIMPAR PROJETO"** — clear_project + confirmação

### 5. Deploy + Build

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Novos comandos no joiCommandExecutor + feedback melhorado |
| 2 | Presets operacionais visíveis + contexto do projeto no FXKAssistant |
| 3 | System prompt: contexto, error recovery, novos comandos |
| 4 | Novos presets (Modificar, Limpar) |
| 5 | Deploy edge function + build verification |

