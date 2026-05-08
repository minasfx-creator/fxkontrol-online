
# Reconstruir o layout visual do editor (commit 9-abr) sobre `/skycanvas`

Objetivo: reproduzir o **chrome visual** que você viu no preview do bookmark — HUD topo, rails laterais de ícones, painel LASER CONTROL flutuante, transport + timeline com lanes "PYRO SYS / DRONE SYS", avatar JOI no canto — **sem reverter código**. Tudo o que ganhamos depois (XL4+, M1, Phase Gates, BlackBox, ECS, SkyCanvas v2 StageLayer) fica intacto.

Princípio: **só CSS/JSX/lazy-tabs**. Nenhuma mudança em `uiCommandGateway`, `SafetyStateMachine`, `commandBus`, `workMode`, `Show3DEngine`, adapters de hardware, `requestRealOperation`, BlackBox ou guard rails.

---

## O que muda visualmente (referência da imagem)

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ [FX KONTROL] [+][📁][💾] [↶][↷] │ ⬇IMPORT ⬆EXPORT │ ▣SEL ⊙PYRO ◯DRONE  │ <- TopBar 56
│   ⊕ADD+  ⊕SHOWS │ Untitled S… │ 0 cues · 0 pos │ 📍Set Location │       │
│   ⏱ 00:00:00:00  30 │ ⛶  ☾  ⌘K │ ⚡LIVE │ 🛡 ARM                          │
├──┬──────────────────────────────────────────────────────────────┬─────────┤
│V │                                                              │ 🔍      │
│I │                                                              │ ⊙COMANDO│
│E │                                                              │ ⊙       │
│W │           [ Viewport 3D — SkyCanvasMount ]                   │ 📍POS   │
│P │           (Google 3D Tiles do Rio, palco v2 ON/OFF)          │ ⊕       │
│O │                                                              │ ⚙       │
│R │                       ┌──────────────────────────┐           │ ⚡       │
│T │                       │ ⚡ LASER CONTROL       ✕ │           │ 👥      │
│  │                       │ 3D Viewport         ●   │           │ ⋯       │
│➕│                       │ ─ HARDWARE PRESET       │           │ 🔍+     │
│⟲ │                       │ [Generic            ▾]  │           │ 🔍-     │
│⛶ │                       │ ─ PATTERN               │           │ 🧭      │
│⊕ │                       │ [Fan Array          ▾]  │           │         │
│  │                       │ BEAM COLOR  ●●●●●●●     │           │         │
│  │                       │ PAN  ━━●━━ 0°  TILT ●━ 45°│         │         │
│  │                       │ INTENSITY ━━━━━ 100%    │           │         │
│  │                       └──────────────────────────┘           │         │
├──┴──────────────────────────────────────────────────────────────┴─────────┤
│ ⏮ ▶ ⏹ ⏭  00:00.00 / 02:00.00  │ 1.0x ◉ ●0.5x ●1x │ 🔍100%🔍│ 0 cues   │
├───────────────────────────────────────────────────────────────────────────┤
│ FIRING SYSTEMS                                                            │
│ ● PYRO SYS   ▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░       │
│ ● DRONE SYS  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░       │
│   00:00 │ 00:10 │ 00:20 │ 00:30 │ … │ 01:50 │                            │
└───────────────────────────────────────────────────────────────────────────┘
                                                                  ╔═════╗
                                                                  ║ JOI ║
                                                                  ╚═════╝
