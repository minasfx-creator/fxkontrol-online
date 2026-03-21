

# Plan: Apply Finale 3D Manual Corrections — Physics, VDL, Scripting & Angles

## Study Findings

After analyzing the 50-page Finale 3D manual against the codebase, I identified the following discrepancies and missing features:

### Discrepancies Found

**1. Prefire Logic for Cakes (Critical)**
Manual says: when prefire is blank or 0 for aerial cakes, Finale auto-calculates the lift time of the first shell. Current `vdlParser.ts` doesn't implement this — cakes get the same prefire as shells. A prefire of 0.3s on a 3" aerial cake makes it "break at 0.3s on the way up, looking like a geyser" — the manual warns this is BAD. The parser needs to treat blank/0 prefire for cakes as "auto-calculate from caliber".

**2. Duration Meaning Differs by Type (Missing Logic)**
Manual Table 2 (page 37) defines distinct semantics:
- **Shells**: duration = star lifetime
- **Comets/Mines**: duration = star lifetime  
- **Cakes/Candles**: duration = total time from first launch to last break
- **Gerbs/Fountains**: duration = continuous effect time

The VDL parser applies a single duration scaling formula regardless of type. Cake duration should NOT scale the same as shell star lifetime.

**3. Prefire Meaning Differs by Type (Missing Logic)**
Manual Table 2:
- **Shells**: prefire = break time (adjusts whether break is before/after apex). Does NOT affect trajectory apex height.
- **Comets/Mines**: prefire doesn't affect simulation, only script timing
- **Cakes**: prefire = lift time of sub-shells (blank = auto-calculate)

The parser currently applies `calData.prefireSec` uniformly. Shell prefire should not change mortar velocity/apex.

**4. "Type" Field Part Types Incomplete**
Manual lists exact Finale part types: `shell, cake, candle, single shot, mine, comet, ground, rocket, flame, other effect, not an effect, rack, sfx, light`. Current `VDL_TYPES` is missing: `rocket`, `single_shot` (as explicit type), `light`, `ground` (as generic). These should be added.

**5. Height Field Semantics**
Manual: "Height in meters of the apex of the trajectory for aerial shells, OR of the spark cloud for fountains/gerbs." Current code uses same height logic for both. Gerb/fountain height should represent spark cloud top, not ballistic apex.

**6. Angle Notation — Chain ASCII Preview**
Manual: chains display angles as `\\|//` for a fanned chain of 5 (page 47). The `getAngleAscii` function exists but the boundaries could be refined. Finale uses heading-based angles where straight up = `|`, and the notation covers exact degree ranges. Current thresholds (30, 60, 80, 100, 120, 150) are reasonable but should add the double-slash notation at exact 22.5° increments to match Finale's snap grid.

**7. "Duplicate Into Flights" Missing**
Manual describes "Script > Duplicate > Duplicate Into Flights..." which duplicates each selected effect into N copies fanned at a specified angle interval. This is NOT in `scriptingTools.ts`. It's a key Finale scripting feature.

**8. Fan Angle Widget Snap Points**
Manual (page 19): the rotation widget snaps to 1°, 5°, or 22.5° depending on arrow length. Current fan tool doesn't enforce these snap intervals.

**9. VDL Column / Import Fields**
Manual lists `fuseDelay` as distinct from `prefire` — the fuse delay is the visco delay between ignition and first launch. Current parser conflates these. Need to add `fuseDelay` as separate field in VDLResult.

**10. Cake Creation from Sub-Effects**
Manual: "Effects > Create Cake From Selected Items..." creates a cake by combining individual effects with their timing. The `getCakeShotTimes` function exists but doesn't support creating compound cakes from multiple VDL descriptions.

## Changes

### 1. `src/lib/pyroPhysics.ts` — Add type-aware prefire/duration helpers

Add helper functions that return correct physics parameters per part type:
- `getShellPrefire(caliberInches)` — break time (current logic, correct)
- `getCakePrefire(caliberInches)` — lift time of sub-shells (auto from caliber when blank/0)
- `getCakeDuration(shotCount, intervalMs)` — total cake time
- Add `rocket` type with upward trajectory and motor burn

Add missing part types: `rocket`, `single_shot`, `light`, `ground`.

### 2. `src/lib/vdlParser.ts` — Fix type-dependent prefire/duration semantics

**Prefire fix**: After determining `partType`, apply different prefire logic:
- `shell`: use `calData.prefireSec` (break time)
- `cake`/`candle`: if prefire is blank/0/unset, auto-calculate as lift time; if set to small value like 0.3, warn/clamp
- `comet`/`mine`: prefire = 0 for simulation (only matters for script timing)
- `gerb`/`fountain`/`waterfall`: prefire = 0

**Duration fix**: Apply type-specific duration:
- `shell`: star lifetime (current, correct)
- `cake`: total time from first launch to last break (use `shotCount * interval`)
- `candle`: total time  
- `gerb`/`fountain`: continuous effect time (current, correct)

**Height fix**: For `gerb`/`fountain`, height = spark cloud top, don't apply ballistic apex formula.

Add missing VDL types: `rocket` (upward trajectory), `single shot` (alias for single_shot), `light` (stage light placeholder).

Add `fuseDelay` field to `VDLResult` interface + parse "fuse" or "FD" prefix from VDL string.

### 3. `src/lib/scriptingTools.ts` — Add "Duplicate Into Flights"

Add `duplicateIntoFlights()` function:
```
function duplicateIntoFlights(
  items: TimelineItem[],
  flightsPerItem: number,
  angleSeparation: number, // degrees between flights
  timeSeparation: number,  // seconds between flights (0 = simultaneous)
): { original: TimelineItem; copies: Partial<TimelineItem>[] }[]
```

Each selected item gets N-1 copies, each angled `angleSeparation` degrees apart, optionally staggered in time. This matches Finale's "Script > Duplicate > Duplicate Into Flights..." exactly.

Also add angle snap helper:
```
function snapAngle(degrees: number, snapInterval: number): number
// Supports 1°, 5°, 22.5° snap intervals per Finale manual
```

### 4. `src/lib/scriptingTools.ts` — Refine ASCII angle notation

Update `getAngleAscii` to match Finale's 22.5° snap grid:
- 0-11.25° = `\\\\` (hard left)
- 11.25-33.75° = `\\`
- 33.75-56.25° = `\\|`  
- 56.25-78.75° = `\|`
- 78.75-101.25° = `|`
- 101.25-123.75° = `|/`
- 123.75-146.25° = `/|`
- 146.25-168.75° = `/`
- 168.75-180° = `//` (hard right)

### 5. `src/lib/manufacturerCalibration.ts` — Add missing caliber data

Add 1" and 1.5" calibers to `STAR_LIFETIME` coverage in `pyroPhysics.ts` (currently starts at 3"). The manual references effects as small as 30mm (~1.18"). Add interpolation support for sub-2" calibers.

## Files Summary

| File | Change |
|------|--------|
| `src/lib/pyroPhysics.ts` | Add type-aware prefire/duration helpers, `rocket` physics, sub-2" caliber support |
| `src/lib/vdlParser.ts` | Fix type-dependent prefire/duration/height semantics, add `fuseDelay` field, add missing types (`rocket`, `single shot`, `light`) |
| `src/lib/scriptingTools.ts` | Add `duplicateIntoFlights()`, angle snap helper, refine ASCII angle notation to 22.5° grid |
| `src/lib/manufacturerCalibration.ts` | Add small caliber (1", 1.5") star lifetime data |

