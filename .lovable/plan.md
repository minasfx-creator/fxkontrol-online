

# Refactor: Click+Drag Box Select on Viewport & Timeline + Direction Line Visual Fix

## Problems

1. **Box select requires Shift+Drag** — user wants plain click+drag on empty area to start a selection rectangle (like Finale 3D). Currently Shift is mandatory in `BoxSelectOverlay.tsx` line 79.

2. **Direction lines look wrong** — Reference screenshot (image 2) shows **solid colored arrows** (cyan for drones, orange for pyro) with **diamond-shaped grab handles** at the burst point. Current implementation uses red dotted lines with a torus ring handle — doesn't match.

3. **Timeline marquee already works** via `handleMarqueeStart` in `Timeline.tsx` — but it only triggers when clicking empty space, and syncs to viewport. This is functional but needs to also work in the same click+drag pattern (no modifier key).

## Changes

### 1. `src/components/editor/BoxSelectOverlay.tsx` — Remove Shift Requirement

- Line 79: Remove `if (!e.shiftKey) return;`
- Instead, check that: (a) the click target is NOT a mesh/interactive element (check `e.target === canvas` or closest canvas element), (b) `editorMode === 'select'`, (c) no other modifier active that would conflict
- Add a small dead-zone (5px movement) before activating selection to avoid interfering with single clicks on positions
- Also clear previous selection on box-select start (unless Shift is held for additive selection)

### 2. `src/components/editor/BoxSelectOverlay.tsx` — Fix: Don't Block OrbitControls

Currently `e.preventDefault()` and `e.stopPropagation()` on line 80-81 block OrbitControls. Solution:
- Only start box-select after a minimum drag distance (8px) — until then, let OrbitControls handle it
- Use a "pending" state: on mousedown record start point, on mousemove check distance, if > 8px then activate box select and cancel orbit
- If user just clicks without dragging 8px → treat as normal click (orbit or position select)

### 3. `src/components/editor/PositionPins.tsx` — Direction Line Visual Overhaul

Match reference screenshot exactly:
- **Solid line** (not dashed) — remove `dashed` prop from Line
- **Color by type**: orange `#FF6B35` for pyro, cyan `#00B4D8` for drone (matching position color, not red)
- **Diamond grab handle** at burst point instead of torus ring — use `<mesh>` with `octahedronGeometry` (args `[0.12, 0]`) rotated 45° for diamond shape
- **Arrow tip**: keep cone at tip, same color as line
- **Opacity**: 0.7 when has effects (unselected), 1.0 when selected
- **Line width**: 1.5 normal, 2.5 selected

### 4. `src/components/editor/SelectionModeBar.tsx` — Update Tooltip

Change Lasso tooltip from "Shift+Drag" to "Click+Drag" since Shift is no longer required.

### 5. `src/components/editor/Timeline.tsx` — Verify Marquee Works Without Modifier

The timeline marquee in `handleMarqueeStart` (line 448) already works on plain mousedown — just verify it doesn't require any modifier key. Currently it checks `if ((e.target as HTMLElement).closest('button')) return;` which is correct — clicks on buttons are skipped, clicks on empty track area start marquee.

## Files

| File | Change |
|------|--------|
| `src/components/editor/BoxSelectOverlay.tsx` | Remove Shift requirement, add dead-zone to avoid breaking orbit, clear selection on start |
| `src/components/editor/PositionPins.tsx` | Solid colored lines (not red dashed), diamond grab handle instead of torus |
| `src/components/editor/SelectionModeBar.tsx` | Update tooltip text |

