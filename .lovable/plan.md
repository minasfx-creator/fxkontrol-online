

# Refine Finale Angle Gizmos — Presets + Starburst + Camera Lock

## Changes

### PyroLaunchAngle.tsx

**1. Camera freeze during gizmo drag**
- In `onPointerDown`: dispatch `window.dispatchEvent(new CustomEvent('box-select-active', { detail: true }))` to disable OrbitControls
- In `handleUp`: dispatch `window.dispatchEvent(new CustomEvent('box-select-active', { detail: false }))` to re-enable OrbitControls
- This reuses the existing pattern from BoxSelectOverlay that SkyCanvas already listens for

**2. More pitch presets**
Add a preset button row in the Html label area below the H/P/R inputs. Presets:
- `15°` (low angle comets), `30°` (fans), `45°` (crossettes), `60°` (wide spread), `75°` (standard), `80°`, `85°` (shells default), `90°` (vertical)
- Each preset is a small clickable button styled as a membrane key
- Clicking sets pitch on the position (or all selected in batch mode)
- Active preset gets highlighted border

**3. Enhanced BurstIndicator starburst**
Refine the existing `BurstIndicator` component:
- Increase spike count from 8 → 12, add alternating long/short spikes (outer radius alternates 0.25/0.18)
- Add a second outer ring with larger radius, lower opacity (shockwave effect)
- Add 4 diagonal cross-spikes at 45° offset for richer starburst
- Pulsing scale amplitude increased (0.25 → 0.35) for more dramatic effect
- Add color variation: inner core slightly brighter, outer spikes dimmer
- Add a small `Html` tag at burst point showing caliber and break height (e.g. "4″ · 98m")

## Files

1. `src/components/editor/PyroLaunchAngle.tsx` — all changes in this single file

## Technical Notes
- Reuses existing `box-select-active` CustomEvent pattern (no new wiring needed in SkyCanvas)
- No new dependencies
- No database changes

