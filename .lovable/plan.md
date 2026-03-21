

# Plan: Duplicate Into Flights UI + Enhanced Sequence + Finale-Style Show Import

## Summary

Three changes: (1) Add "Duplicate Into Flights" as a new tool mode in the ScriptingToolsPanel, (2) enhance the Sequence tool with more sort modes and cycle/bounce UI, (3) upgrade CSVImporter to support Finale 3D inventory/script formats with angle convention options and auto-inference of missing fields.

## Changes

### 1. `src/components/editor/ScriptingToolsPanel.tsx` — Add "Duplicate Into Flights" tool + enhance Sequence UI

**New tool mode** `'duplicate-flights'` added to the tool selector grid (change grid to 4 cols to fit 7 tools, or use a scrollable row):
- Icon: `Copy` from lucide
- Config UI:
  - "Flights per item" — number input (2-20), default 5
  - "Angle separation (deg)" — slider 5-90, default 15
  - "Time separation (s)" — input 0-5, default 0 (simultaneous)
  - "Center on original" — checkbox, default true
  - ASCII preview showing the resulting fan pattern via `getAnglesPreview()`
- Apply logic: calls `duplicateIntoFlights()`, creates new timeline items via `addTimelineItem()`, updates original pan if centering

**Enhanced Sequence UI**:
- Add missing sort modes from the engine: `position-clockwise`, `position-name`, `angle`, `angle-center-out`, `angle-edges-in`, `effect-time` — currently only 5 legacy modes are shown
- Add "Cycles" number input (1-10) and "Bounce" toggle checkbox — the engine already supports these but the UI doesn't expose them
- Add "Group Mode" selector: individual / stick-subsequences / multiple-cycles / bouncing-cycles

### 2. `src/components/editor/CSVImporter.tsx` — Finale 3D multi-format show importer

Expand to support importing **show scripts** (not just positions) from multiple formats per the Finale 3D manual:

**Format detection**: Auto-detect file type by extension and header row:
- `.csv` with Finale 3D column names → Finale Generic CSV
- `.csv` with Cobra headers → Cobra format
- `.fir` → FireOne
- `.shw` → Explo/ShowCreator
- `.xlsx` with `partNumber`/`description`/`partType` → Finale inventory

**Import options dialog** (shown after file parsed, before import):
- **Angle convention**: "Up = 0°" / "Up = 90°" / "Guess from file"
- **Prefire units**: seconds / milliseconds
- **Duration units**: seconds / milliseconds
- **Chain interpretation**: "Quantity = chains" / "Quantity = individual shells"
- **Size interpretation**: "inches" / "millimeters" / "shots (cake)"

**Column auto-mapping**: Match headers to Finale 3D script columns:
- `partNumber`, `description`, `partType`, `size`, `internalDelay`, `duration`, `height`, `color`, `subtype`, `vdl`, `manufacturer`, `stdPrice`, `fuseDelay`, `numDevices`, `available`, `weight`, `neq`, `safetyDistance`, `category`, `numTubes`, `rackType`, `dmxPatch`, `exNumber`, `ceNumber`, `unNumber`

**Auto-inference of missing fields** (per Finale manual):
- If no prefire → infer from caliber using `getCakePrefire()` / `getShellPrefire()`
- If no duration → infer from caliber using star lifetime table
- If no height → infer from caliber using apex formula
- If no position coordinates → distribute positions based on effect sizes and names

**Accept formats**: `.csv, .txt, .fir, .shw, .xlsx`

### 3. `src/lib/scriptingTools.ts` — No changes needed

The `duplicateIntoFlights()` function and enhanced sequence engine already exist. Only the UI needs to expose them.

## Files Summary

| File | Change |
|------|--------|
| `src/components/editor/ScriptingToolsPanel.tsx` | Add `duplicate-flights` tool mode with config UI + enhance Sequence with cycles/bounce/sort modes |
| `src/components/editor/CSVImporter.tsx` | Expand to Finale-style multi-format importer with angle/prefire/duration options and auto-inference |

