

# Plan: Skylighter Chemical Encyclopedia + Wire Remaining Hardcoded Scaling + New Effects

## Summary

Integrate the comprehensive Skylighter chemical reference data (40+ compounds with safety, handling, and spectral properties), wire the 6 remaining hardcoded caliber-linear formulas to proper scaling functions, add the Veline color mixing system for composite colors, add dangerous combination warnings, black powder grade modifiers, and register 4 new effect types.

## Part 1: Wire Remaining Hardcoded Values (6 fixes)

### `src/components/editor/effects/CakeEffect.tsx`
- **Line 227**: `breakSpeed = 5 + caliber * 2.5` → import and use `getBreakSpeed(caliber) * 0.5`

### `src/components/editor/effects/ShellBurstRenderer.tsx`
- **Line 56**: `clamp(gl_PointSize, 1.0, 64.0)` → `clamp(gl_PointSize, 1.0, 64.0 + uCaliberScale * 8.0)` with new `uCaliberScale` uniform
- **Line 732**: `size={0.08 + caliber * 0.02}` → `size={getParticleSize(caliber) * 0.06}`
- **Line 751**: `args={[1.5 + caliber * 0.8, 16, 16]}` → `args={[1.0 + caliber * 1.0, 16, 16]}`
- **Line 890**: `size={0.15 + caliber * 0.04}` → `size={getParticleSize(caliber) * 0.1}`

### `src/components/editor/effects/SaluteEffect.tsx`
- **Line 350**: `size={0.1 + caliber * 0.02}` → `size={getParticleSize(caliber) * 0.05}`

## Part 2: Chemical Encyclopedia (`particleChemistry.ts`)

Add 15 new compounds from Skylighter reference with full metadata:

| Compound | Element | Color | Key Properties |
|----------|---------|-------|---------------|
| `ammonium_perchlorate` | NH4ClO4 | — | Oxidizer, density 1.95, ignition 240°C, decomposes before fusion |
| `barium_chlorate` | Ba(ClO3)2 | Green 590nm | Very sensitive, NEVER mix with S/sulfides |
| `barium_carbonate` | BaCO3 | Green | Neutralizer, insoluble, density 3.785 |
| `barium_sulfate` | BaSO4 | Green (strobe) | Low toxicity (insoluble), density 4.49 |
| `copper_chloride` | CuCl | Blue 500nm | Richest blue, hygroscopic |
| `copper_carbonate` | CuCO3 | Blue | Best with AP, neutralizes acids |
| `strontium_carbonate` | SrCO3 | Red 650nm | Safer than nitrate |
| `lithium_carbonate` | Li2CO3 | Red 670nm | Weak, replaced by Sr |
| `cryolite` | Na3AlF6 | Yellow 589nm | Non-hygroscopic sodium salt |
| `parlon` | C5H6Cl4 | — | Cl donor 66%, binder, soluble in MEK |
| `red_gum` | Accroids | — | Fuel/binder, preferred with nitrate+Al |
| `lampblack` | C | Gold | Finest carbon, willow/spider stars |
| `iron_filings` | Fe | Gold-yellow | Branching sparks, linseed-oil coated |
| `magnalium_alloy` | MgAl | Silver-white | Strobe/crackling, treat with K2Cr2O7 |
| `dextrin` | (C6H10O5)n | — | Standard water-soluble binder |

Add `VELINE_COLOR_MIXING` table:
```text
yellow     = 55% green + 45% orange
chartreuse = 80% green + 20% orange  
aqua       = 80% green + 20% blue
turquoise  = 55% green + 45% blue
magenta    = 50% red   + 50% blue
purple     = 5% orange + 15% red + 80% blue
peach      = 60% orange + 25% red + 15% blue
maroon     = 85% red + 15% blue
```

Add `getVelineCompositeColor(name)` function that blends primary compound RGB values.

Add `DANGEROUS_COMBINATIONS` safety table:
- KClO3 + S → spontaneous ignition
- KClO3 + Sb2S3 → spontaneous ignition  
- KClO3 + metals → extremely sensitive
- NH4NO3 + KClO3 → ammonium chlorate (explosive)
- Nitrates + Al (wet) → exothermic amide reaction

Add `BLACK_POWDER_GRADES` with burn rate modifiers:
- Cannon (4.76mm) = 1.0x
- 4FA (1.68mm) = 1.3x
- Meal D (0.42mm) = 2.0x
- 5FG (0.149mm) = 3.0x

## Part 3: Physics Refinements (`pyroPhysics.ts`)

- Add `REAL_BURST_HEIGHT_NFPA` table: 3"=120m, 4"=150m, 5"=180m, 6"=210m, 8"=270m, 10"=320m, 12"=350m
- Add `getRealBurstHeight()` for safety radius calculations
- Refine `getRiskDivision()`: >10" OR >7500g = 1.1G; >35g flash powder = 1.1G regardless of caliber (APA 87-1)
- Add `DEFLAGRATION_TEMP_RANGE` (1500-4000°C) and `DETONATION_PRESSURE_RANGE` constants

## Part 4: New Effect Types (`effectTypeSystem.ts`)

| Type | Category | Description |
|------|----------|-------------|
| `strobe_pot` | ground | Flashing ground pot (KClO4+Mg+BaCrO4), duration 30s |
| `go_getter` | aerial | Thrust-driven animated stars that swim erratically |
| `flying_fish` | aerial | Small self-propelled stars zipping around |
| `crackling` | aerial | Bismuth subcarbonate dragon eggs |
| `girandola` | aerial | Rotating wheel ascending with lift (APA 87-1) |
| `whistler` | aerial | Whistle composition (KClO4+sodium benzoate) |

## Files Summary

| File | Change |
|------|--------|
| `src/components/editor/effects/CakeEffect.tsx` | Wire `getBreakSpeed()` at line 227 |
| `src/components/editor/effects/ShellBurstRenderer.tsx` | Caliber-proportional gl_PointSize, glitter, flash, crossette |
| `src/components/editor/effects/SaluteEffect.tsx` | Wire `getParticleSize()` for debris |
| `src/render_ultra/fireworks/particleChemistry.ts` | 15 compounds, Veline system, dangerous combos, BP grades |
| `src/lib/pyroPhysics.ts` | NFPA heights, APA flash thresholds, temp/pressure constants |
| `src/lib/effectTypeSystem.ts` | Add 6 new effect types |

