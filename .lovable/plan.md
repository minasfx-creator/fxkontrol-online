

# Plan: Debug Overlay Default, Camera Spawn, Trajectory Angle Handle & Finale UX

## Summary

Four fixes: (1) render debug starts closed, (2) camera spawns at ground level ~100m from center, (3) angle editing trajectory shows the actual shell parabola with the drag handle at the trajectory apex, (4) Finale 3D-style inline data editing in script window.

## Changes

### 1. `src/components/editor/SkyCanvas.tsx` — Debug Overlay Starts Closed

Line 3578: Change `useState(true)` → `useState(false)`.

### 2. `src/components/editor/SkyCanvas.tsx` — Camera Spawn Fix

Default `free` preset (line 136): Change position from `[0, 2, 2200]` to `[0, 1.7, 100]` — ground level, 100m from center, looking at launch area. Update target to `[0, 50, 0]` so the user looks slightly upward toward where effects will appear.

Also update the cinematic intro start position (`introStartPos`, line 3137) from `[0, 2500, 0.01]` to `[0, 300, 100]` for a less extreme sweep.

### 3. `src/components/editor/PyroLaunchAngle.tsx` — Trajectory Handle at Apex

**Move the drag handle to the end of the trajectory parabola** instead of the arrow tip:
- Keep the arrow shaft for direction visualization
- Compute the trajectory apex point (highest point of the parabola) as the handle position
- The `trajectoryPoints` array already computes the parabolic path — use the last point (or apex) as `handlePos`
- This matches Finale 3D where you grab the burst point to adjust angles

**Show effect trajectory lines**: For each timeline item linked to this position, render a trajectory line showing the actual shell flight path (using caliber-derived physics from `pyroPhysics.ts` — `getBreakHeight`, `getMortarVelocity`, `getLiftTime`). This gives visual feedback of where shells will burst.

### 4. `src/components/editor/ScriptWindow.tsx` — Finale-Style Inline Data Editing

Replicate Finale 3D's "Directly Editing Effect and Script Data" pattern:
- **Click-to-edit cells**: Time, position, angle, and description cells become editable on click (currently only some fields are editable)
- **Add inline editing for**: heading (H), pitch (P), effect description/VDL, and notes columns
- **Tab navigation**: Tab moves to next editable cell in the row, Shift+Tab goes back
- **Enter commits and moves down**, Escape cancels edit
- **Multi-select edit**: When multiple rows are selected, editing a field applies the value to all selected rows (Finale "batch edit" pattern)

## Files

| File | Change |
|------|--------|
| `src/components/editor/SkyCanvas.tsx` | Debug overlay default `false`, camera spawn at ground ~100m from center |
| `src/components/editor/PyroLaunchAngle.tsx` | Drag handle at trajectory apex, show linked effect trajectories |
| `src/components/editor/ScriptWindow.tsx` | Inline editable cells with Tab/Enter navigation, batch edit |

