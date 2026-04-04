

# Plano: Aprimoramento UX Joy + Lógica AR em Toda a Plataforma

## Visão Geral

Três eixos de melhoria: (1) micro-interações de prazer (UX Joy), (2) expansão da lógica AR do viewport para toda a plataforma, e (3) refinamentos visuais mobile.

---

## 1. UX Joy — Micro-interações e Feedback Sensorial

### 1A. Transições de página com partículas AR
**Novo arquivo:** `src/components/ui/PageTransitionOverlay.tsx`
- Overlay fullscreen com partículas cyan/amber que disparam durante navegação entre rotas.
- Efeito CSS-only: 12-16 pontos luminosos que fazem `scale-in` + `fade-out` em 400ms com `mix-blend-mode: screen`.
- Integrar no layout raiz (`Index.tsx` / `App.tsx`) com `useLocation()` como trigger.

### 1B. Skeleton loading com estética FUI
**Novo arquivo:** `src/components/ui/FUISkeleton.tsx`
- Substituir shimmer genérico por barras com animação de scanline horizontal (Electric Cyan).
- Aplicar nos painéis do editor que usam `<Suspense>` (80+ lazy panels).
- Gradiente animado: `linear-gradient(90deg, transparent 0%, hsl(190,100%,50%,0.08) 50%, transparent 100%)` com `translateX` keyframe.

### 1C. Haptics aprimorados + sons contextuais
**Modificar:** `src/lib/haptics.ts` e `src/lib/ambientSound.ts`
- Adicionar padrões de haptic para: drag start/end, panel minimize/maximize, AR mode toggle.
- Adicionar sons sutis: `whoosh` para transições de painel, `ping` para calibração AR concluída.

### 1D. Toast com estética AR
**Modificar:** Toast styling global
- Toasts com borda lateral Electric Cyan, ícone animado de status, e `backdrop-blur`.
- Variantes: `success` (cyan), `warning` (amber), `error` (crimson), `ar` (magenta gradient).

---

## 2. Lógica AR Expandida — Do Viewport para Toda a Plataforma

### 2A. AR Mode global no store
**Modificar:** `src/store/useSceneStore.ts`
- Adicionar `arMode: boolean`, `arCalibration: ARCalibration`, `arOverlayState: AROverlayState` ao environment/settings.
- Getter `isARActive` computed.
- Ações: `toggleAR()`, `updateARCalibration()`.

### 2B. AR Compass HUD — Overlay de bússola geoespacial
**Novo arquivo:** `src/components/editor/ARCompassHUD.tsx`
- Bússola circular SVG semitransparente (estilo aviônica) sobreposta ao viewport.
- Mostra bearing para o ponto de ancoragem GPS, norte magnético, e ângulo do vento.
- Ativada quando `arMode === true` no store.
- Posição: canto superior-direito do viewport, z-35.

### 2C. AR Distance Markers no canvas 3D
**Novo arquivo:** `src/components/editor/skycanvas/ARDistanceMarkers.tsx`
- Componente R3F (`<Html>`) que renderiza labels de distância em metros flutuando sobre posições.
- Calcula distância câmera→posição e mostra como badge AR (ex: `↕ 42m`).
- Fade-in/out baseado em proximidade. Apenas visível quando `arMode` está ativo.

### 2D. AR Scan Effect — Animação de varredura
**Novo arquivo:** `src/components/editor/ARScanEffect.tsx`
- Overlay SVG com linha horizontal que varre de cima para baixo (2s loop) com glow cyan.
- Ativado temporariamente ao entrar em AR mode ou ao carregar venue photo.
- CSS animation: `translateY(-100%)` → `translateY(100%)` com opacidade variável.

### 2E. Dashboard AR Widgets
**Modificar:** `src/pages/Dashboard.tsx`
- Adicionar card "AR Preview" no dashboard com thumbnail do último venue photo + mini-preview do overlay.
- Card mostra status da calibração AR (calibrado/não calibrado) com indicador visual.
- Click navega para Editor 3D com `?panel=aroverlay`.

### 2F. AR Badge no DockBar
**Modificar:** `src/components/DockBar.tsx`
- Quando `arMode` está ativo no store, mostrar dot pulsante magenta no ícone do Editor 3D.
- Tooltip: "AR Mode Active".

### 2G. Integrar AROverlayPanel ao viewport
**Modificar:** `src/components/editor/SkyCanvas.tsx`
- Escutar evento `ar-overlay-update` e aplicar `AROverlayState` ao canvas.
- Quando venue photo está carregada, renderizar como background plane no R3F usando `useTexture`.
- Aplicar `blendMode` e `overlayOpacity` do estado AR ao composite.

---

## 3. Mobile UX Refinements

### 3A. AR Quick Toggle no MobileHUD
**Modificar:** `src/components/editor/MobileHUD.tsx`
- Adicionar pill "AR" ao lado do timecode que ativa/desativa arMode com um tap.
- Cor: magenta quando ativo, muted quando inativo.

### 3B. Grip handle melhorado para DraggableFloatingPanel
**Modificar:** `src/components/editor/DraggableFloatingPanel.tsx`
- Aumentar área de toque do grip para 44px (WCAG).
- Adicionar feedback visual durante drag: border glow Electric Cyan + sombra elevada.
- Animação `scale(1.02)` durante arrasto.

### 3C. Floating panels auto-dodge
**Modificar:** `src/components/editor/DraggableFloatingPanel.tsx`
- Ao soltar, se dois painéis se sobrepõem, empurrar o segundo 8px para baixo automaticamente.
- Registrar painéis ativos num Map estático do módulo.

---

## Ficheiros Afetados (resumo)

| Ação | Ficheiro |
|------|---------|
| Criar | `src/components/ui/PageTransitionOverlay.tsx` |
| Criar | `src/components/ui/FUISkeleton.tsx` |
| Criar | `src/components/editor/ARCompassHUD.tsx` |
| Criar | `src/components/editor/skycanvas/ARDistanceMarkers.tsx` |
| Criar | `src/components/editor/ARScanEffect.tsx` |
| Modificar | `src/store/useSceneStore.ts` — AR state global |
| Modificar | `src/components/editor/SkyCanvas.tsx` — AR integration |
| Modificar | `src/components/editor/MobileHUD.tsx` — AR toggle |
| Modificar | `src/components/editor/DraggableFloatingPanel.tsx` — UX refinements |
| Modificar | `src/pages/Dashboard.tsx` — AR widget card |
| Modificar | `src/components/DockBar.tsx` — AR badge |
| Modificar | `src/lib/haptics.ts` — novos padrões |

### Proteções
- SkyCanvas R3F: nenhuma alteração destrutiva ao pipeline de efeitos existente
- Stores Zustand: adição aditiva, sem breaking changes
- Mobile: respeitado bottomOffset de 80px e safe areas

