

# Ciclo #41 — Joi Command Engine: Conformidade Finale 3D + Bugs

## Bugs & Gaps Identificados

| # | Bug/Gap | Local | Impacto |
|---|---------|-------|---------|
| 1 | **`update_effect` ausente** — Joi pode adicionar e remover efeitos mas não pode mover um efeito no tempo (startTime) ou trocar posição. Finale 3D suporta edição inline de cues. Força o fluxo "remove + add" que perde o ID original | `joiCommandExecutor.ts` | Alto |
| 2 | **`duplicate_position` ausente** — Para layouts simétricos (espelhamento), Joi precisa criar posições manualmente. Finale 3D tem "Mirror" e "Duplicate" nativos | `joiCommandExecutor.ts` | Médio |
| 3 | **`set_duration` ausente** — Joi não pode alterar a duração do show. O sistema prompt menciona "duração" no contexto mas não há comando para configurá-la | `joiCommandExecutor.ts` | Médio |
| 4 | **Contexto enviado como `role: 'user'`** — L394-397 injeta o contexto do projeto como mensagem de usuário. Isso confunde o modelo — deveria ser `role: 'system'` para não ser interpretado como input do usuário | `FXKAssistant.tsx` L394 | Alto |
| 5 | **System prompt sem `update_effect` / `duplicate_position` / `set_duration`** — Mesmo que adicionemos ao executor, a Joi não saberá usá-los sem documentação no prompt | `systemPrompt.ts` | Alto |
| 6 | **`add_effect` não passa `duration`** — Cues criadas pela Joi não preservam duração customizada (waterfalls, gerbs, cold sparks que duram 10-30s). Usam o default do store | `joiCommandExecutor.ts` L227 | Médio |

## Implementação

### Arquivo 1: `src/utils/joiCommandExecutor.ts`

**Fix 1 — Novo comando `update_effect`:**
```
case 'update_effect': {
  const target = store.timelineItems.find(i => i.id === params.id);
  if (!target) return { action, success: false, label: 'Efeito não encontrado' };
  const updates: Partial<TimelineItem> = {};
  if (params.startTime !== undefined) updates.startTime = params.startTime;
  if (params.positionId) { updates.positionId = params.positionId; /* + resolve xyz */ }
  if (params.positionName) { /* find + update position */ }
  if (params.effectId) updates.effectId = params.effectId;
  if (params.duration !== undefined) updates.duration = params.duration;
  store.updateTimelineItem(target.id, updates);
  return success;
}
```

**Fix 2 — Novo comando `duplicate_position`:**
- Copia posição existente com offset em X (+5m default)
- Suporta `mirror: true` para espelhamento em X (x → -x)

**Fix 3 — Novo comando `set_duration`:**
- Chama `store.setDuration(params.duration)`

**Fix 4 — `add_effect` passa `duration`:**
- Adicionar `duration: params.duration` ao objeto do timeline item quando fornecido

### Arquivo 2: `src/components/FXKAssistant.tsx`

**Fix 5 — Contexto como `role: 'system'`:**
- L394: trocar `role: 'user' as const` por `role: 'system' as const`
- Garante que o modelo trata como instrução interna, não como pergunta do usuário

### Arquivo 3: `supabase/functions/fxk-ai-chat/systemPrompt.ts`

**Fix 6 — Documentar novos comandos no system prompt:**
- Adicionar `update_effect`, `duplicate_position`, `set_duration` à seção de comandos
- Adicionar nota sobre `duration` no `add_effect` para efeitos de longa duração (waterfalls, gerbs)

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Novos comandos no executor (update_effect, duplicate_position, set_duration) + fix duration no add_effect |
| 2 | Fix contexto role: system no FXKAssistant |
| 3 | Atualizar system prompt com novos comandos |
| 4 | Build verification |

