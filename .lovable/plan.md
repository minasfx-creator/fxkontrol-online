

# Ciclo de Calibração #16 — Mine Comet Trail, Fan Spread, Cake Sequencing, Particle Height Extinction

## Problemas Identificados

| # | Problema | Impacto |
|---|---|---|
| 1 | **MineEffect sem comet trail** — partículas spray sobem mas não deixam trilha visível tipo cometa; falta trail ribbon/line segments acompanhando as stars mais rápidas | Mines parecem "secas" vs referência real |
| 2 | **FanEffect spread não calibrado por caliber** — `spreadAngle` fixo em 90°, ray speed linear; calibers maiores deveriam ter arcos mais largos e velocidades proporcionais | Fans de 5" e 2" parecem iguais |
| 3 | **CakeEffect sem sequencing physics** — cada shot usa `breakH * 0.7` fixo para altura, sem considerar caliber real; sem drag/gravidade na fase burst; partículas não se apagam na altura certa | Cake shots parecem irreais |
| 4 | **Partículas não se apagam na altura correta** — `starLife` no FireworkBurst é um multiplicador fixo do baseLife mas não é calibrado para que a estrela se extinga quando atinge a altitude correta relativa ao breakHeight do caliber | Estrelas de 3" duram tanto quanto de 8" visualmente |

## Solução

### 1. MineEffect — Adicionar Comet Trail nas Spray Stars
- Adicionar `LineSegments` para as partículas de spray (top 65%)
- Cada spray star gera 4-6 segmentos de trail com fade temporal
- Trail color: thermal ramp do branco-quente → cor base → ember
- Trail length proporcional à velocidade da partícula

### 2. FanEffect — Calibração de Spread por Caliber
- `spreadAngle` base escala com caliber: `70 + caliber * 8` graus (2"=86°, 5"=110°, 8"=134°)
- Ray speed escala: `(3.5 + caliber * 1.2) * caliberScale`
- Gravity strength proporcional ao caliber (stars mais pesadas caem mais)
- Particle size: `0.10 + caliber * 0.02`

### 3. CakeEffect — Sequencing Physics Calibrado
- Usar `getBreakHeight(caliber)` real (não `* 0.7`)
- Adicionar drag exponencial na fase burst: `exp(-dragCoeff * t)`
- Gravidade real na burst: `0.5 * GRAVITY * t² * 0.25`
- Star lifetime proporcional ao caliber via `getStarLifetime(caliber)`
- depthTest={false} em todos os materials (já falta no `<points>` e lift mesh)

### 4. Particle Height Extinction — Calibração por Caliber
No `FireworkRenderer.tsx` (FireworkBurst):
- Calcular `maxVisibleHeight` = `getBreakHeight(caliber) * 0.85` — a distância máxima que uma estrela deve percorrer antes de se apagar
- Aplicar `heightExtinction = clamp(1 - distance/maxVisibleHeight, 0, 1)` como multiplicador de brilho
- Isso garante que estrelas de 3" (breakH=105m) se apagam muito antes que estrelas de 8" (breakH=330m)
- Também aplicar no CakeEffect: cada shot burst extingue proporcionalmente ao caliber

## Detalhes Técnicos

### MineEffect Trail Implementation
```text
Para cada spray star (20-85% do array):
  - Manter buffer LineSegments com SPRAY_COUNT * TRAIL_SEGS * 6 floats
  - No useFrame: para cada trail seg, amostrar posição histórica
    com dt = 0.015 * segIndex, aplicar fade = (1 - segFrac)^2
  - Trail color blends: warm white → base → ember via thermalColorRamp
```

### Height Extinction Formula
```text
distance = sqrt(px² + py² + pz²)  // distância do centro do burst
maxRadius = breakSpeed * starLife * 0.4  // raio máximo calibrado
extinction = smoothstep(0.7, 1.0, distance / maxRadius)
brightness *= (1 - extinction)
```

## Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| `src/components/editor/effects/MineEffect.tsx` | Adicionar spray comet trails (LineSegments) |
| `src/components/editor/effects/FanEffect.tsx` | Calibrar spread/speed/size por caliber |
| `src/components/editor/effects/CakeEffect.tsx` | Physics calibrado, depthTest, height extinction |
| `src/components/editor/skycanvas/FireworkRenderer.tsx` | Height extinction por caliber no FireworkBurst |

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | FireworkRenderer.tsx — height extinction calibrado por caliber |
| 2 | MineEffect.tsx — comet trail nas spray stars |
| 3 | FanEffect.tsx — spread/speed calibrado por caliber |
| 4 | CakeEffect.tsx — physics calibrado + height extinction |
| 5 | Build verification |

