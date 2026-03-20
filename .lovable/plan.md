

# Plan: VDL Full Spec + Finale 3D Scripting Overhaul

## Part 1 — VDL Parser: Finale-Exact Colors, Trails, Timing, Adjustments

### `src/lib/vdlParser.ts`

**A. Replace VDL_COLORS** with Finale-exact RGB table (25 colors). Add `impliesTrail` flag per color. Silver, Gold, Charcoal, Gamboge auto-trigger comet trails. Add "Tip" variants (Silver Tip, Gold Tip) that render color without trail.

**B. Add to VDLResult interface:**
```text
angleOffset: number;       // R45, L30 etc. in degrees (+ = right)
liftTime: number;          // LFT override
delayBefore: number;       // DLY
durOverride: number;       // DUR (shots in cakes/chains)
noTrail: boolean;          // "No Trail" modifier
isChain: boolean;          // Chain keyword detected
chainCount: number;        // Chain Of N
chainEffects: string[];    // individual VDL per shell (split by +)
chainDelays: number[];     // CDS values per gap
shotCount: number;         // N Shot (cakes)
cakeDuration: number;      // total cake time
cakeRows: number;          // N Rows
firingPattern: string;     // Z-Shape, Fan, X-Shape, W-Shape, etc.
isAerial: boolean;         // "Shell" or "Aerial" keyword in cake
multiColors: string[][];   // & separated multi-color groups
```

**C. Complete Adjustment Terms** — Replace flat 20-entry list with full Finale matrix (Size, Brightness, Trail Brightness, Tip Brightness, Density, Thickness, Trail Length, Duration, Droopy, Ragged, Uniform — each with Slightly/Normal/Very levels). Support compound stacking ("Very Big Very Big").

**D. Parse Timing Terms** — Regex for `PFT`, `LFT`, `DLY`, `DUR`, `CDS`. Apply PFT rule: `< 0.5` = delay, `>= 0.5` = lift time.

**E. Parse Angle Terms** — R15 through R180 and L15 through L180. Set `angleOffset`.

**F. Parse Conjunctions correctly:**
- `+` → separates shots in cake/chain
- `&` → multi-color effect (Red & Blue Peony = one shell, two colors)
- `w/` or `With` → combines with mine/tail/pistil
- `And` → left undefined per spec, interpret smartly as `&` or `w/`

**G. Parse "No Trail"** — Override trailType to `'none'` even for Chrysanthemum/Willow.

**H. Parse Cake descriptions** — `N Shot`, `Cake`, firing pattern keywords, row specs.

**I. Parse Chain descriptions** — `Chain Of N`, `+` separated effects, `CDS` delays.

### `src/components/editor/effects/ShellBurstRenderer.tsx`

- Add `angleOffset` prop — rotate burst group by angle
- Auto-set trail when VDL type forces it (Chrysanthemum, Willow, Palm, Brocade, Kamuro)
- Respect `noTrail` flag

### `src/components/editor/effects/CometEffect.tsx`

- Add `angleOffset` prop — tilt trajectory direction

### `src/components/editor/effects/MineEffect.tsx`

- Add `angleOffset` and `heightMeters` props

### `src/components/editor/effects/CakeEffect.tsx`

- Expand firing patterns to full Finale spec: STR, STL, STT, FNR, FNL, FNT, ALR, ALL, ALT, ARR, ARL, ART, CTO, OTC, BLR, BLL, BLT, BRR, BRL, BRT, TRI, TRX, TRS, VST, VSS
- Map Z-Shape, X-Shape, W-Shape, V-Shape, Fan, Bookend, Wipe, Angle, Peacock body keywords to row patterns
- Support multi-row cakes with per-row firing descriptions

## Part 2 — Scripting Tools: Finale 3D Randomize + Sequence + Fan

### `src/lib/scriptingTools.ts`

**A. Upgrade `randomizeItems` to Finale's "looks random" algorithm:**
- Instead of pure random permutation of times, implement constraint-based shuffle that avoids consecutive repeats from the same position/angle/effect type
- Deterministic seed based on times + positions + call count (undo-friendly)

**B. Upgrade `makeIntoSequence`:**
- Add sort modes: `'position-name'`, `'position-ltr'`, `'position-clockwise'`, `'angle'`, `'angle-center-out'`, `'angle-edges-in'`, `'effect-time'`
- Add `cycles` and `bounce` options (multiple cycles, zig-zag)
- Add `groupMode`: `'individual'` | `'stick-subsequences'` | `'multiple-cycles'` | `'bouncing-cycles'`
- Handle chains atomically (don't break chain internal timing)

**C. Upgrade `makeIntoFan`:**
- Add sort modes: `'time'`, `'time-center-out'`, `'time-edges-in'`
- Add `inward` fan option (converge toward center)
- Support combining with sequence (fan + sequence = choreography patterns)

### `src/components/editor/ScriptingToolsPanel.tsx`

- Update UI to expose new sort modes, cycles/bounce, group modes
- Add "Duplicate & Fan" quick action (Finale workflow: duplicate N times → sequence → fan)
- Show ASCII angle preview like Finale's `\|/` notation

## Part 3 — Script Window Columns

### `src/store/useProjectStore.ts` (TimelineItem type)

Add missing Finale script columns to TimelineItem:
```text
spin: number;              // rotation around trajectory
chainRef: string;          // chain reference ID
chainGap: number;          // ms delay in chain
chainRow: number;          // row index in multi-effect chain
flightCount: number;       // devices at same time+position
hazard: string;            // lockout class
rack: number;              // rack reference
tube: number;              // tube in rack
section: string;           // show section
universe: string;          // firing system universe
notes: string;             // user notes
customField: string;       // user custom field
```

## Files Summary

| File | Change |
|------|--------|
| `src/lib/vdlParser.ts` | Finale RGB colors + impliesTrail, timing terms, angles, adjustments, conjunctions, cake/chain parsing |
| `src/lib/scriptingTools.ts` | Finale randomize algorithm, sequence cycles/bounce/groups, fan sort modes |
| `src/components/editor/ScriptingToolsPanel.tsx` | UI for new sort modes, cycles, bounce, groups |
| `ShellBurstRenderer.tsx` | angleOffset prop, auto-trail from type |
| `CakeEffect.tsx` | 25 Finale firing pattern keywords |
| `CometEffect.tsx` | angleOffset prop |
| `MineEffect.tsx` | angleOffset + heightMeters props |
| `useProjectStore.ts` | Extended TimelineItem with Finale script columns |

