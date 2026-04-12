

# Ciclo #84 — Zustand Subscription Optimization

## Problem

**59 components** use `useProjectStore()` with object destructuring, which subscribes to the **entire store**. Since `useProjectStore` has 60+ properties (including `currentTime` which updates ~60fps during playback), every component re-renders on every tick — even if it only reads `editorMode`.

This is the #1 cause of unnecessary re-renders in the app.

## Severity Classification

| Priority | Component | Why critical |
|----------|-----------|-------------|
| P0 | `PositionPins.tsx` (Pin, DirectionLine, GroundClickPlane) | R3F scene — re-renders cause GPU thrash |
| P0 | `FireworkRenderer.tsx` (TimelineEffects) | R3F scene — rebuilds effect array every frame |
| P0 | `SelectionStatusBar.tsx` | Renders during playback despite only needing selection state |
| P1 | `FormationBuilder.tsx` (FormationQueue) | Heavy UI list re-rendered on every time tick |
| P1 | `RadialMenu.tsx` | Full store subscription for position ops |
| P1 | `PositionWindow.tsx` (PositionContextMenu) | Full store on right-click menu |
| P2 | 50+ other components | Panel-level components, less frequent but cumulative |

## Fix Strategy

Convert all `useProjectStore()` destructuring calls to **individual selector subscriptions**:

```typescript
// ❌ BEFORE — subscribes to ALL 60+ fields
const { currentTime, isPlaying } = useProjectStore();

// ✅ AFTER — subscribes only to what's needed
const currentTime = useProjectStore(s => s.currentTime);
const isPlaying = useProjectStore(s => s.isPlaying);
```

For action-only references (functions that never change), group them with `useCallback`-stable selectors or extract once:

```typescript
// Actions are stable — can use a single shallow selector
const actions = useProjectStore(s => ({
  updatePosition: s.updatePosition,
  selectPosition: s.selectPosition,
}));
// Or just individual: const updatePosition = useProjectStore(s => s.updatePosition);
```

## Scope

Fix the **12 highest-impact files** (P0 + P1). The remaining ~47 P2 components are panels/dialogs that only mount on user action — lower priority.

### Files to edit

| File | Current destructured fields | Fix |
|------|---------------------------|-----|
| `src/components/editor/PositionPins.tsx` (Pin) | 8 fields full-store | Individual selectors |
| `src/components/editor/PositionPins.tsx` (DirectionLine) | 5 fields full-store | Individual selectors |
| `src/components/editor/PositionPins.tsx` (GroundClickPlane) | 6 fields full-store | Individual selectors |
| `src/components/editor/PositionPins.tsx` (GroundDeselectPlane) | 2 fields full-store | Individual selectors |
| `src/components/editor/PositionPins.tsx` (default export) | 1 field full-store | Individual selector |
| `src/components/editor/skycanvas/FireworkRenderer.tsx` (TimelineEffects) | 3 fields full-store | Individual selectors |
| `src/components/editor/SelectionStatusBar.tsx` | 8 fields full-store | Individual selectors |
| `src/components/editor/FormationBuilder.tsx` (FormationQueue) | 8 fields full-store | Individual selectors |
| `src/components/editor/FormationBuilder.tsx` (default) | 3 fields full-store | Individual selectors |
| `src/components/editor/RadialMenu.tsx` | 7 fields full-store | Individual selectors |
| `src/components/editor/PositionWindow.tsx` | 10+ fields full-store | Individual selectors |
| `src/components/editor/CakeBuilder.tsx` | 4 fields full-store | Individual selectors |

## Execution Order

1. Fix P0 R3F components (PositionPins, FireworkRenderer) — biggest perf gain
2. Fix P0/P1 UI components (SelectionStatusBar, FormationBuilder, RadialMenu, PositionWindow, CakeBuilder)
3. Build verification with `tsc --noEmit`

## Expected Impact

- **R3F scene**: Eliminates ~95% of unnecessary React reconciliation during playback
- **UI panels**: Panels that only read selection/mode state stop re-rendering on `currentTime` ticks
- **Memory**: Fewer intermediate React fiber objects created per frame

