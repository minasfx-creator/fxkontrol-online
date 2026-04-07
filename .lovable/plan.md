

# Fix: Fogos Sempre Visíveis Sobre Google 3D Tiles

## Problema

Todos os efeitos pirotécnicos usam `depthWrite: false` mas **NÃO** usam `depthTest: false`. Como o Google 3D Tiles escreve no depth buffer (renderOrder -100), as partículas que ficam "atrás" de prédios/terreno no z-buffer são descartadas pelo GPU — mesmo estando no céu acima da cena.

Também falta `renderOrder` nos elementos `<points>` e `<lineSegments>` principais, garantindo que sejam desenhados DEPOIS dos tiles.

## Solução

Adicionar `depthTest={false}` e `renderOrder={50}` em **todos** os materiais e grupos de efeitos pirotécnicos que ainda não os têm.

## Arquivos a Modificar

| Arquivo | O que falta |
|---------|------------|
| `FireworkRenderer.tsx` | Star material: adicionar `depthTest: false`. Points/lineSegments/pistil: `renderOrder={50}` |
| `CometEffect.tsx` | 5 materiais sem `depthTest: false`, grupo sem `renderOrder` |
| `MineEffect.tsx` | 4 materiais sem `depthTest: false`, grupo sem `renderOrder` |
| `RomanCandleEffect.tsx` | 2 materiais sem `depthTest: false`, grupo sem `renderOrder` |
| `FanEffect.tsx` | 2 materiais sem `depthTest: false`, grupo sem `renderOrder` |
| `WaterfallEffect.tsx` | 1 material sem `depthTest: false`, grupo sem `renderOrder` |
| `EmberParticles.tsx` | 1 material sem `depthTest: false` |

## Detalhes Técnicos

### FireworkRenderer.tsx — Star Material (critical)
Na função `_sharedStarMaterial()` (linha ~107), adicionar `depthTest: false` ao ShaderMaterial. Esta é a mudança mais importante pois afeta TODAS as estrelas de burst.

Nos elementos JSX (linha ~607-634), adicionar `renderOrder={50}` nos `<points>` e `<lineSegments>`.

### Todos os Effects
Padrão: onde houver `depthWrite={false}` sem `depthTest={false}`, adicionar `depthTest={false}`.
Grupos raiz: adicionar `renderOrder={50}` para garantir ordem de rendering após tiles (-100).

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | FireworkRenderer.tsx — depthTest no star material + renderOrder nos points |
| 2 | CometEffect, MineEffect, RomanCandleEffect, FanEffect, WaterfallEffect, EmberParticles — depthTest + renderOrder |
| 3 | Build verification |

