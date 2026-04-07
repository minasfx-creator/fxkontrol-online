
# Ciclo de Polish #20 — Ground Sparks, Smoke Trail, Burst Flash

## Bugs e Melhorias Identificados

| # | Problema | Arquivo | Fix |
|---|----------|---------|-----|
| 1 | **SparkShower sem ground interaction** — sparks que atingem Y=0 simplesmente desaparecem (L83-86) sem gerar bounce ou ground glow. Devem ricochetear com velocidade reduzida e emitir cor quente no impacto | `SparkShower.tsx` | Quando `y < 0`, refletir Y com restitution 0.3, adicionar ground glow orange na cor, reduzir lifetime |
| 2 | **PrefireShell smoke trail fino demais** — mortar smoke puff (L171-180) usa sphere com opacity 0.06 fixa, trail shader `uSize` não escala com caliber suficientemente. Trail parece fio de cabelo em calibres grandes (8"+) | `PrefireShell.tsx` | Aumentar smoke puff opacity para 0.09, escalar radius com caliber², aumentar uSize para `1.8 + caliber * 0.5`, adicionar smoke density layers |
| 3 | **ExplosionGlowSystem sem flash bloom inicial** — burst começa com intensity MAX_INTENSITY (0.75) constante, sem spike inicial que simule o flash da detonação. Falta o "pop" visual de iluminação | `ExplosionGlowSystem.tsx` | Adicionar flash spike nos primeiros 50ms (intensity 2.5x), decair exponencialmente para MAX_INTENSITY depois |

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `SparkShower.tsx` | Ground bounce + glow ao atingir Y=0 |
| `PrefireShell.tsx` | Smoke trail mais denso, uSize escalado, smoke layers |
| `ExplosionGlowSystem.tsx` | Flash spike inicial no burst |

## Ordem

1. SparkShower — ground interaction
2. PrefireShell — smoke trail thickness
3. ExplosionGlowSystem — burst flash bloom
4. Build verification
