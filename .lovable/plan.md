

# Plan: Missing Finale 3D Features Integration

## Summary

After reviewing the full Finale 3D manual against the current codebase, the following features are **missing or incomplete**. The project already covers most core features (VDL, effects library, scripting tools, fans, sequences, flights, chains, camera animation, camera bookmarks, position groups, rack management, firing system exports, DMX). These are the gaps:

## Missing Features

### 1. Lockout / Risk Groups (Real-Time Safety Override)

Finale 3D has a "lockout" system where effects have a `lockoutDefault` hazard class (e.g. caliber group). During live firing, operators can block entire risk groups from firing based on real-time wind conditions.

**Changes:**
- `src/store/useProjectStore.ts`: Add `lockoutDefault` field to effect type and `activeLockouts: string[]` to show state
- `src/components/editor/live-firing/` or `LiveFiringPanel.tsx`: Add lockout toggle panel with risk group buttons (e.g. "Block 4"+ shells", "Block all aerial")
- `src/lib/pyroPhysics.ts`: Add `getRiskGroup(caliber)` mapping

### 2. Position Sections (Show Segmentation)

Finale manual describes a `Section` field on positions for splitting shows into sequences for semi-automatic firing. Positions get a section label; the show can be split into independently-fireable segments.

**Changes:**
- `src/store/useProjectStore.ts`: Add `section?: string` to `Position` type
- `src/components/editor/PositionContextMenu.tsx`: Add section assignment in unified menu
- `src/components/editor/ScriptWindow.tsx`: Add "group by section" view and section filter
- `src/components/editor/Timeline.tsx`: Visual section dividers on timeline

### 3. Windage Compensation

Manual mentions adjusting angles to compensate for wind drift on shells. Currently wind affects particle rendering but doesn't offer automatic angle compensation suggestions.

**Changes:**
- `src/lib/pyroPhysics.ts`: Add `calcWindCompensation(caliber, height, windSpeed, windDir, heading)` returning suggested heading/pitch offset
- `src/components/editor/PyroLaunchAngle.tsx`: Show wind compensation indicator on gizmo (ghost arrow showing corrected trajectory)
- `src/components/editor/ScriptingToolsPanel.tsx`: Add "Apply Wind Compensation" tool that batch-adjusts all selected items' angles

### 4. Snap-to-Surface for Positions on 3D Models

Manual describes positions auto-snapping to imported 3D model surfaces. Currently positions only snap to ground plane.

**Changes:**
- `src/components/editor/SkyCanvas.tsx`: In position drag handler, raycast against site models (not just ground plane) to snap position Y to mesh surface
- `src/components/editor/SiteModelRenderer.tsx`: Expose mesh refs for raycasting

### 5. Effect Creation from VDL Description

Manual describes typing a VDL description to auto-create an effect with simulation. The VDL parser exists but there's no "Create Effect from Description" dialog.

**Changes:**
- `src/components/editor/EffectLibrary.tsx`: Add "Create Effect..." button that opens a dialog where user types a VDL string, parser generates all parameters, and effect is added to the library

### 6. Show Duration / Info Panel

Manual references "Show > Settings" with show duration, site info, client info. `ShowSettingsPanel` exists but is missing some fields.

**Changes:**
- `src/components/editor/ShowSettingsPanel.tsx`: Add show info fields: client name, site name, show date, show category, notes — persisted to database

## Files

| File | Change |
|------|--------|
| `src/store/useProjectStore.ts` | Add `section` to Position, `lockoutDefault` to effects, `activeLockouts` to state |
| `src/lib/pyroPhysics.ts` | Add `getRiskGroup()`, `calcWindCompensation()` |
| `src/components/editor/PyroLaunchAngle.tsx` | Wind compensation ghost arrow indicator |
| `src/components/editor/PositionContextMenu.tsx` | Section assignment field |
| `src/components/editor/ScriptWindow.tsx` | Group-by-section view |
| `src/components/editor/Timeline.tsx` | Section dividers |
| `src/components/editor/ScriptingToolsPanel.tsx` | "Apply Wind Compensation" tool |
| `src/components/editor/EffectLibrary.tsx` | "Create Effect from VDL" dialog |
| `src/components/editor/LiveFiringPanel.tsx` | Lockout risk group toggles |
| `src/components/editor/SkyCanvas.tsx` | Position snap-to-surface raycasting |
| `src/components/editor/ShowSettingsPanel.tsx` | Show info fields (client, site, date) |

