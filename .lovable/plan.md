

## Refatoração UI/UX Industrial — Glassmorphism & Viewport Limpo

### Resumo
Limpar a viewport 3D de botões redundantes, consolidar camera presets num dropdown, condicionar ground/grid ao Google 3D Tiles, e reorganizar overlays para maximizar a imersão.

---

### 1. Camera Presets → Dropdown Único (SkyCanvas.tsx)

**Problema**: Desktop renderiza 6+ botões de câmera inline (Look, Fly, Free, 1st Person, Plateia, Aerial) na linha 1811-2003, ocupando espaço visual sobre o viewport.

**Solução**: Substituir os botões inline por um único dropdown `🎥 Camera Views` no canto superior esquerdo do viewport, mantendo Look e Fly como toggles separados (são controles de modo, não presets).

- Linhas 1877-1893: Envolver os `CAMERA_PRESETS.map(...)` num dropdown colapsável idêntico ao que já existe para mobile (linhas 1843-1876)
- Mover os botões de Lock, Rulers, Bookmark, Fullscreen, Download Satellite e Presentation para um mini-dock vertical `right-3 top-3` dentro do viewport
- Resultado: a faixa superior do viewport fica com apenas 3 elementos (Look, Fly, Camera Dropdown)

### 2. Suprimir Ground/Grid quando Google Earth ativo (SkyCanvas.tsx)

**Já implementado**: Linha 1727 — `{!google3DTilesEnabled && <StageGround .../>}`. O ground já é condicional. Se o utilizador vê o cubo roxo, é porque `google3DTilesEnabled` pode estar a falhar na inicialização dos tiles (erro 403 nos logs). O terreno e grid já são suprimidos quando os tiles estão ativos.

**Ação adicional**: Adicionar uma `hemisphereLight` e `ambientLight` com intensidade mínima (0.3) para iluminar os 3D Tiles do Google quando carregados, pois o HDR rig é otimizado para a cena de fogos e pode deixar os tiles escuros.

### 3. Ocultar StressTest e ViewportTerminal por Padrão (SkyCanvas.tsx)

**Problema**: `StressTestButton` (linha 2028-2031) e `ViewportTerminal` (linha 2021) ficam sempre visíveis.

**Solução**: 
- Mover ambos para renderização condicional, ativados apenas via `Ctrl+Shift+D`
- Usar um estado `showDebugTools` que já existe parcialmente (`showDebugOverlay`)

### 4. Viewport Overlay Tools → Mini-Dock Vertical (SkyCanvas.tsx)

**Problema**: Botões utilitários (Lock, Rulers, Bookmark, Fullscreen, Satellite, Presentation, RenderDebug) espalhados horizontalmente na linha superior.

**Solução**: Agrupar num cluster vertical translúcido no canto superior direito do viewport:
```
right-3 top-3 flex flex-col gap-1 bg-black/40 backdrop-blur-sm 
border border-white/5 rounded-xl p-1
```

### 5. PerformanceHUD do SkyCanvas → Oculto por Padrão

**Problema**: O SkyCanvas tem o seu próprio `PerformanceHUD` (linha 2020) que duplica o HUD do `Index.tsx`.

**Solução**: Condicionar à flag `showDebugOverlay` que já existe, em vez de renderizar sempre.

### 6. Bottom Info Box → Oculto por Padrão

**Problema**: O box de info "FX KONTROL v2.0" (linhas 2051-2058) no canto inferior direito ocupa espaço visual.

**Solução**: Só mostrar quando `showDebugOverlay` está ativo.

---

### Ficheiros Alterados

| Ficheiro | Ação |
|----------|------|
| `src/components/editor/SkyCanvas.tsx` | Consolidar camera presets em dropdown, agrupar tools em mini-dock, ocultar debug tools |

### Impacto
- Viewport 3D ganha ~80% mais espaço visual livre
- Camera presets acessíveis mas não intrusivos
- Debug tools escondidos até `Ctrl+Shift+D`
- Iluminação melhorada para Google Earth tiles

