

# Plan: PyroJam 2026 Realism — Mines, Comets & Global Refinements

## Summary

Referencing PyroJam 2026 "Trip Through China" footage: mines show a tight **column jet** phase before the wide spray, comets have dense **incandescent trails** with smoke wake, and all effects show combustion irregularity and organic color transitions. This plan upgrades MineEffect and CometEffect to multi-phase physics, adds a combustion noise function, and refines the ShellBurstRenderer smoke system.

## Changes

### 1. `src/lib/pyroNoise.ts` — Add `combustionFlicker()`

New function with sharper, higher-frequency noise than `temporalFlicker` — models chemical combustion spikes with 5 overlapping sine waves and a burst probability component. Used by Mine column, Comet head, and muzzle flashes.

### 2. `src/components/editor/effects/MineEffect.tsx` — Multi-Phase Mine

**Replace uniform cone spray with 3 particle classes** (using the same pre-allocated buffer, differentiated by index ranges):

- **Column particles** (0–20% of count): Narrow cone (5–15° from vertical), high velocity (1.5× base), short lifetime (0.3–0.6s), white-hot → base color. These form the initial jet visible in the first 15% of progress.

- **Spray particles** (20–85% of count): Wide hemisphere (30–80°), standard velocity with ±40% lifetime jitter per particle. Individual star sizes vary 0.5×–2× base. These are the main colored stars.

- **Drip particles** (85–100% of count): Low upward velocity (3–6 m/s), high drag (0.08), fall back to ground as charcoal/titanium sparks. Orange→red→dark ember color ramp. Persist longer than spray.

**Ground smoke plume**: Add a second `<points>` cloud (40 particles, large size 1.5–4m, low opacity 0.04–0.08, normal blending, gray color) expanding radially from base. Driven by fluid grid density if available. Appears at progress 0.03, fades by 0.7.

**Star size variation**: `pointsMaterial` replaced with `ShaderMaterial` supporting per-particle size via a `size` buffer attribute (Float32Array). Column particles get 0.6× size, spray gets 0.8–1.8× randomized, drips get 1.2× with ember glow.

**Muzzle flash upgrade**: Use `combustionFlicker` for the initial flash sphere opacity to create irregular ignition pulse instead of smooth linear fade.

### 3. `src/components/editor/effects/CometEffect.tsx` — Dense GPU Trail + Smoke Wake

**GPU spark cloud** (replace 30 mesh-based sparks): Single `<points>` with 120 pre-allocated particles. Each spark has: detach time, lateral spread angle, drag, initial velocity inherited from comet head at detach moment. Zero-GC Float32Array buffers for position, color, opacity. Sparks fall with gravity + drag, fade orange→red→charcoal.

**Wider ribbon trail**: Increase `maxPoints` 64→96, `baseWidth` scaling 1.5×, add brightness multiplier for inner core glow (white-hot center fading to base color at edges using the ribbon's existing opacity/color system).

**Smoke wake**: Secondary `<points>` cloud (30 particles, size 0.8–2m, opacity 0.03–0.06, normal blending, gray `#665544`). Particles spawn along the trajectory path every ~3% progress increment, drift slowly with wind, expand, and fade over 1.5s.

**Combustion head**: Replace static sin-wave pulse (`Math.sin(progress * 40) * 0.15`) with `combustionFlicker()` for organic size/brightness pulsation. Add a colored halo ring (base color, 0.1 opacity, 2× head size) around the white core.

**Ignition flare**: First 3% of progress: bright expanding sphere (0.4→2m radius) with combustionFlicker-modulated opacity, screen blending. More aggressive than current 5% muzzle flash.

### 4. `src/components/editor/effects/ShellBurstRenderer.tsx` — Smoke Billboard Refinement

Refine the existing `smokeParticles` system (line 314):
- Increase `SMOKE_COUNT` 10→16 for denser post-burst smoke
- Add turbulence drift using `hash01` seeded per smoke particle for non-uniform expansion
- Smoke color varies per particle: warm gray (#776655) for hot bursts, cool gray (#667788) for cold sparks
- Smoke opacity modulated by `readDensityAt` from fluid grid when available

## Files

| File | Change |
|------|--------|
| `src/lib/pyroNoise.ts` | Add `combustionFlicker()` |
| `src/components/editor/effects/MineEffect.tsx` | Multi-phase column/spray/drip, ground smoke, per-particle size shader, combustion flash |
| `src/components/editor/effects/CometEffect.tsx` | GPU spark cloud, wider ribbon, smoke wake, combustion head, ignition flare |
| `src/components/editor/effects/ShellBurstRenderer.tsx` | Denser smoke with turbulence and fluid grid modulation |

