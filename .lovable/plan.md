

## Plano: Eliminar Redundâncias de UI e Aprimorar UX

### Problema

Existem controles duplicados e overlays desnecessários que poluem a interface, especialmente no mobile:

```text
Mobile (375px):
  MobileHUD ────── Play/Pause + Stop + Timecode
  ViewportPlaybackControls ── Play/Pause + Rewind + Stop + Timecode + Progress bar  ← DUPLICADO
  SelectionStatusBar ── Sem guarda mobile, aparece sobre o canvas
  CameraBookmarksBar ── Sem guarda mobile, ocupa espaço
```

### Alterações

**1. Esconder ViewportPlaybackControls no mobile** (`src/components/editor/SkyCanvas.tsx`)
- Linha ~1701: adicionar guarda `{!isMobile && <ViewportPlaybackControls />}` — o MobileHUD já cobre transporte
- Linha ~1689: adicionar guarda `{!isMobile && <SelectionStatusBar />}` — no mobile, a seleção é indicada pelo badge do MobileQuickActions
- Linha ~1672: adicionar guarda `{!isMobile && <CameraBookmarksBar ... />}` — bookmarks de câmera não são práticos em tela touch 375px

**2. Simplificar Toolbar no mobile** (`src/components/editor/Toolbar.tsx`)
- Linha 641: remover `HardwareStatusDots` do mobile na Toolbar — já existe o botão Radio no MobileHUD que cumpre a mesma função
- Linha 643: esconder botão LogOut no mobile na Toolbar — mover para Settings/MobileTabBar (o Toolbar no mobile só aparece no desktop layout)

**3. Compactar ViewportPlaybackControls no desktop** (`src/components/editor/SkyCanvas.tsx`)
- Reduzir `bottom-14` para `bottom-4` para não sobrepor a timeline
- Adicionar `opacity-60 hover:opacity-100` para reduzir poluição visual quando não interagido

**4. Limpar EngineHUD não utilizado** (`src/components/editor/EngineHUD.tsx`)
- Componente nunca é importado/renderizado em nenhum layout — remover arquivo ou manter como dead code (preferência: deletar)

### Arquivos modificados: 3
- `src/components/editor/SkyCanvas.tsx` — guardas `!isMobile` em 3 componentes + compactar playback controls
- `src/components/editor/Toolbar.tsx` — remover HardwareStatusDots no mobile
- `src/components/editor/EngineHUD.tsx` — deletar (dead code)

