

# Drag-and-Drop: Effects Library to Timeline

## Overview
Add native HTML5 drag-and-drop so users can drag effects from the sidebar and drop them onto timeline tracks, placing them at the exact timestamp where they are dropped.

## How It Works
1. **Drag from sidebar**: Each effect card becomes draggable. When you start dragging, the effect ID is stored in the drag data and a visual ghost follows the cursor.
2. **Drop onto timeline tracks**: Each track row becomes a drop zone with a highlight indicator. On drop, the pixel position is converted to a timestamp and a new timeline item is created.
3. **Visual feedback**: Tracks highlight with an accent border/glow when a valid drag hovers over them. The tip text at the bottom of the library updates to mention drag-and-drop.

## Technical Details

### Files Modified

**`src/components/editor/EffectLibrary.tsx`**
- Add `draggable="true"` to the `EffectCard` button element
- Add `onDragStart` handler that calls `e.dataTransfer.setData('application/effect-id', effect.id)` and sets `effectAllowed = 'copy'`
- Add a subtle opacity change during drag via `onDragEnd`
- Update the tip text to: "Drag or double-click to add to timeline"

**`src/components/editor/Timeline.tsx`**
- Add `onDragOver`, `onDragEnter`, `onDragLeave`, and `onDrop` handlers to the track content `div` inside `TimelineTrackRow`
- `onDragOver`: call `preventDefault()` to allow drop; validate the effect type matches the track (fireworks on track 0, drones on track 1)
- `onDragEnter`/`onDragLeave`: toggle a local `isDragOver` state to show a highlight border
- `onDrop`: read the effect ID from `dataTransfer`, compute the timestamp from the mouse X position relative to the track (same math as `handleTrackClick`), determine the appropriate track index, generate a random 3D position, and call `addTimelineItem`
- Pass `pixelsPerSecond` and `duration` into `TimelineTrackRow` (already available via props/parent)
- Add a conditional CSS class for the drag-over highlight (e.g., `ring-1 ring-primary/50 bg-primary/5`)

**`src/store/useProjectStore.ts`**
- No changes needed -- the existing `addTimelineItem` action is sufficient.

### Track Matching Logic
- Look up the dragged effect from `EFFECT_LIBRARY` by ID
- If `effect.type === 'firework'`, only allow drop on track 0 (Fireworks)
- If `effect.type === 'drone'`, only allow drop on track 1 (Drones)
- Track 2 (Audio) does not accept effect drops

### Timestamp Calculation on Drop
Reuse the same math from the existing `handleTrackClick`:
```
const x = e.clientX - trackRect.left + scrollLeft
const time = clamp(x / pixelsPerSecond, 0, duration)
```

### No External Dependencies
Uses the native HTML5 Drag and Drop API -- no new packages required.
