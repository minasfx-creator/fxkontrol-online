

# Ciclo de Polish #22 — Horsetail Droop, Coconut Frond Physics, Brocade Crown Pistil Timing

## Bugs Identificados

| # | Bug | Detalhe |
|---|-----|---------|
| 1 | **Horsetail sem droop progressivo** — stars caem pelo branch generico `else` no loop de fisica (L553-556), usando `gravityMult` constante (2.0). Horsetail real precisa de gravidade crescente na fase tardia (como willow) mas mais agressiva, pois charcoal stars sao pesadas | Adicionar branch dedicado `pattern === 'horsetail'` com gravidade progressiva: 1.2x ate 50% vida, depois ramp ate 6x |
| 2 | **Coconut tree sem frond physics** — stars usam branch generico. Coconut real: stars sobem em cone apertado, abrem lateralmente ("fronds") na fase media, depois curvam para baixo com gravidade pesada | Adicionar branch dedicado com 3 fases: ascent (0-30%), frond spread (30-60%), droop (60-100%) |
| 3 | **Pistil sem delay temporal** — pistil aparece no mesmo instante que o shell externo. Brocade crown real tem pistil que detona ~200-300ms apos o break externo | Adicionar `pistilDelay` no calculo de posicao do pistil; antes do delay, pistil fica invisivel (size=0) |
| 4 | **Trails do horsetail/coconut usam gravityMult generico** — trail segments (L666-684) nao aplicam droop progressivo, entao trails ficam retos enquanto stars curvam | Aplicar mesma logica de droop progressivo nos trail segments para esses patterns |

## Plano de Implementacao

### Arquivo: `src/components/editor/skycanvas/FireworkRenderer.tsx`

**1. Horsetail dedicated physics branch (apos willow, antes do else)**
- Gravidade progressiva: `starAge < 0.5 ? gravityMult * 1.2 : gravityMult * (1.2 + (starAge - 0.5) / 0.5 * 4.8)` — ramp ate 6x
- Drag horizontal reduzido (0.7x) para manter spread lateral das charcoal stars
- Vento amplificado (0.5x) pois stars pesadas acumulam mais deriva

**2. Coconut tree 3-phase physics branch**
- Fase ascent (0-30%): gravidade reduzida (0.4x), drag baixo — stars sobem rapido
- Fase frond (30-60%): gravidade moderada (1.5x), adicionar spread lateral sinusoidal por star
- Fase droop (60-100%): gravidade alta (5x), drag horizontal quase zero — "fronds" caem

**3. Pistil delay timing**
- Definir `pistilDelay = pattern === 'brocade_crown' ? 0.25 : 0.15` (seconds)
- No loop de pistil (L782-814): subtrair `pistilDelay` do tempo `t` usado para calculo
- Se `t < pistilDelay`: size = 0, color = 0 (invisivel)
- Flash de ignition na pistil quando `t` passa o delay (whiteHot boost)

**4. Trail segments com droop progressivo**
- Para horsetail e coconut: calcular `trailGravMult` baseado em `starAge` do segmento
- Usar mesma formula de droop progressivo nos trail Y positions (L667, L678)

## Ordem de Execucao

| Passo | Tarefa |
|-------|--------|
| 1 | Horsetail droop branch no physics loop |
| 2 | Coconut tree 3-phase frond physics |
| 3 | Pistil delay timing |
| 4 | Trail droop para horsetail/coconut |
| 5 | Build verification |

