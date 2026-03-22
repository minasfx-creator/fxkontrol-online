

# Plan: Continue Finale 3D UI/UX Integration — Phase 5

## Summary

Building on the existing implementation (Position Window, Timeline tracks, ScriptWindow inline editing, angle gizmo), this phase addresses the remaining Finale 3D workflow patterns: collapsible track groups, section color-coding on timeline items, track header improvements, ScriptWindow VDL column with caliber badge, and global status bar refinements.

## Changes

### 1. `src/components/editor/Timeline.tsx` — Section Color-Coded Left Borders on Items

In `DraggableTimelineItem`, look up the item's `positionId` → position → `section` and apply a colored 2px left border:
- Section A = `#4CAF50`, B = `#2196F3`, C = `#FF9800`, D = `#E91E63`, E = `#9C27B0`, F = `#00BCD4`
- No section = transparent (current behavior)

### 2. `src/components/editor/Timeline.tsx` — Collapsible Track Groups

Wrap PYRO/DRONE/LIGHT tracks in a collapsible group header "FIRING SYSTEMS" with a chevron toggle. Same for Formation/DroneFX/Waypoints → "CHOREOGRAPHY" group. Matches Finale 3D track organization.

### 3. `src/components/editor/Timeline.tsx` — Track Header Improvements

- Add item count badge on each track label (e.g., "PYRO SYS · 12")
- Add mute/solo toggle icons on track headers (eye icon to show/hide items in 3D, headphone icon placeholder)
- Right-click on track label → "Select All on Track", "Delete All on Track"

### 4. `src/components/editor/ScriptWindow.tsx` — VDL Description + Caliber Badge

- Show caliber badge (e.g., `4"`) before description for firework items
- Show color swatch from VDL parsing next to description
- Add "Type" mini-icon column (shell/mine/cake/candle icon) before description

### 5. `src/components/editor/ScriptWindow.tsx` — Row Color Stripe by Section

- Add a 3px left color stripe on each row matching the position's section color (same palette as timeline borders)
- When no section assigned, show neutral gray stripe

### 6. `src/components/editor/EffectLibrary.tsx` — Finale-Style Category Badges

- Show part type badge (SHELL, MINE, CAKE, etc.) on each effect in both list and table views
- Show caliber prominently: `4"` badge in accent color for fireworks

### 7. `src/components/editor/PositionWindow.tsx` — Linked Effects Expandable

- Click expand arrow on a position row → shows linked timeline items inline (effect name, time, angles)
- Shows total effect count and cost sum per position
- Add "Focus in 3D" button that dispatches camera focus event

### 8. `src/components/editor/Toolbar.tsx` — Finale 3D Menu Bar Polish

- Add "Edit" menu: Select All (Ctrl+A), Duplicate (Ctrl+D), Delete (Del)
- Add "Show" menu: Play (Space), Stop, Rewind, Set Duration
- Ensure "View" menu lists all panel shortcuts

## Files

| File | Change |
|------|--------|
| `src/components/editor/Timeline.tsx` | Section color borders, collapsible track groups, track header badges/mute, track context menu |
| `src/components/editor/ScriptWindow.tsx` | VDL caliber badge, type icons, section color stripe |
| `src/components/editor/EffectLibrary.tsx` | Part type + caliber badges |
| `src/components/editor/PositionWindow.tsx` | Expandable linked effects, cost sum, focus button |
| `src/components/editor/Toolbar.tsx` | Edit menu, Show menu polish |

