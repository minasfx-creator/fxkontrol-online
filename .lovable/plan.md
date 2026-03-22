

# Plan: Timeline & Angles UX Improvements — Finale 3D Style

## Summary

Based on Finale 3D Episode 4 (Timeline & Angles) and PyroJam 2023 Design Template workflows, the timeline and angle editing need several UX refinements: right-click context menus on cues, timeline item resize handles, angle indicators on timeline bars, marquee selection, and improved angle gizmo feedback.

## Changes

### 1. `src/components/editor/Timeline.tsx` — Right-Click Context Menu on Cues

Add `onContextMenu` handler to `DraggableTimelineItem`:
- **Set Time...** — opens inline time input at click position
- **Set Angle...** — selects the item and enters angle-edit mode, focusing the 3D gizmo on its position
- **Duplicate** (Ctrl+D)
- **Delete** (Del)
- **Assign to Position →** submenu listing pyro positions
- **Add to Chain** / **Break Chain**
- **Copy / Cut / Paste at Playhead**

Render a small floating `<div>` context menu positioned at mouse coordinates, dismissed on click-outside or Escape.

### 2. `src/components/editor/Timeline.tsx` — Resize Handles on Timeline Items

Add left and right edge drag handles to `DraggableTimelineItem`:
- **Right edge**: drag to change effect duration (updates `updateTimelineItem` with custom duration override)
- **Left edge**: drag to change start time (slip edit)
- Handles appear as 3px hover zones on edges, cursor changes to `col-resize`
- Minimum width constraint of 20px

### 3. `src/components/editor/Timeline.tsx` — Angle Indicator on Timeline Bars

For firework items, show a small angle arrow indicator inside the timeline bar:
- A tiny SVG arrow (8×8px) rotated to match the item's `pan` angle
- Color-coded: blue for heading-dominated, orange for steep pitch
- Only visible when bar width > 40px

### 4. `src/components/editor/Timeline.tsx` — Marquee/Lasso Selection

Add rubber-band selection on the timeline track area:
- On mousedown (not on an item), start drawing a selection rectangle
- On mousemove, highlight items whose bounds intersect the rectangle
- On mouseup, select all intersected items (add to selection if Shift held)
- Visual: semi-transparent blue rectangle with dashed border

### 5. `src/components/editor/PyroLaunchAngle.tsx` — Angle Snap & Grid Feedback

- Add angle snapping: hold Shift while dragging to snap heading to 5° increments and pitch to 5° increments
- Show snap grid lines on the heading compass when Shift is held (every 15°)
- Add a subtle "angle changed" toast/HUD showing delta (e.g. "ΔH +15° ΔP -3°") during drag, positioned near the handle

### 6. `src/components/editor/ScriptWindow.tsx` — Position Assignment Column

Make the Position column editable:
- Click on position name → dropdown of available pyro positions
- Selecting a position updates `positionId`, `positionName`, and `position.x/y/z` from the position data
- Shows "UNASSIGNED" in red italic when no position linked
- Batch-assignable: when multiple rows selected, assigning a position applies to all

### 7. `src/store/useProjectStore.ts` — Duration Override Support

Add optional `durationOverride` field to `TimelineItem`:
- When set, used instead of `effect.duration` for rendering width
- Enables timeline resize to persist
- Update all references that read `effect.duration` to check `item.durationOverride ?? effect.duration`

## Files

| File | Change |
|------|--------|
| `src/components/editor/Timeline.tsx` | Context menu, resize handles, angle indicators, marquee selection |
| `src/components/editor/PyroLaunchAngle.tsx` | Shift-snap to 5° grid, snap grid visualization, delta HUD |
| `src/components/editor/ScriptWindow.tsx` | Editable position column with dropdown |
| `src/store/useProjectStore.ts` | Add `durationOverride` to TimelineItem type |

