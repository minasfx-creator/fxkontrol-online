

# Plan: Finale 3D Selection Modes — Positions & Events + UX Refinements

## Summary

Looking at the screenshot, Finale 3D shows a **unified selection system** where selecting positions in the 3D viewport automatically highlights their linked events in the timeline (and vice versa). The screenshot shows "1 Pyro ⚡ 14 fx" in the status bar — selecting 1 position reveals all 14 linked effects. This bidirectional selection binding is the core feature to implement, along with Finale-style selection mode buttons in both the viewport and timeline.

## Changes

### 1. Bidirectional Selection Binding (Store)

**`src/store/useProjectStore.ts`**

Add a `selectionMode` state: `'positions'` | `'events'` | `'both'` (default `'both'`).

Add two derived-action helpers:
- `selectPositionAndLinkedEvents(positionId)` — selects a position AND auto-selects all timeline items linked to it
- `selectTimelineItemAndLinkedPosition(itemId)` — selects a timeline item AND highlights its linked position in the viewport
- `selectMultiplePositionsAndLinkedEvents(ids)` — batch version for multi-select

### 2. Selection Mode Toggle Bar (Viewport)

**`src/components/editor/SelectionModeBar.tsx`** — NEW

A floating bar in the viewport (matching screenshot's icon row) with toggle buttons:
- **Select Positions** — click selects positions only
- **Select Events** — click selects timeline items only  
- **Select Both** — selects position + linked events (Finale default)
- **Lasso** — activates box/lasso selection
- **Select by Section** — dropdown to select all positions in a section (A-F)

Icons match Finale 3D: position pin, lightning bolt, link icon, lasso, grid.

### 3. Timeline Selection Sync

**`src/components/editor/Timeline.tsx`**

- When a position is selected in the viewport, auto-highlight all timeline items linked to that position (yellow outline glow)
- When a timeline item is clicked, auto-select its linked position in the 3D viewport
- Show "linked selection" indicator: dashed border on items that are selected via position linkage (vs direct click)
- Update `handleItemSelect` to call `selectTimelineItemAndLinkedPosition`

### 4. Viewport Selection Sync  

**`src/components/editor/SelectionStatusBar.tsx`**

- Update to use bidirectional selection — show both selected positions AND their linked event count
- When events are selected in timeline, highlight corresponding positions in viewport
- Add selection mode indicator text (e.g., "Mode: Both" or "Mode: Positions Only")

### 5. AlignmentTools Enhancement

**`src/components/editor/AlignmentTools.tsx`**

- Add Finale-style selection filter icons at the start of the toolbar (matching screenshot):
  - Filter: Pyro only, Drone only, Light only, All
  - These filter which selected items are affected by alignment operations
- Show selection count with type breakdown: "3 Pyro · 2 Drone"

### 6. BoxSelectOverlay — Support Both Modes

**`src/components/editor/BoxSelectOverlay.tsx`**

- In "both" mode, box selection selects positions AND their linked timeline items
- In "events" mode, box selection on viewport selects timeline items at those positions
- Dispatch linked selections after box select completes

### 7. Timeline Marquee → Position Sync

**`src/components/editor/Timeline.tsx`**

- When marquee-selecting timeline items, auto-highlight their linked positions in the 3D viewport
- Show position markers flash/pulse when their events are selected via timeline marquee

## Files

| File | Change |
|------|--------|
| `src/store/useProjectStore.ts` | Add `selectionMode`, bidirectional selection actions |
| `src/components/editor/SelectionModeBar.tsx` | NEW — Finale-style selection mode toggle bar |
| `src/components/editor/Timeline.tsx` | Bidirectional selection sync, linked item highlighting |
| `src/components/editor/SelectionStatusBar.tsx` | Show selection mode, bidirectional counts |
| `src/components/editor/AlignmentTools.tsx` | Selection filter icons, type breakdown |
| `src/components/editor/BoxSelectOverlay.tsx` | Support bidirectional box selection |
| `src/pages/Index.tsx` | Mount SelectionModeBar in viewport area |

