

## Plano: Fallback Visual (Grid + Horizonte) quando Google Tiles falha

### Situação Atual
- Linha 1421 do `SkyCanvas.tsx` já renderiza um `<Grid>` quando `google3DTilesEnabled` é true, mas ele é **sempre visível** — não reage ao estado `error`.
- O `GoogleTilesEngine` já expõe `getTilesDebugInfo()` com `state: 'error'` via `useSyncExternalStore`.
- Quando tiles falham, o viewport fica com apenas o grid fino e fundo escuro — sem horizonte nem referência visual.

### Correções

#### 1. Criar componente `GoogleTilesFallback` (novo arquivo)
**Arquivo**: `src/components/editor/skycanvas/GoogleTilesFallback.tsx`

Componente R3F que só renderiza quando `tilesState === 'error'` ou tiles ficam em `loading-tiles` por mais de 15s (timeout). Contém:
- **Grid infinito** mais visível (cores mais claras, fade maior)
- **Plano de horizonte** — disco circular grande (raio ~5km) com gradiente radial (centro escuro → borda azulada) simulando horizonte
- **Linha de horizonte** — anel fino luminoso no limite do disco para dar referência de profundidade
- **Iluminação ambiente** sutil para que o fallback não fique completamente escuro

Usa `useSyncExternalStore(subscribeTilesLoading, getTilesDebugInfo)` para reagir ao estado.

#### 2. Atualizar `SkyCanvas.tsx`
**Arquivo**: `src/components/editor/SkyCanvas.tsx`
- Importar `GoogleTilesFallback` via lazy loading
- Substituir o grid fixo (linha 1421) pelo novo componente:
```tsx
{google3DTilesEnabled && <GoogleTilesFallback />}
```
- O fallback se auto-esconde quando tiles carregam (`state === 'ready'`)

#### 3. Melhorar overlay de erro
**Arquivo**: `src/components/editor/GoogleTilesLoadingOverlay.tsx`
- No estado `error`, adicionar botão "Retry" que limpa o `apiKey` para re-trigger do fetch
- Mensagem mais clara: "Terreno indisponível — exibindo grid de referência"

### Arquivos modificados: 3 (1 novo + 2 editados)

