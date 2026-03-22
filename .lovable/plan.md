

# Fix: Direction Lines Must Reach Burst Height + Grab Point + Auto-Show Gizmo

## Problem

In Finale 3D, when effects are placed on a position:
1. A **long line extends from the mortar to the burst height** (the actual altitude where the shell explodes) — not a short 2-5 unit cosmetic stub
2. A **draggable grab handle** sits at the tip of that line for immediate angle adjustment
3. This appears **automatically in select mode** — no need to press "A" to enter angle mode

Current FX KONTROL: `DirectionLine` is only 2-5 scene units long (cosmetic). The full gizmo with trajectory + handle only appears in `adjust-angles` mode. Users see almost nothing after placing effects.

## Changes

### 1. `src/components/editor/PositionPins.tsx` — DirectionLine uses real break height

Replace fixed `length = 2/3/4/5` with actual burst height from linked effects:
- Get max caliber from linked timeline items (already have `linkedItemIds` + access to `timelineItems`)
- Call `getBreakHeight(caliber)` from `pyroPhysics.ts` to get real height in meters
- Scale to scene units: `breakHeight * (ARROW_LENGTH / getBreakHeight(4))` — same scale factor used in `PyroLaunchAngle.tsx` line 303
- Default to caliber 3 (55m → ~2.4 scene units) if no caliber found, ensuring minimum visibility
- Line direction uses full H/P/R Euler rotation applied to up vector (already correct)
- When `hasEffects`: use dotted red style (matching Finale), opacity 0.6, lineWidth 1.5
- Add a **draggable sphere** (radius 0.12) at the line tip when `hasEffects` is true
  - On pointerDown: auto-switch to `adjust-angles` mode + begin drag using same ray-project logic as `PyroLaunchAngle.tsx` (lines 376-429)
  - This lets users adjust angles without manually pressing "A"
- Hide the short `DirectionLine` entirely when `PyroLaunchAngle` gizmo is active for this position (check `editorMode === 'adjust-angles'` and position is selected)

### 2. `src/components/editor/PyroLaunchAngle.tsx` — Auto-show trajectory for selected positions with effects

Change `visiblePositions` logic (lines 710-712):
- Currently: full gizmo shows only in `adjust-angles` mode; in `select` mode only selected positions get it
- New behavior: in `select` mode, also show the **trajectory line + grab handle** (but NOT the compass/arcs) for any selected position that has linked effects
- Add a `hasEffects` check by looking up timeline items for each position
- The compass rings, pitch/roll arcs remain `adjust-angles` only
- The trajectory + handle appear for selected+effects in ANY mode

### 3. `src/components/editor/PyroLaunchAngle.tsx` — Use real caliber for trajectory

Currently hardcodes `caliber = 4` (line 284). Change to:
- Accept optional `caliber` prop from linked timeline items
- Look up max caliber from timeline items linked to this position
- Fall back to 4 if none found
- This makes the trajectory line reach the correct height for the actual effect placed

## Files

| File | Change |
|------|--------|
| `src/components/editor/PositionPins.tsx` | DirectionLine uses break height from caliber, adds grab handle, hides when gizmo active |
| `src/components/editor/PyroLaunchAngle.tsx` | Auto-show trajectory+handle in select mode for positions with effects, use real caliber |

