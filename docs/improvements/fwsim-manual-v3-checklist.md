# FWsim v3 Manual — Improvements Mapped to FXKONTROL Editor

Source: `manual-2.pdf` (FWsim v3 Handbook, June 2024). This document maps
the FWsim feature surface to concrete improvements in the FXKONTROL editor.
Pure documentation — implementation lands in subsequent rounds.

## Tier 1 — Highest operational impact

### 1. Snap Cues to other Cues (FWsim §10.2.4)
Magnet snap when dropping a cue near an existing cue (±50 ms tolerance).
Already partially supported via timeline grid snap; add a per-user toggle
in Editor Preferences and visual snap line during drag.

### 2. Stepper insertion mode (§3.4.2)
Hot-key driven cue insertion that auto-advances the playhead by a
configurable interval (e.g. 200 ms / 1 beat). Pairs with `timelineClock`
already in `useProjectStore`. Surface in toolbar as "STEP" mode.

### 3. Smart Clone (§3.4.4)
Ctrl+drag clones the selected cue while preserving the rhythmic offset
relative to the previous cue (multi-break authoring). Requires reading
the last 2 cues on the same track, computing the delta, and applying it
to each clone.

### 4. Custom Components / Color Variations (§5.4.1–2)
"Generate variations" action on a preset card → produces N siblings with
hue rotated by ±k° in HSL, keeping caliber/duration/pattern. Already have
`quantizeRgbToVdl` in `vdlColorPipeline` — feed the variant hex through it
to keep palette parity.

## Tier 2 — Quality-of-life

### 5. Multi-Selection Rectangle (§3.4.3)
Drag-rectangle on the timeline to select multiple cues. Validate that
`Timeline*.tsx` already supports this; if not, add via a transparent
overlay capturing pointer events.

### 6. Vertical zoom in show editor (§10.1.3)
Ctrl+Wheel changes track row height. Useful when the user has 30+ tracks.
Persist per-project in `useProjectStore.editorPreferences`.

### 7. Auto-assign channels before export (§10.2.7)
Toggle in `ExportCoordinator`: when enabled, `generateChannelIDs()` runs
automatically before any `.fir`/`.csv`/`.fwe` export. Default ON.

### 8. Cost / NEC display (§5.8–9)
Optional `priceCents` and `necGrams` fields on `Effect`. When present,
the timeline footer shows a running total (cost + NEC). Already have
BoM export; add the live aggregate.

## Tier 3 — Documented but lower priority

### 9. Excel Export/Import of Effects Inventory (§5.7.3)
Round-trip `Effect[]` ↔ `.xlsx` with the columns from
`finalePartsXlsx` parser. Useful for show producers managing inventory
in spreadsheets.

### 10. Drone Show Integration with Drotek (§9.2)
Already covered by Skybrush export; document Drotek as an alternative
target if community demand surfaces.

## Out of scope (documented for completeness)

- Show Designer / Weekly update check / VSync (§10.1.1, 10.1.4–5):
  Not applicable — we run in-browser.
- Render to Video (§5.6): Not in the editor; covered by external screen
  capture or the OBS bridge already documented in `unreal-bridge.md`.
- "Firework Database" Excel-style inventory editor (§5.7): The strategic
  hub at `/strategy` already provides an Asset Library; extend with
  inline-edit + bulk Excel import in a later round if requested.

## Asset pack accompanying this audit

| Asset | Location | Status |
|---|---|---|
| 44 FWsim Pro `.fwe` presets | `public/finale-presets/*.fwe` | **Live** (catalog `FWSIM_BUILTIN_EFFECTS`) |
| 44 PNG thumbnails | `public/finale-presets/thumbs/NN.png` | **Live** (via `Effect.thumbUrl`) |
| 27 effect category SVGs | `src/assets/fwsim-effect-icons/` | **Available** (component `EffectCategoryIcon`) |
| 12 cue type SVGs | `src/assets/fwsim-cue-icons/` | **Available** (component `CueTypeIcon`) |
| 18 HLSL shaders | `docs/reference/fwsim-shaders/shaders.zip` | **Reference only** — port to GLSL on demand |
| 229 "Old Effects" names | `src/data/fwsimOldEffectsIndex.json` | **Live** (search via `searchFwsimOldEffects`, claim: marketing_hypothesis) |
