

# Plan: Continue Finale 3D UX Implementation — Remaining Refinements

## Summary

The previous rounds implemented: Position Window, Timeline context menus, resize handles, angle indicators, marquee selection, angle snap/grid, and ScriptWindow inline editing. Several Finale 3D UX patterns remain unimplemented. This plan addresses the gaps.

## Remaining Gaps

1. **EffectLibrary table view** — no "Position Count" column showing how many positions use each effect
2. **Timeline** — missing a dedicated DRONE track row (track index 1) like PYRO SYS; drone items currently have no proper drop target track
3. **Timeline track labels** — no color-coding by position section on item borders
4. **ScriptWindow** — position column exists but no dropdown selector; just text display
5. **Toolbar** — 'V' key shortcut mapped to `setEditorMode('select')` instead of opening Position Window
6. **EffectLibrary** — double-click adds effect but doesn't show a confirmation count badge or visual feedback matching Finale
7. **Timeline** — no "LIGHT" track row for lighting cues (track index 2 is generic)
8. **PositionWindow** — missing "Select All" (Ctrl+A) and "Invert Selection" shortcuts

## Changes

### 1. `src/components/editor/EffectLibrary.tsx` — Position Usage Count Column

Add a `Pos` column to the table view header and `EffectTableRow`:
- Count how many `timelineItems` reference each effect ID
- Display as a small badge (e.g., `×3`) in the new column
- Sort by usage count when clicking header

### 2. `src/components/editor/Timeline.tsx` — Section Color-Coded Borders

In `DraggableTimelineItem`, when the item has a `positionId`:
- Look up the position's `section` from the store
- Apply a left border color: Section A = green, Section B = blue, Section C = orange
- 2px left border accent, subtle but visible

### 3. `src/components/editor/Timeline.tsx` — Add LIGHT Track Row

Add a `TimelineTrackRow` for lighting cues (trackIndex 2) below PYRO SYS:
- Label: "LIGHT SYS", color: yellow (#FBBF24)
- Accepts `light` type effects on drop

### 4. `src/components/editor/ScriptWindow.tsx` — Position Dropdown Selector

Make the Position column clickable to show a dropdown:
- List all positions matching the effect type (pyro positions for firework effects)
- Selecting updates `positionId`, `positionName`, and `position.x/y/z`
- Show "UNASSIGNED" in red italic when no position
- Support batch assignment when multiple rows selected

### 5. `src/components/editor/Toolbar.tsx` — Fix 'V' Key Shortcut

Change the 'v' key handler to open the Position Window panel instead of setting editor mode to 'select'. The select mode should use 'S' instead.

### 6. `src/components/editor/PositionWindow.tsx` — Ctrl+A Select All

Add keyboard event handler:
- `Ctrl+A`: select all filtered positions via `selectMultiplePositions`
- `Delete`: remove all selected positions
- `Ctrl+D`: duplicate selected positions

### 7. `src/components/editor/EffectLibrary.tsx` — Double-Click Feedback

After double-click adds effect to timeline, briefly flash the row green and show a count badge (+1) that fades after 1s.

## Files

| File | Change |
|------|--------|
| `src/components/editor/EffectLibrary.tsx` | Position usage count column, double-click feedback |
| `src/components/editor/Timeline.tsx` | Section color borders on items, LIGHT track row |
| `src/components/editor/ScriptWindow.tsx` | Position dropdown selector with batch support |
| `src/components/editor/Toolbar.tsx` | Fix 'V' shortcut to open Position Window |
| `src/components/editor/PositionWindow.tsx` | Ctrl+A, Delete, Ctrl+D keyboard shortcuts |

