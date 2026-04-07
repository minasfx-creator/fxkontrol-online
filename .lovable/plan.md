

# Ciclo de Polish #28 — Peony Petal Density, Chrysanthemum Tip Curl, Dahlia Flash Timing

## Bugs Identificados

| # | Bug | Local | Fix |
|---|-----|-------|-----|
| 1 | **Peony = esfera genérica** — `createShellBurst` case `'peony'` (L632-638) e `generateBurst` fallback (L242-249) usam distribuição esférica uniforme. Peony real tem estrelas agrupadas em "pétalas" (clusters densos de 10-14 grupos azimutais). Resultado atual: esfera homogênea indistinguível de chrysanthemum | `pyroPhysics.ts` L632, `burstSimulation.ts` L242 |
| 2 | **Chrysanthemum sem tip curl** — `stepParticle` aplica gravidade constante (`GRAVITY * gravityFactor`). Chrysanthemum real tem pontas que "curvam" para baixo no final da vida (drag progressivo após 70% de vida). Sem isso, chrysanthemum parece peony com trail | `pyroPhysics.ts` L499-552, `burstSimulation.ts` L90 |
| 3 | **Dahlia sem flash de detonação** — Dahlia tem estrelas grandes e rápidas com flash inicial intenso. O `ShellBurstRenderer` já tem `detonationPhase` no vertex shader mas não diferencia dahlia de outros padrões. Dahlia deveria ter burst flash 2.5x mais intenso e duração 50% menor | `ShellBurstRenderer.tsx` L821, `burstSimulation.ts` L204 |
| 4 | **Peony starCount baixo** — 150 estrelas (L21) é insuficiente para a densidade visual de um peony real (Finale 3D usa ~280 para 3"). Resulta em burst visualmente esparso | `burstSimulation.ts` L21 |
| 5 | **Chrysanthemum tailFactor insuficiente** — 0.9 (L22) não cria os trails longos e distintos que definem chrysanthemum vs peony. Finale 3D usa ~1.4 | `burstSimulation.ts` L22 |

## Plano de Implementação

### Arquivo 1: `src/lib/pyroPhysics.ts`

**Fix 1: Peony petal clustering**
- Reescrever case `'peony'` (L632-638) para agrupar estrelas em 10-14 clusters azimutais
- Cada cluster: ângulo central + jitter de ±8°, velocidade 0.85-1.0 do breakSpeed
- Clusters distribuídos uniformemente em azimute, com elevação hemisférica superior ligeiramente favorecida

**Fix 2: Chrysanthemum tip curl em `stepParticle`**
- Adicionar campo opcional `pattern` ao `ParticleState` interface
- Em `stepParticle`, quando `pattern === 'chrysanthemum'` e `lifeRatio > 0.7`: multiplicar gravidade por `1 + 2.5 * ((lifeRatio - 0.7) / 0.3)` — cria curvatura progressiva nas pontas
- Alternativa (menor impacto): adicionar `tipCurlFactor` ao `StepModifiers` para não poluir `ParticleState`

**Fix 3: Setar `tipCurlFactor` para chrysanthemum no `createShellBurst`**
- Em case `'chrysanthemum'` (L603-608): retornar partículas com flag para tip curl

### Arquivo 2: `src/render_ultra/fireworks/burstSimulation.ts`

**Fix 4: Peony starCount + petal distribution**
- `peony` starCount: 150 → 280
- `peony` velocity: 28 → 26 (ligeiramente menor para manter raio visual)
- Reescrever branch `peony` em `generateBurst` (L242-249) com petal clustering: 12 clusters, ±8° jitter por cluster

**Fix 5: Chrysanthemum tail + tip curl config**
- `chrysanthemum` tailFactor: 0.9 → 1.4
- `chrysanthemum` gravityMult: 0.8 → 1.0 (tip curl handled via progressive increase)

**Fix 6: Dahlia velocity tightening + flash config**
- `dahlia` velocity: 38 → 42 (mais rápido, mais curto)
- `dahlia` starCount: 80 → 60 (menos estrelas, maiores)
- `dahlia` spread: 0.8 → 0.9 (mais uniforme)

### Arquivo 3: `src/components/editor/effects/ShellBurstRenderer.tsx`

**Fix 7: Chrysanthemum tip curl no physics loop**
- No `useFrame` (L490-740), após `stepParticle`, se `pattern === 'chrysanthemum'`: aplicar gravidade extra progressiva `p.vy += GRAVITY * 2.5 * max(0, lifeRatio - 0.7) / 0.3 * dt`

**Fix 8: Dahlia detonation flash boost**
- No burst flash sphere (L821-835): se `pattern === 'dahlia'`, multiplicar `burstFlashIntensity` por 2.5 e estender duração do flash para `progress < 0.12`
- No secondary flash ring (L838-853): mesma lógica para dahlia

### Arquivo 4: `src/components/editor/skycanvas/FireworkRenderer.tsx`

**Fix 9: Alinhar FireworkRenderer dahlia com novo timing**
- Ajustar velocidade e lifetime do case `'dahlia'` (L238-241) para consistência com burstSimulation

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Peony petal clustering (pyroPhysics + burstSimulation) |
| 2 | Chrysanthemum tip curl (StepModifiers + ShellBurstRenderer) |
| 3 | Dahlia flash boost + velocity tuning |
| 4 | Build verification |

