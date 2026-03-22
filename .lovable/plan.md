

# Plan: Finale 3D Angles, Racks, Positions & Timeline Refinements

## Summary

Based on the Finale 3D documentation for pan/tilt/spin (effects), heading/pitch/roll (positions/racks), rack layout workflows, and position/timeline interactions, the following gaps and refinements are needed.

## Key Findings from Finale 3D Docs

1. **Effects use pan/tilt/spin** (moving-head light model), **positions use heading/pitch/roll** (mortar rack model). These are distinct coordinate systems. The codebase has `pan/tilt/spin` on `TimelineItem` but doesn't use them in the gizmo or apply the Euler rotation order correctly.

2. **Position rotation modes**: Finale offers separate right-click commands for Rotate (heading), Rotate (pitch), Rotate (roll), and Rotate (around position's up vector). Currently only heading is editable via gizmo; pitch is clamped 5-85 and roll is stored but never exposed.

3. **Rack layout is a visual CAD-like top-down view** with drag-and-drop of effects into tubes, rack clustering, and constraint-based addressing. Current `RackVisualEditor` is a single-rack SVG view — lacks the multi-rack layout workspace.

4. **Inline H/P labels need to be editable inputs** (approved in previous plan but not yet implemented).

5. **Gizmo needs separate rotation modes** matching Finale's right-click workflow: heading wheel, pitch arc, roll rotation — selectable from context menu.

## Changes

### 1. `src/components/editor/PyroLaunchAngle.tsx` — Inline Editable H/P/R + Rotation Modes

**Inline numeric inputs**: Replace the `pointer-events-none` H/P labels (lines 386-423) with interactive inputs:
- Remove `pointer-events-none` from the container div
- Replace `{Math.round(position.heading)}°` with `<input type="number" step={1} value={heading} onBlur={commit} />` (40px wide, monospace, transparent background matching current style)
- Same for Pitch
- Add Roll input (currently hidden)
- On Enter or blur: commit value via `updatePosition`
- On focus: `e.target.select()` for quick overwrite

**Add rotation mode indicators**: When dragging, show which axis is being edited (H blue, P orange, R green) with a subtle axis highlight.

**Expand pitch range**: Change from `Math.max(5, Math.min(85, ...))` to `Math.max(-180, Math.min(180, ...))` per Finale 3D spec (Table 2: pitch range is -180° to +180°). This allows forward/backward tilt.

**Roll support in gizmo**: Add a RollArc visualization (green) when roll ≠ 0, similar to PitchArc but around Z-axis.

### 2. `src/components/editor/PositionContextMenu.tsx` — Finale Rotation Commands

Add Finale 3D-style rotation commands to context menu:
- **Rotate (heading)** — enters angle mode focused on heading axis
- **Rotate (pitch)** — enters angle mode focused on pitch axis  
- **Rotate (roll)** — enters angle mode focused on roll axis
- **Rotate (around up vector)** — for wall-mounted positions
- **Move on axis...** — shows XYZ axis arrows for local-frame movement

Emit a custom event `angle-mode-axis` with the selected axis so `PyroLaunchAngle` can constrain drag to that axis only.

### 3. `src/components/editor/PositionContextMenu.tsx` — Unified Menu (Merge PopupEditor)

Merge `PositionPopupEditor` properties into the context menu as inline sections:
- **Quick Props**: X/Y/Z coordinate fields, H/P/R sliders+inputs (compact row)
- **Linked Effects**: collapsible list with unlink buttons
- Remove the separate `PositionPopupEditor` component call from `Index.tsx`

### 4. `src/store/useProjectStore.ts` — Pan/Tilt/Spin Euler Order

The `TimelineItem` already has `pan/tilt/spin` fields. Add a helper function `effectWorldOrientation(position, timelineItem)` that computes the world rotation by combining:
1. Position heading/pitch/roll (R1=pitch×X, R2=roll×Z, R3=heading×Y)
2. Effect pan/tilt/spin (R1=spin×Y, R2=tilt×X, R3=pan×Y)

This ensures effects placed on rotated positions shoot in the correct world direction.

### 5. `src/components/editor/RackVisualEditor.tsx` — Multi-Rack Layout Workspace

Add a **Rack Layout View** mode (activated from Racks panel):
- Top-down canvas showing all racks at a position as draggable rectangles
- Rack snapping: racks near each other form "clusters"
- Drag-and-drop effects (red circles) from an unassigned pile into rack tubes
- Pin number display in tubes when addressed
- Links: "Add racks for show", "Re-address", "Delete racks"

### 6. `src/components/editor/PopupEditors.tsx` — Cleanup

Remove `PositionPopupEditor` and old `PositionContextMenu` exports. Keep `ShortcutsOverlay`. Update `Index.tsx` imports.

## Files

| File | Change |
|------|--------|
| `src/components/editor/PyroLaunchAngle.tsx` | Inline editable H/P/R inputs, roll arc, expanded pitch range, axis-constrained drag |
| `src/components/editor/PositionContextMenu.tsx` | Finale rotation commands, merged properties panel, linked effects list |
| `src/components/editor/PopupEditors.tsx` | Remove PositionPopupEditor and old PositionContextMenu |
| `src/pages/Index.tsx` | Remove PositionPopupEditor usage |
| `src/store/useProjectStore.ts` | Add `effectWorldOrientation()` helper |
| `src/components/editor/RackVisualEditor.tsx` | Multi-rack layout workspace mode |

