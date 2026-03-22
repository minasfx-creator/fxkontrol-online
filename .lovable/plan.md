

# Fix: Grab Handles at Burst Point (Apex) Instead of Ground

## Problem

The grab handles (drag points for angle adjustment) are rendered at ground level because `handlePos` in `PyroLaunchAngle.tsx` uses `trajectoryData.lastPoint` — the final point of the ballistic trajectory where `py < 0` (shell falls back to ground). It should use `trajectoryData.apexPoint` — the highest point (burst altitude).

Reference screenshots show diamond handles at the TOP of each trajectory arc, matching Finale 3D behavior.

## Root Cause

`PyroLaunchAngle.tsx` line 351-354:
```typescript
const handlePos = useMemo((): [number, number, number] => {
  return trajectoryData.lastPoint as [number, number, number];
}, [trajectoryData]);
```

`lastPoint` = where shell hits ground. `apexPoint` = burst height. Wrong one is used.

## Fix

### `src/components/editor/PyroLaunchAngle.tsx`

**Single change** — line 353: replace `lastPoint` with `apexPoint`:

```typescript
const handlePos = useMemo((): [number, number, number] => {
  return trajectoryData.apexPoint as [number, number, number];
}, [trajectoryData]);
```

This places the draggable handle at the burst point (apex of trajectory) where the shell explodes — matching Finale 3D exactly. The label, rings, and axis indicator all reference `handlePos` so they move with it automatically.

### Also in `PositionPins.tsx` — DirectionLine grab handle position

The `DirectionLine` component already computes the correct tip position from heading/pitch/sceneLength (line 577-584). The diamond handle at `tip` is correct since the cosmetic line already points to burst height. No change needed here — but verify `DirectionLine` hides when `PyroLaunchAngle` is active (line 624-625 already does this).

## Files

| File | Change |
|------|--------|
| `src/components/editor/PyroLaunchAngle.tsx` | `handlePos` uses `apexPoint` instead of `lastPoint` |

