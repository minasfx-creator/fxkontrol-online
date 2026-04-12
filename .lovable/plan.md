

# Ciclo #81 — React.memo & useMemo Performance Optimization

## Diagnóstico

Apenas 2 componentes no editor usam `React.memo` (LaserPreviewBeams e DraggableTimelineItem). Os demais re-renderizam a cada mudança de qualquer state pai, mesmo quando suas props não mudam.

**Componentes mais impactados** (renderizam a cada frame/tick ou a cada interação):

| Componente | Problema | Fix |
|---|---|---|
| `TelemetryBar` | Cria `new Date()` + `toLocaleTimeString` a cada render | Wrap com `React.memo` |
| `SelectionStatusBar` | Filtra arrays `positions`, `timelineItems` inline sem memo | `useMemo` nos filtros + `React.memo` |
| `GoogleTilesLoadingOverlay` | Re-render em cascata do SkyCanvas | `React.memo` |
| `TacticalDock` | Re-render quando qualquer store muda | `React.memo` |
| `MobileHUD` | Re-render a cada tick de playback propaga para filhos | `React.memo` |
| `MobileQuickActions` | Re-render desnecessário quando panelOpen não muda | `React.memo` |
| `MobileTabBar` | Props complexas causam re-render | `React.memo` com comparação shallow |
| `PropertiesPanel` | `ExportSection` recalcula contagens inline | `useMemo` nos contadores + `React.memo` no ExportSection |
| `BoidsVisualizer` | Recria array `positions` (map) a cada frame | `useMemo` com deps nos agents |
| `HUDCrosshairs` | Simples mas sem memo | `React.memo` |
| `PlacingModeOverlay` | Simples mas sem memo | `React.memo` |
| `ARCompassHUD` | Simples mas sem memo | `React.memo` |
| `AICoPilotOverlay` | Simples mas sem memo | `React.memo` |

## Plano de Implementação

### 1. Wrap componentes HUD/overlay com React.memo (8 arquivos)
Componentes simples que apenas leem do store e renderizam UI:
- `TelemetryBar`, `GoogleTilesLoadingOverlay`, `HUDCrosshairs`, `PlacingModeOverlay`, `ARCompassHUD`, `AICoPilotOverlay`, `MobileHUD`, `MobileQuickActions`
- Pattern: `export default React.memo(function ComponentName() { ... })`

### 2. Adicionar useMemo em cálculos derivados (3 arquivos)
- **SelectionStatusBar**: `useMemo` para `selectedPositions`, `selectedPyro`, `selectedDrone`, `linkedEffectCount`
- **PropertiesPanel/ExportSection**: `useMemo` para `droneCount` e `pyroCount`
- **BoidsVisualizer**: `useMemo` para o array `positions` derivado de `agents`

### 3. Wrap componentes de dock/toolbar (3 arquivos)
- `TacticalDock`, `MobileTabBar`, `SelectionStatusBar`
- Pattern: `React.memo` no export

### 4. Build verification

## Arquivos

| Acao | Arquivo |
|---|---|
| Edit | `src/components/editor/TelemetryBar.tsx` |
| Edit | `src/components/editor/GoogleTilesLoadingOverlay.tsx` |
| Edit | `src/components/editor/HUDCrosshairs.tsx` |
| Edit | `src/components/editor/PlacingModeOverlay.tsx` |
| Edit | `src/components/editor/ARCompassHUD.tsx` |
| Edit | `src/components/editor/AICoPilotOverlay.tsx` |
| Edit | `src/components/editor/MobileHUD.tsx` |
| Edit | `src/components/editor/MobileQuickActions.tsx` |
| Edit | `src/components/editor/MobileTabBar.tsx` |
| Edit | `src/components/editor/TacticalDock.tsx` |
| Edit | `src/components/editor/SelectionStatusBar.tsx` |
| Edit | `src/components/editor/PropertiesPanel.tsx` |
| Edit | `src/components/editor/BoidsVisualizer.tsx` |

## Ordem
1. Wrap HUD/overlay components com React.memo (batch)
2. Adicionar useMemo nos cálculos derivados
3. Wrap dock/toolbar components
4. Build verification

