

## Diagnóstico: Cubo Roxo e SpotLight

### Resultado da Auditoria

Após uma busca exaustiva em todos os ficheiros do projeto (SkyCanvas.tsx, GroundSystem.tsx, LightingSystem.tsx, e todos os componentes em `skycanvas/`), **não existe nenhum cubo de teste roxo (BoxGeometry isolado) nem SpotLight de debug** na cena 3D.

O que provavelmente foi identificado como "cubo roxo" era o `SFXStageEnvironment` (em GroundSystem.tsx), que renderiza um palco completo com beams de luz em tons de roxo (`#8800ff`, `#cc00ff`). Este componente **já está suprimido** — na linha 1811 do SkyCanvas.tsx:
```
{!google3DTilesEnabled && <StageGround />}
```
Como `google3DTilesEnabled` é `true` por padrão, o palco roxo nunca é montado.

### Problema Real: Ecrã Completamente Preto

O screenshot actual mostra um **ecrã 100% preto**. A causa:

1. `google3DTilesEnabled = true` → `StageGround` desmontado (correcto)
2. `GoogleTilesLayer` tenta carregar Google 3D Tiles mas pode falhar (403/API key)
3. `timeOfDay` padrão = 20h → `isNight = true` → o componente `<Sky />` do `GoogleEarthLighting` **não é renderizado** de noite
4. Sem Sky, sem Ground, sem Tiles carregados = ecrã preto

### Solução Proposta

| Ficheiro | Mudança |
|----------|---------|
| `src/components/editor/SkyCanvas.tsx` | No `GoogleEarthLighting`, renderizar um sky noturno mínimo quando `isNight = true` (fundo escuro azulado em vez de preto absoluto). Adicionar uma `ambientLight` de fallback com intensidade 0.15 para que, mesmo sem Google Tiles, a cena tenha profundidade visual |

Especificamente no `GoogleEarthLighting` (linhas 846-868):
- Quando `isNight`, adicionar um `<color attach="background" args={['#0a0e1a']} />` para substituir o preto absoluto por um azul noturno
- Aumentar ligeiramente a `ambientLight` noturna de 0.05 para 0.12
- Isto garante que mesmo sem os Google Tiles carregados, o viewport não fica completamente negro

**Impacto**: O viewport deixa de ser um buraco negro. Em vez disso, mostra um céu noturno atmosférico com as estrelas e a lua que já existem na cena, dando feedback visual imediato ao utilizador.

