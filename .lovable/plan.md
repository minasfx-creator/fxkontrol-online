
# Ciclo de Polish #29 — Willow Droop Weight, Brocade Crown Pistil Delay, Palm Frond Symmetry

## Bugs Identificados

| # | Bug | Local | Fix |
|---|-----|-------|-----|
| 1 | **Willow sem droop progressivo** — `stepParticle` aplica gravidade constante para willow. Willow real tem estrelas de carvão pesadas que "gotejam" com aceleração crescente após 50% de vida (gravity ramp 1→4.5x). Atualmente parece chrysanthemum lento | `pyroPhysics.ts` stepParticle, `ShellBurstRenderer.tsx` L502-517 |
| 2 | **Willow velocity muito baixo** — velocity 20 em burstSimulation produz burst visualmente compacto. Finale 3D reference usa ~22 com spread mais amplo e tailFactor ~2.0 | `burstSimulation.ts` L23 |
| 3 | **Brocade crown sem pistil delay** — pistil ignita simultaneamente com as estrelas externas. Brocade crown real tem retardo de ~250ms no pistil (ignição secundária). Pistil deve aparecer 250ms após o burst principal | `ShellBurstRenderer.tsx` L560-589 |
| 4 | **Palm sem simetria de fronds** — distribuição aleatória no cone upward sem agrupamento radial. Palm real tem 5-7 "fronds" (braços) simétricos que caem em arco. Sem isso, parece horsetail | `pyroPhysics.ts` L604-608, `FireworkRenderer.tsx` L221-223, `burstSimulation.ts` L82-89 |
| 5 | **Palm gravityMult insuficiente** — 1.2 não cria o droop característico das fronds. Needs ~1.6 para que os braços formem arcos visíveis | `burstSimulation.ts` L24 |

## Plano de Implementação

### Arquivo 1: `src/lib/pyroPhysics.ts`

**Fix 1: Willow droop weight em `StepModifiers`**
- Adicionar `willowDroop?: boolean` ao `StepModifiers`
- Em `stepParticle`, quando `willowDroop` e `lifeRatio > 0.5`: multiplicar gravidade por `1 + 3.5 * ((lifeRatio - 0.5) / 0.5)` — aceleração de queda progressiva

**Fix 2: Palm frond symmetry em `createShellBurst`**
- Reescrever case `'palm'` para agrupar em 6 braços simétricos (armAngle = i%6 * 60°) com ±6° jitter
- Upward bias mantido, mas dentro de cada braço

### Arquivo 2: `src/render_ultra/fireworks/burstSimulation.ts`

**Fix 3: Willow config tuning**
- `willow` velocity: 20 → 22
- `willow` tailFactor: 1.5 → 2.0
- `willow` gravityMult: 1.4 → 1.8

**Fix 4: Palm frond symmetry + gravity**
- `palm` gravityMult: 1.2 → 1.6
- `palm` symmetry: 6 (já está, usar no generateBurst)
- Reescrever branch `palm` em `generateBurst` para agrupar em 6 fronds com ±6° jitter

### Arquivo 3: `src/components/editor/effects/ShellBurstRenderer.tsx`

**Fix 5: Willow droop no physics loop**
- No `useFrame`, se `pattern === 'willow'`: passar `willowDroop: true` no StepModifiers

**Fix 6: Brocade crown pistil delay**
- No step pistil loop (L560-589): adicionar check `if (pattern === 'brocade_crown' && time < 0.25) skip pistil stepping` — pistil só começa a avançar 250ms após burst

### Arquivo 4: `src/components/editor/skycanvas/FireworkRenderer.tsx`

**Fix 7: Palm frond symmetry alinhado**
- Reescrever case `'palm'` (L221-223) com 6 braços simétricos consistentes com burstSimulation

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Willow droop weight (StepModifiers + ShellBurstRenderer + burstSimulation) |
| 2 | Brocade crown pistil delay |
| 3 | Palm frond symmetry (pyroPhysics + burstSimulation + FireworkRenderer) |
| 4 | Build verification |
