

# Plan: Position Window + Finale 3D UX Refinements

## Summary

Create a dedicated **Position Window** (Finale 3D's "Position Window") as a new panel, and refine existing UX elements to match Finale 3D's workflow patterns more closely.

## Changes

### 1. `src/components/editor/PositionWindow.tsx` — NEW: Finale-Style Position Window

A spreadsheet-style panel listing all positions with their linked effects, matching Finale 3D's Position Window:

**Columns**: `#` | `Name` | `Type` (pyro/drone/light) | `X` | `Y` | `Z` | `Heading` | `Pitch` | `Effects Count` | `Section`

**Features**:
- Click-to-edit cells for Name, X/Y/Z, Heading, Pitch, Section (inline editing like ScriptWindow)
- Row selection highlights position in 3D viewport (`selectPosition`)
- Multi-select rows with Shift+Click / Ctrl+Click for batch operations
- Right-click context menu: Duplicate, Delete, Assign Section, Add Effect Here
- Color-coded type indicators (orange=pyro, blue=drone, yellow=light)
- Expandable rows showing linked effects with their times and angles
- Sort by any column header click
- Filter by type (Pyro/Drone/Light tabs at top)
- Footer showing total counts per type
- "Add Position" button with type selector dropdown
- Tab/Enter keyboard navigation between editable cells
- Batch position editing: select multiple, edit X → applies delta to all

### 2. `src/pages/Index.tsx` — Register Position Window Panel

- Add `'positions'` to `PanelId` type
- Add `PositionWindow` to `renderPanelContent()`
- Import the new component

### 3. `src/components/editor/PanelTabBar.tsx` — Add Positions Entry

- Add `{ id: 'positions', label: 'Position Window', icon: MapPin }` to the "Posições" section
- Assign shortcut key `'V'` (matches Finale convention)

### 4. `src/components/editor/Timeline.tsx` — Finale UX Polish

- Show position name label on timeline items (small text below effect name) when linked
- Color-code timeline item borders by position section (if assigned)
- Add "Position:" prefix in tooltip hover on timeline items

### 5. `src/components/editor/EffectLibrary.tsx` — Finale UX Polish

- In table view, show position assignment count next to each effect
- Double-click effect with position selected → auto-link and add to timeline (already partially works, refine feedback)

### 6. `src/components/editor/Toolbar.tsx` — Add Position Window Quick Access

- Add a "Position Window" button in the View menu dropdown for quick toggle

## Files

| File | Change |
|------|--------|
| `src/components/editor/PositionWindow.tsx` | NEW — Full spreadsheet-style position manager |
| `src/pages/Index.tsx` | Register 'positions' panel |
| `src/components/editor/PanelTabBar.tsx` | Add 'positions' entry with MapPin icon |
| `src/components/editor/Timeline.tsx` | Show position name labels on items |
| `src/components/editor/EffectLibrary.tsx` | Show position assignment count in table view |
| `src/components/editor/Toolbar.tsx` | Add Position Window to View menu |

