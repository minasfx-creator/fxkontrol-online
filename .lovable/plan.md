

# Plan: PyroJam 2025 "Timeless Storytimes" — Realism Refinements

## Summary

After reviewing the full effects codebase against competition-grade pyro simulation standards (PyroJam 2025 Finland footage), the following refinements target the most impactful visual gaps: star thermal rendering fidelity, trail density, smoke persistence, and effect-wide consistency patterns. The goal is to create a **stable, reusable foundation** so future effects automatically inherit these improvements.

## Key Gaps Identified

1. **Comet sparks lack per-particle size variation** — all 120 sparks are same size via `pointsMaterial`. Real comets shed sparks of varying caliber (large slow charcoal chunks + fine titanium dust).

2. **Mine column lacks ribbon trail** — real mines show a brief bright ribbon jet during the column phase. Only CometEffect uses RibbonTrail currently.

3. **ShellBurst smoke billboards use per-mesh uniforms inefficiently** — each of 16 smoke meshes gets its own clone of `smokeUniforms`, causing unnecessary GPU state changes. Should use instanced rendering or at minimum shared material.

4. **Fan/Waterfall/SparkShower/RomanCandle effects lack combustion flicker** — they use static color fading with no organic brightness variation. All spark-based effects should use `temporalFlicker` or `combustionFlicker`.

5. **No shared thermal color ramp utility** — every effect reimplements white-hot → saturated → ember → charcoal transitions inline. This should be a shared function.

6. **Comet smoke wake particles are too few and too dim** — 30 particles at 0.05 opacity is nearly invisible. Real comets leave a visible gray-brown wake.

7. **Mine ground smoke uses `pointsMaterial`** — should use the per-particle size `ShaderMaterial` already in the same file for consistency.

## Changes

### 1. `src/lib/pyroNoise.ts` — Add `thermalColorRamp()` Utility

Shared function: `thermalColorRamp(baseColor, lifeRatio, hdrBoost)` returning `{r, g, b}`. Encapsulates the white-hot → saturated → ember → charcoal transition used across all effects. Eliminates duplicated inline color math in Mine, Comet, ShellBurst, Fan, Waterfall, RomanCandle.

### 2. `src/components/editor/effects/CometEffect.tsx` — Per-Particle Size + Denser Smoke

- Replace `pointsMaterial` for sparks with the same `ShaderMaterial` pattern from MineEffect (per-particle `size` attribute via vertex shader)
- Spark seeds: add size variation (0.04–0.14 range based on hash01)
- Spark color: use `thermalColorRamp` instead of inline lerp
- Smoke wake: increase count 30→50, increase opacity 0.05→0.09, add per-particle turbulence amplitude variation
- Ribbon trail: add `opacityCurve` with brighter head (1.0→0.7→0.3→0) for more visible inner core

### 3. `src/components/editor/effects/MineEffect.tsx` — Column Ribbon + Smoke Shader

- Add short-lived `RibbonTrail` for column phase (lifetime 0.4s, 24 points, narrow width). Only active during progress 0–0.15. White-hot color fading to base color.
- Ground smoke: replace `pointsMaterial` with the existing `ShaderMaterial` (reuse the vertex/fragment shaders already defined in the file), use the `smokeSizeRef` buffer for per-particle expansion
- Use `thermalColorRamp` for all 3 particle classes instead of inline color math

### 4. `src/components/editor/effects/FanEffect.tsx` — Combustion Flicker + Thermal Ramp

- Import `temporalFlicker` and `thermalColorRamp`
- Apply per-particle flicker to color output (currently static `baseColor * rayFade`)
- Add white-hot core at particle birth (first 5% of particle life)
- Scale particle density by caliber (currently fixed 9 rays × 30 = 270)

### 5. `src/components/editor/effects/WaterfallEffect.tsx` — Flicker + Thermal

- Import `temporalFlicker` and `thermalColorRamp`
- Apply flicker per-particle using seed-based temporal noise
- Add ember-phase color transition for long-lived particles (currently only gold→fade)

### 6. `src/components/editor/effects/RomanCandleEffect.tsx` — Combustion Head + Flicker

- Import `combustionFlicker` for the main star (index 0 of each shot)
- Apply `temporalFlicker` to secondary sparks
- Main star: use `thermalColorRamp` for color evolution
- Increase trail brightness for main star segments

### 7. `src/components/editor/effects/SparkShower.tsx` — Flicker Integration

- Import `temporalFlicker`
- Apply per-particle flicker using existing seed/phase data
- Add subtle white-hot core boost at spawn time

### 8. `src/components/editor/effects/ShellBurstRenderer.tsx` — Smoke Material Optimization

- Share a single `ShaderMaterial` instance across all 16 smoke meshes (clone material once, not per-mesh uniforms)
- Add warm/cool gray variation per particle based on `seed` (warm `#776655` vs cool `#667788`)

## Files

| File | Change |
|------|--------|
| `src/lib/pyroNoise.ts` | Add `thermalColorRamp()` shared utility |
| `src/components/editor/effects/CometEffect.tsx` | Per-particle size shader, denser smoke wake, ribbon opacity curve |
| `src/components/editor/effects/MineEffect.tsx` | Column ribbon trail, ground smoke shader upgrade, thermalColorRamp |
| `src/components/editor/effects/FanEffect.tsx` | Combustion flicker, thermal ramp, caliber-scaled density |
| `src/components/editor/effects/WaterfallEffect.tsx` | Flicker + thermal color transitions |
| `src/components/editor/effects/RomanCandleEffect.tsx` | Combustion head, flicker, thermal ramp |
| `src/components/editor/effects/SparkShower.tsx` | Flicker integration |
| `src/components/editor/effects/ShellBurstRenderer.tsx` | Shared smoke material, warm/cool gray variation |

