# Migração SkyCanvas → EditorShell DS v1

## Objetivo
Adotar no `/skycanvas` o **mesmo layout estruturado do editor antigo** (`<EditorShell>` da DS v1: Topbar 64 · Tabs 48 · Left 280 · Right 320 · Timeline 180 · Viewport fill), aposentando o dock flutuante de vidro. Toda a funcionalidade existente (viewport WebGL, transporte, áudio, cues, persistência, Master Menu, drag-drop) é preservada; só muda o **chrome** (estrutura).

Nada de Safety/CommandBus/FieldBus/workMode é tocado — segue 100% surface Show/Experience.

## Layout final

```text
┌─────────────────── Topbar 64 (glass) ─────────────────┐
│ FXK · SIM · WorkMode · Master ⌘K · Audio · ▶ · TC · E│
├──────── Tabs 48 (DsSegmentTabs PYRO/SFX/…) ───────────┤
│ Left 280   │                                │ Right  │
│ Library    │       VIEWPORT WebGL2          │ 320    │
│ (Effects/  │       (SkyCanvas2 / 2D)        │ Inspect│
│  Fixtures/ │                                │ (Cue/  │
│  Tpl/Geo)  │                                │  Cena/ │
│            │                                │  Rend/ │
│            │                                │  HW/   │
│            │                                │  Strat)│
├────────── Timeline 180 (Cues/SMPTE/Validation) ───────┤
└───────────────────────────────────────────────────────┘
```

Mobile (<lg): grid colapsa em pilha vertical (regra já no `index.css` linha 2620+); `MobilePanelSwitcher` continua trocando qual painel (Library/Inspector/Timeline) é renderizado abaixo do viewport.

## Mudanças

### 1. `src/pages/SkyCanvas.tsx` — refator estrutural
- Remover `FloatingPanel` + `useFloatingDock`/`dockStore` (e os efeitos de auto-collapse/cinema/reset-dock que dependem deles).
- Importar `EditorShell` + `useEditorLayout('skycanvas')` da DS.
- Renderizar `<EditorShell layout={…}>` com slots:
  - **topbar**: `<GlassTopbar …>` (sem mudar markup); injetar à direita os 3 botões `PanelLeftClose/PanelRightClose/PanelBottomClose` + reset (mesmo padrão do `EditorShellPreview`, escondidos `<lg`).
  - **tabs**: novo `<SkyCanvasSegmentTabs>` simples — chips PYRO/SFX/DRONES/LIGHT/DMX só visuais por enquanto (segmento ativo persistido em `useState`, sem mudar lógica de cues). Reusa `DsSegmentTabs`.
  - **left**: `<TabbedDockPanel>` Library (Effects/Fixtures/Templates/Geo) — exatamente as mesmas 4 tabs de hoje.
  - **right**: `<TabbedDockPanel dense>` Inspector (Cue/Cena/Render/Hardware/Strategy).
  - **timeline**: `<TimelineCuesProvider>` envolvendo `<TabbedDockPanel dense>` (Cues/SMPTE/Validation).
  - **children (viewport)**: bloco atual com `StudioErrorBoundary` + Suspense + `SkyCanvas2`/`SkyFallback2D`, mantendo `data-fxk-viewport`, drag-over e drop de cues no playhead.
- Manter: clock áudio/RAF, transport (Space/Arrow/Home/End), persistência `useSkyCanvasShowPersistence`, Master Menu (`SkyCanvasCommandPalette`), import VDL, export JSON, reset show, atalho ⌘K/⌘M, audio picker oculto, `<audio>` master clock, `MobileTransportFab`, `MobilePanelSwitcher`.
- Remover atalhos `Cmd+1/2/3` (focus dock) e `Cmd+\` (cinema) — substituídos pelos botões de colapso na Topbar (`useEditorLayout.toggleLeft/Right/Timeline`). Atalho `Shift+Cmd+0` passa a chamar `layout.reset()`.
- `buildSkyActions`: substituir `focusPanel`/`toggleCinema`/`resetDock` por `toggleLeft/toggleRight/toggleTimeline/resetLayout` (Master Menu reflete novo modelo).
- `skyActions.ts` e `SkyCanvasCommandPalette.tsx`: ajustar tipo das actions p/ refletir nova API (rename de chaves; remover entradas mortas de cinema/dock-reset, adicionar entradas Layout/Painéis).

### 2. `src/components/skycanvas/MobilePanelSwitcher.tsx`
- Mudar contrato: além de `onChange`, expor o painel ativo como **estado local da página** que passa a `EditorShell` — em mobile a página renderiza só Left **OU** Right **OU** Timeline conforme `mobileActive`, escondendo os outros via `layout.{left,right,timeline}Width=0`. Isso elimina a necessidade do `dockStore` no mobile.

### 3. Arquivos a podar (não removidos neste passo, só desreferenciados)
- `src/components/skycanvas/FloatingPanel.tsx`
- `src/hooks/useFloatingDock.ts` + `dockStore`
Marcar com TODO de remoção em uma rodada futura (após `rg` confirmar 0 imports). Sem deleções nesta migração para não cascatear quebras.

### 4. Testes
- Atualizar `src/__tests__/skycanvas.safetyImports.guard.spec.ts` se ele afirmar presença de `FloatingPanel` (verificar antes de mexer; mais provável que só blacklist safety imports — nesse caso, intacto).
- Adicionar smoke test `src/__tests__/skycanvas.editorShell.spec.tsx`: render `/skycanvas`, asserir `.ds-editor-grid` presente, viewport e os 3 `TabbedDockPanel` montados.

### 5. Persistência
- Layout persistido em `fxk:editor-layout:v1:skycanvas` (via `useEditorLayout('skycanvas')`).
- Chaves antigas `fxk.skycanvas.dock.v2`/`v1` ficam órfãs (zero migração — UI-only, sem perda de show data).

## Detalhes técnicos
- Sem alteração em `useProjectStore`, `Show3DEngine`, `useSkyCanvasShowPersistence`, capability detection.
- Topbar continua **flutuando glass** sobre a Topbar slot (mantém a estética); o slot da `EditorShell` recebe a `<GlassTopbar>` direto — `position: absolute` antigo é trocado por `relative` para encaixar no grid (1 prop extra ou wrapper). Glassmorphism preservado.
- `data-theme="dark"` no root mantido; tokens DS já assumem dark.
- Mobile: `layout.effective.{left,right}Width=0` quando `mobileActive !== painel`, e `timelineHeight=0` quando `mobileActive !== 'timeline'`. Em mobile a Topbar de colapso é escondida (`hidden lg:flex`, mesmo padrão do preview).
- Drag-drop de efeitos no viewport continua funcionando (children do EditorShell = viewport).
- Sem mudança em rotas, navegação `/command`, `/ai-builder`, `/strategy`.

## Ordem de execução
1. Refator `SkyCanvas.tsx` (estrutura + remoção dock/cinema/focusPanel).
2. Ajuste `skyActions.ts` + `SkyCanvasCommandPalette.tsx` (novas entradas Layout).
3. `MobilePanelSwitcher` controla quais slots da EditorShell ficam visíveis.
4. Smoke test novo + verificar guard test existente.
5. Build + typecheck (auto pelo harness).

## Fora de escopo
- Deletar fisicamente `FloatingPanel`/`useFloatingDock` (rodada de cleanup futura).
- Migrar segmento PYRO/SFX/DRONES p/ filtrar cues (placeholder visual nesta rodada).
- Resizers da EditorShell (`EditorLayoutResizers`) — adiados; toggles no Topbar são suficientes p/ esta migração.
