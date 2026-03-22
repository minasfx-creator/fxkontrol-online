

# Fix: Direction Lines Height + Box Select Reliability

## Root Cause Analysis

### Problem 1: Direction lines are 3.5 units tall, effects burst at 80+ units
The `DirectionLine` in `PositionPins.tsx` uses `ARROW_LENGTH = 3.5` as the scale factor — a copy-paste from the `PyroLaunchAngle` gizmo which intentionally renders a SMALL preview. But the actual scene uses **1 unit = 1 meter**. A 4" shell bursts at 80m (80 units). The line goes to 3.5 units — invisible compared to the burst.

**Fix**: Use `getBreakHeight(caliber)` directly as scene length (no scaling). For a 4" shell: line goes to 80 units. Also read `effectScale` from `useSceneStore` to match exactly where effects render.

### Problem 2: Box Select may not initialize (race condition)
`BoxSelectOverlay` runs `useEffect([], ...)` which queries `document.querySelector('[data-sky-canvas]')`. If `SkyCanvas` is still inside `<Suspense>` when the effect runs, the element doesn't exist yet — listeners never attach. Also, the overlay is a sibling to `SkyCanvas`, so its `absolute` positioning is relative to the parent div, not to `[data-sky-canvas]`.

**Fix**: Use a retry/observer pattern or `MutationObserver` to wait for `[data-sky-canvas]` to appear. Also ensure coordinate system alignment.

### Problem 3: Box Select conflicts with OrbitControls
The dead-zone logic is correct, but when box select activates it doesn't disable OrbitControls, causing simultaneous orbit + select drag.

**Fix**: Dispatch a custom event to disable OrbitControls when box select activates, re-enable on mouseup.

---

## Changes

### 1. `src/components/editor/PositionPins.tsx` — DirectionLine real height

- Remove `ARROW_LENGTH = 3.5` scaling factor
- Use `getBreakHeight(maxCaliber) * effectScale` directly for scene length (1:1 with meters)
- Read `effectScale` from `useSceneStore`
- Apply same heading/pitch direction vector, just at correct length
- Diamond grab handle stays at the tip (now at actual burst altitude)
- When no effects: short line (2 units) as before

### 2. `src/components/editor/BoxSelectOverlay.tsx` — Fix initialization race

- Replace `useEffect([], ...)` with a polling/MutationObserver approach that waits for `[data-sky-canvas]` to appear in DOM
- When box select activates (past dead-zone): dispatch `window.dispatchEvent(new CustomEvent('box-select-active', { detail: true }))` to signal OrbitControls to disable
- On mouseup: dispatch `box-select-active` with `false`
- Ensure rect coordinates are relative to the `[data-sky-canvas]` element's bounding rect

### 3. `src/components/editor/SkyCanvas.tsx` — OrbitControls responds to box-select

- In OrbitControls config, listen for `box-select-active` event and set `controls.enabled = false` while active
- This prevents camera rotation during box select drag

## Files

| File | Change |
|------|--------|
| `src/components/editor/PositionPins.tsx` | DirectionLine uses real break height (80m for 4"), not 3.5 gizmo units |
| `src/components/editor/BoxSelectOverlay.tsx` | Fix DOM race condition, disable OrbitControls during select |
| `src/components/editor/SkyCanvas.tsx` | Listen for box-select-active to toggle OrbitControls |

