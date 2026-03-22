

# Plan: Bidirectional Selection Sync + Position Glow + FireOne Polish

## Summary

Three core gaps remain: (1) clicking positions in the viewport doesn't trigger bidirectional event selection, (2) timeline marquee doesn't sync positions back to viewport, (3) no visual glow/pulse on positions when their linked events are selected from the timeline. Plus minor FireOne addressing integration gap.

## Changes

### 1. `src/components/editor/PositionPins.tsx` — Bidirectional Selection on Click

Replace `selectPosition(position.id)` with `selectPositionAndLinkedEvents(position.id)` in the `onPointerDown` handler (line ~193). Import the function from the store.

Also add a **linked-event glow ring**: when the position's ID is in `selectedPositionIds` AND `linkedTimelineItemIds` contains items linked to this position, render an animated pulsing ring mesh (Three.js `RingGeometry`) around the position marker. The ring pulses with a sine wave, colored by position type.

### 2. `src/components/editor/PositionPins.tsx` — Pulse Ring for Timeline-Selected Positions

Add a new `<LinkedGlowRing>` component rendered inside each `Pin`:
- Visible when `linkedTimelineItemIds` contains any item linked to this position (i.e., events selected from timeline)
- Animated expanding ring using `useFrame` — scales 0.8→1.2 with sine oscillation
- Color: orange for pyro, cyan for drone
- Additive blending, semi-transparent

### 3. `src/components/editor/Timeline.tsx` — Marquee Syncs Linked Positions

After marquee selection completes (in `handleUp`), collect all `positionId` values from the selected items and call `selectMultiplePositionsAndLinkedEvents` to highlight those positions in the viewport. This replaces the current `toggleTimelineItemSelection` approach with a batch that also updates `linkedTimelineItemIds`.

### 4. `src/components/editor/Timeline.tsx` — Single Click Also Syncs

Already uses `selectTimelineItemAndLinkedPosition` — verified working. No change needed.

### 5. `src/store/useProjectStore.ts` — Sync linkedTimelineItemIds on Position Selection

In `selectPositionAndLinkedEvents`, ensure that `linkedTimelineItemIds` is populated with all timeline items linked to the selected position(s). Already implemented — verified.

### 6. `src/components/editor/AddressingPanel.tsx` — FireOne Address → Position Link

When FireOne hardware modules are mapped via auto-assign, link the addressing entry's `rackId` to the position's ID if the timeline item has a `positionId`. Show position name next to each address row in the table. Add a "Pos" column to the address table showing the linked position name.

### 7. `src/components/editor/PositionPins.tsx` — Show FireOne Module Badge

When a position has linked timeline items with addresses (from addressing store), show a small badge on the 3D marker indicating the module number (e.g., "M1"). Uses `useAddressingStore` to look up addresses by timeline item IDs.

## Files

| File | Change |
|------|--------|
| `src/components/editor/PositionPins.tsx` | Bidirectional select, linked glow ring, FireOne module badge |
| `src/components/editor/Timeline.tsx` | Marquee → position sync |
| `src/components/editor/AddressingPanel.tsx` | Position name column in address table |

