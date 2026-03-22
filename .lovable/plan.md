

# Fix: Box Select + Direction Line + Interaction System Overhaul

## Problems Identified

### 1. Box Select Doesn't Work — Conflict with OrbitControls
The `BoxSelectOverlay` attaches mousedown with `capture: true` on `window`, but OrbitControls (Three.js) also captures mouse events on the canvas. The 8px dead-zone approach has a fundamental flaw: OrbitControls starts rotating immediately on mousedown, and by the time box-select activates (after 8px), the camera has already moved. The `box-select-active` event disables OrbitControls too late.

**Root cause**: OrbitControls uses `mouseButtons.LEFT = ROTATE` by default. In `select` mode, left-drag should ONLY do box-select, not orbit.

### 2. Direction Lines Scale Mismatch with Gizmo
- `DirectionLine` (PositionPins.tsx): renders at real scale (80m for 4" shell) — correct
- `LaunchAngleGizmo` (PyroLaunchAngle.tsx): renders at ARROW_LENGTH=3.5 scale — tiny preview
- When selected position has effects in select mode, BOTH render: the 80-unit DirectionLine AND the 3.5-unit gizmo trajectory. They overlap confusingly.

### 3. OrbitControls Fight with Selection in Select Mode
Left-click on empty space triggers both orbit rotation AND deselection via `GroundDeselectPlane`. Users can't orbit the camera without deselecting everything.

## Solution — UE5.7 Niagara-Inspired Interaction Architecture

Following UE5.7's viewport interaction model where tools don't fight with navigation:

### Change 1: `BoxSelectOverlay.tsx` — Disable OrbitControls BEFORE drag starts
- On mousedown in select mode on canvas: **immediately** dispatch `box-select-active: true` to disable OrbitControls
- If the user doesn't drag past 8px dead-zone, re-enable on mouseup (acts as a click)
- This ensures OrbitControls never starts rotating during a potential box-select
- For camera orbit in select mode: use **middle mouse button** or **Alt+Left-click** (standard 3D app convention)

### Change 2: `SkyCanvas.tsx` — OrbitControls mouse button mapping
- In `select` mode: set `mouseButtons={{ LEFT: null, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN }}`
- In other modes: keep default LEFT=ROTATE behavior
- This eliminates the conflict entirely: left-drag = select, middle-drag = orbit, right-drag = pan

### Change 3: `PositionPins.tsx` — DirectionLine hides when gizmo is visible
- Currently hides only when `editorMode === 'adjust-angles' && isSelected`
- Also hide when `PyroLaunchAngle` is rendering for this position (selected + has effects in select mode)
- This prevents the 80-unit line from overlapping the gizmo trajectory

### Change 4: `PyroLaunchAngle.tsx` — Gizmo uses real scale in select mode
- When showing in select mode (not angle mode), render trajectory at **real scale** (not ARROW_LENGTH=3.5)
- Only show trajectory line + grab handle in select mode (no compass/arcs)
- In adjust-angles mode: keep current small gizmo behavior
- Pass `showFullScale` prop based on `editorMode !== 'adjust-angles'`

### Change 5: `PositionPins.tsx` — Simplify DirectionLine
- Only show the short cosmetic line (2-3 units) when no effects are linked and position is hovered/selected
- When effects are linked: let `PyroLaunchAngle` handle the full trajectory display exclusively
- Remove grab handle from DirectionLine (PyroLaunchAngle already has one)
- This eliminates duplication and confusion between the two components

## Technical Details

```text
Select Mode Interaction Map:
  Left-Click on position  → Select position
  Left-Drag on empty      → Box select rectangle
  Shift+Left-Click        → Add to selection
  Middle-Drag             → Orbit camera
  Right-Drag              → Pan camera
  Scroll                  → Zoom
  Alt+Left-Drag           → Orbit camera (alternative)
```

## Files

| File | Change |
|------|--------|
| `src/components/editor/BoxSelectOverlay.tsx` | Immediately disable OrbitControls on mousedown, restore on mouseup if no drag |
| `src/components/editor/SkyCanvas.tsx` | Set OrbitControls mouseButtons based on editorMode; LEFT=null in select mode |
| `src/components/editor/PositionPins.tsx` | Simplify DirectionLine to cosmetic-only; delegate full trajectory to PyroLaunchAngle |
| `src/components/editor/PyroLaunchAngle.tsx` | Add real-scale trajectory mode for select-mode display |