```

---

## Arquivos novos (visual-only)

1. **`src/components/skycanvas/legacy-2604/EditorTopBarLegacy.tsx`**
   HUD horizontal h-14, glass `bg-card/85`, contém:
   - Brand `FX KONTROL / BY MINAS FX` (usa `<FxkLogo>` existente)
   - Cluster file: `+ 📁 💾 ↶ ↷` (apenas botões — handlers reaproveitam `useProjectStore` para new/load/save/undo/redo já existentes)
   - Cluster import/export (abre `CatalogImportDialog` já existente / dispara `buildSkyActions().export`)
   - **Pills `SEL · PYRO · DRONE · ADD+ · SHOWS`** — `DsSegmentTabs` reusado com `mode: selection` salvo em estado local (puramente visual; alterna o tab ativo do dock direito entre `cue / cues / library`)
   - Title input ("Untitled Show…") two-way bound em `useProjectStore.name`
   - Stats inline: `cues / pos` (selectors do store)
   - **`Set Location`** button → abre `LibraryGeoTab` no dock direito
   - Big timecode `00:00:00:00 · 30` (read-only, lê `useProjectStore.currentTime` + fps)
   - Trio `⛶ fullscreen`, `☾ theme`, `⌘K` (abre `SkyCanvasCommandPalette` já existente)
   - **`LIVE`** botão cyan-outline → `navigate('/command')` (não dispara nada local — já é o contrato atual)
   - **`ARM`** botão amber-outline → `navigate('/command#arm')` cosmético (NÃO chama `uiCommandGateway.arm` daqui — **arm/disarm continua exclusivo de `/command`**)

2. **`src/components/skycanvas/legacy-2604/LeftToolRailLegacy.tsx`**
   Coluna 56px à esquerda do viewport com ícones: `Move (G)`, `Rotate (R)`, `Scale (S)`, `Frame All (F)`, `Frame Sel (.)`, `Snap (X)`, `Camera (C)` — emite eventos via `window.dispatchEvent` que o `useViewportStore`/`GeoCameraController` já escutam (`viewport-frame-all`, `viewport-frame-selection`, `viewport-set-view`).

3. **`src/components/skycanvas/legacy-2604/RightIconRailLegacy.tsx`**
   Coluna 56px à direita com mini-ícones que abrem **tabs já existentes** (apenas troca o `activeTab` do `TabbedDockPanel` direito): Buscar (palette), Comando (`hardware`), Posições, Add Pos (wizard), Settings, FX (laser), Pessoas (strategy), Zoom +/-, Compass.

4. **`src/components/skycanvas/legacy-2604/LaserControlFloatingPanel.tsx`**
   Painel flutuante draggable (default top-right do viewport, `width: 320`, `height: auto`):
   - Cabeçalho `⚡ LASER CONTROL` com botão `✕`
   - Switch "3D Viewport"
   - Select "HARDWARE PRESET" (Generic, Maiman 16CH, Maiman 39CH — reusa `LASER_FIXTURES` existente)
   - Select "PATTERN" (Fan Array, Beam, Wave, Tunnel, Lissajous — reusa enum existente em `useLaserPreviewStore`)
   - 14 swatches de cor (grid 7×2) — bind em `useLaserPreviewStore.beamColor`
   - Sliders PAN/TILT/INTENSITY — bind no mesmo store
   - **Wrapper visual do `InspectorLaserTab` existente** — não duplica lógica, só re-skin (estilo do screenshot: bg vantablack, accent laranja `--fxk-orange` legacy preservado).

5. **`src/components/skycanvas/legacy-2604/TransportBarLegacy.tsx`**
   Barra h-12: `⏮ ▶/⏸ ⏹ ⏭` + timecode atual/total + speed segmented `0.5× · 1× · 2×` + zoom `100%` + cue counter direito. Reusa `useProjectStore` actions de play/pause + `setRate` do `Show3DEngine`.

6. **`src/components/skycanvas/legacy-2604/FiringLanesTimelineLegacy.tsx`**
   Faixa h-32 abaixo do transport com header "FIRING SYSTEMS" e 2 lanes:
   - `● PYRO SYS` — renderiza markers para cues `kind ∈ {spawn-pyro, finale-burst}` do `useShowPlanProjection`.
   - `● DRONE SYS` — markers para `kind === 'move-drone'`.
   - Régua de tempo embaixo (00:00 → duração).
   - Read-only nesta primeira versão; o `TimelineCuesTab` rico continua disponível via tab.

7. **`src/components/skycanvas/legacy-2604/JoiAvatarFab.tsx`**
   FAB 64×64 bottom-right (z-40, **abaixo** do `GlobalEStopButton` z-9999) com `<AICoPilotOverlay>` (já existe) por trás. Click abre o painel JOI atual.

---

## Arquivos editados (mínimos)

- **`src/pages/SkyCanvas.tsx`**
  - Adiciona feature flag `editor_legacy_chrome_2604` (default ON, override `?legacyChrome=0`).
  - Quando ON: substitui o `topbar` do `<EditorShell>` por `<EditorTopBarLegacy>`, troca o `tabs` por `<LeftToolRailLegacy>` em coluna esquerda, monta `<RightIconRailLegacy>` na coluna direita, monta `<LaserControlFloatingPanel>` por cima do viewport e renderiza `<TransportBarLegacy>` + `<FiringLanesTimelineLegacy>` no slot timeline.
  - Quando OFF: layout atual intacto (rollback instantâneo).
  - **Não toca em** `SkyCanvasMount`, `ViewportOverlays`, persistence, command palette ou EditorShell em si.

- **`src/lib/featureFlags.ts`** — registra a flag `editor_legacy_chrome_2604`.

- **`src/index.css`** — adiciona uma classe utilitária `.legacy-glass-pill` (visual do screenshot: `bg-zinc-900/70 backdrop-blur-xl border-cyan-500/15`) usada nos pills do topo. Tokens `--fxk-orange` legacy já existem (acordo de design preservado para shaders 3D — aqui usado só nos sliders LASER, mantendo o look do screenshot).

---

## Garantias de segurança (NÃO MUDA)

- ❌ Botão **ARM no topo é cosmético** → roteia para `/command`. Não importa `uiCommandGateway`, não chama `safetyStateMachine.transition`, não toca `commandBus`. Validado pelo guard test `src/__tests__/skycanvas.safetyImports.guard.spec.ts` que **continua passando** porque os novos componentes ficam em `legacy-2604/` e seguem a mesma regra (zero import de `@/core/safety/*` exceto `useWorkMode` read-only e `simulationGuard`).
- ❌ `GlobalEStopButton` continua z-9999 visível.
- ❌ `Phase 1/2 Gates`, `BlackBox`, `requestRealOperation` intocados.
- ❌ XL4+ / M1 / FXK16 bridges intocados.
- ❌ `Show3DEngine`, `SkyCanvas v2 StageLayer`, ECS kernel intocados.

## Testes

- 1 novo guard test `src/__tests__/legacyChrome2604.safetyImports.guard.spec.ts`: vasculha `legacy-2604/*.tsx` e falha se houver import de `commandBus`, `safetyStateMachine`, `fieldBus`, `executor`, `requestRealOperation` ou `workMode.set`.
- 1 snapshot test do `<EditorTopBarLegacy>` com `flag=ON` para travar o visual.
- Suíte existente roda igual — zero arquivo deletado.

## Rollback

- Toggle `?legacyChrome=0` na URL volta ao layout atual.
- Setando flag `editor_legacy_chrome_2604=false` em `src/lib/featureFlags.ts` (1 linha) volta global.
- Apagar pasta `legacy-2604/` + 3 linhas em `SkyCanvas.tsx` reverte 100%.

## O que **não** vou recriar (e por quê)

- Botão `ARM` funcional no topo → quebra contrato safety (arm fica em `/command`).
- Lanes da timeline editáveis (drag de cues) → fora do escopo "visual"; o `TimelineCuesTab` rico já faz isso e continua disponível.
- Tema laranja-CTA global → memória core proíbe (#FF7700 rejeitado em chrome operacional). Uso restrito ao painel LASER (cor de fixture, não chrome).

Aprove para eu implementar.
