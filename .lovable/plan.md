
# Ciclo #31 — Horsetail Charcoal Weight, Saturn Ring Flatness, Coconut Tree Trunk Phase + Joi Show Design

## Bugs Identificados

| # | Bug | Local | Fix |
|---|-----|-------|-----|
| 1 | **Coconut tree pattern mismatch** — `burstSimulation.ts` gera `'coconut_tree'` mas `FireworkRenderer.tsx` L583 checa `pattern === 'coconut'` → branch nunca entra, usa physics genérica | FireworkRenderer L583 | Corrigir para `'coconut_tree'` |
| 2 | **Horsetail sem modifier no ShellBurstRenderer** — `stepParticle` tem `willowDroop` mas horsetail usa a mesma lógica genérica. Horsetail precisa de um `horsetailDroop` com ramp de gravidade até 6x (charcoal pesado vs willow 4.5x) | ShellBurstRenderer L512-518 | Adicionar `horsetailDroop` modifier |
| 3 | **Saturn ring não é plano o suficiente** — Ring stars têm `vy = (Math.random() - 0.5) * speed * 0.06` na burstSimulation e `0.05` no FireworkRenderer. Com gravidade, o anel deforma. Precisa de gravidade reduzida para ring stars | FireworkRenderer L320-335 | Gravidade 0.3x para ring stars |
| 4 | **Coconut tree sem 3-phase physics no ShellBurstRenderer** — O `ShellBurstRenderer` não diferencia coconut_tree de padrões genéricos | ShellBurstRenderer L512 | Adicionar modifier `coconutTreePhase` |
| 5 | **Joi não oferece presets temáticos variados** — Falta presets para shows corporativos, aniversários e shows de drone | JoiCommandPresets.tsx | Adicionar 2 novos presets |
| 6 | **System prompt não orienta sobre ritmo musical** — Shows profissionais sincronizam com música. Prompt não menciona BPM ou markers musicais | systemPrompt.ts | Adicionar seção sobre sync musical |

## Plano de Implementação

### Arquivo 1: `src/lib/pyroPhysics.ts`

**Fix: Adicionar `horsetailDroop` e `coconutPhase` ao StepModifiers**
- `horsetailDroop?: boolean` + `horsetailLifeRatio?: number` — progressive gravity ramp de 1.2x a 6x após 50% de vida (charcoal pesado)
- `coconutPhase?: 'ascent' | 'spread' | 'droop'` — 3-phase gravity: ascent 0.4x, spread 1.5x, droop 5x
- Implementar em `stepParticle` análogo ao `willowDroop`

### Arquivo 2: `src/components/editor/effects/ShellBurstRenderer.tsx`

**Fix: Horsetail + coconut_tree physics no useFrame**
- Após L518, adicionar branches para `pattern === 'horsetail'` e `pattern === 'coconut_tree'`
- Horsetail: `horsetailDroop: true, horsetailLifeRatio: lifeRatio`
- Coconut tree: calcular phase baseado em lifeRatio (< 0.3 ascent, < 0.6 spread, >= 0.6 droop)

### Arquivo 3: `src/components/editor/skycanvas/FireworkRenderer.tsx`

**Fix 1: Coconut tree pattern name** — L583: `'coconut'` → `'coconut_tree'`

**Fix 2: Saturn ring flatness** — Na branch saturn L320-335:
- Ring stars: reduzir `gravityMult` para 0.3 (ring fica plano mais tempo)
- Reduzir vy jitter de `0.05` para `0.02`
- Polar burst stars: manter gravidade normal

**Fix 3: Horsetail charcoal droop no FireworkRenderer**
- Branch horsetail L575-582: Aumentar ramp de 4.8 para 5.5 (mais droop que willow)
- Reduzir drag horizontal de 0.7 para 0.55 (charcoal pesado = menos resistência ao ar)

### Arquivo 4: `supabase/functions/fxk-ai-chat/systemPrompt.ts`

**Aprimoramento: Seção de sincronização musical**
- Adicionar guia de BPM → stagger timing (120BPM = 0.5s beats, 140BPM = 0.43s)
- Adicionar dica: "Se o cliente fornecer música, perguntar BPM e usar para calcular stagger"
- Adicionar seção de variação de intensidade por segmento (verso=Build, refrão=Clímax)

### Arquivo 5: `src/components/JoiCommandPresets.tsx`

**Novos presets:**
- **CORPORATIVO** — Show de 3min para eventos empresariais, cores da marca, estrutura elegante
- **ANIVERSÁRIO** — Show curto de 1.5min com heart shells e cores festivas

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Fix coconut_tree pattern name + Saturn ring flatness (FireworkRenderer) |
| 2 | Add horsetailDroop + coconutPhase to StepModifiers (pyroPhysics) |
| 3 | Integrate modifiers in ShellBurstRenderer |
| 4 | Joi prompt musical sync + novos presets |
| 5 | Deploy edge function + build verification |
