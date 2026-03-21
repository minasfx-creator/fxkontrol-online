

# Plan: Complete Niagara Integration — Replace Legacy Controllers + Wire Advanced Modules

## Summary

The Niagara modules are built but underutilized. Currently:
- `NiagaraVFXController` runs **alongside** legacy `SmokeController` and `SparkTrailController` — producing duplicate particles
- The ribbon renderer, flipbook animator, and soft particle shaders are created but **never imported or used**
- Individual effect components (CometEffect, GerbEffect, etc.) still use hand-rolled particle logic instead of composable Niagara emitters

This plan fully replaces legacy controllers, wires advanced rendering modules into the VFX controller, and migrates key effect components to use Niagara emitters.

## Changes

### 1. `src/components/editor/SkyCanvas.tsx` — Remove Legacy Controllers

- **Remove** `SmokeController` component (lines ~2070-2111) — Niagara handles smoke via SmokeEmitter
- **Remove** `SparkTrailController` component (lines ~2164-2254) — Niagara handles sparks via SparkEmitter
- Remove their JSX usage at lines 3748-3750 (keep only `<NiagaraVFXController />`)
- Remove unused imports: `createSparkTrailSystem`, `updateSparkTrail`, `writeSparkTrailsToBuffers`, `SparkState`, `SmokeSystem`
- Keep `LensFlareController` (complementary, not duplicate)

### 2. `src/components/editor/NiagaraVFXController.tsx` — Wire Advanced Modules

Enhance the controller with the unused Niagara modules:

**Soft Particles**: Import `createSoftParticleMaterial` from `softParticleShader.ts` and use it for the smoke pass instead of the basic `NIAGARA_SMOKE_VERTEX/FRAGMENT` shaders. This adds depth-fade blending.

**Ribbon Trails**: Import `RibbonTrail`, `createRibbonTrail`, `updateRibbon`, `buildRibbonGeometry` from `ribbonTrailRenderer.ts`. Add a `RibbonEmitter` template for comet-type effects — when a burst pattern is `'comet'` or `'willow'`, attach a ribbon trail to trailing particles.

**Flipbook Smoke**: Import `getFlipbookUV`, `SMOKE_4x4_PRESET` from `flipbookAnimator.ts`. Apply flipbook UV animation to smoke particles for more varied smoke puffs (pass frame index as a custom attribute).

**Heat Distortion Emitter**: Add optional `HeatHazeEmitter` template using `createDistortionMaterial` from `heatDistortion.ts`. Spawn distortion-only particles at burst center for large caliber (6"+) shells, fading over 2 seconds.

**Sub-Emitters**: Wire up the existing `SubEmitterConfig` — when spark particles die, spawn small ember sub-emitters (already supported in the system, just not configured in templates).

**Chemical Colors**: Use `thermalColor` and `getCompound` for temperature-based color evolution in spark particles instead of static `colorOverLife` gradients.

### 3. `src/components/editor/effects/CometEffect.tsx` — Migrate to Niagara Ribbon

Replace the hand-rolled trail logic with:
- Create a `NiagaraSystem` with a cone-spawn spark emitter + ribbon trail emitter
- Use `RibbonTrail` from `ribbonTrailRenderer.ts` for the comet tail
- Keep the same props interface (`position`, `color`, `progress`, `caliber`)
- Eliminates ~200 lines of manual buffer management

### 4. `src/components/editor/effects/GerbEffect.tsx` — Migrate to Niagara Emitter

Replace hand-rolled particle arrays with:
- Create a `NiagaraSystem` with a cone-spawn emitter (upward, narrow angle)
- Add `CollisionModule` for ground bounce
- Use `createWind` for lateral drift
- Keep same props interface

### 5. `src/components/editor/effects/SmokeTrail.tsx` — Use Niagara Smoke Emitter

Replace manual smoke with a Niagara smoke emitter template:
- Soft particle rendering via `softParticleShader`
- Curl noise turbulence from `UpdateConfig.curlNoiseStrength`
- Negative gravity for rising smoke

## Architecture After Changes

```text
SkyCanvas
  ├─ NiagaraVFXController (central, handles all burst VFX)
  │    ├─ SparkEmitter (soft particles + velocity stretch)
  │    ├─ SmokeEmitter (flipbook + soft particles + curl noise)
  │    ├─ EmberEmitter (collision + sub-emitter on death)
  │    ├─ RibbonEmitter (for willow/comet patterns)
  │    └─ HeatHazeEmitter (distortion, caliber ≥ 6)
  │
  ├─ CometEffect → NiagaraSystem (cone spawn + ribbon trail)
  ├─ GerbEffect → NiagaraSystem (cone spawn + collision)
  ├─ SmokeTrail → NiagaraSystem (smoke emitter)
  │
  ├─ LensFlareController (kept — complementary)
  └─ [other effects unchanged for now]
```

## Files

| File | Change |
|------|--------|
| `src/components/editor/SkyCanvas.tsx` | Remove SmokeController, SparkTrailController, and their unused imports |
| `src/components/editor/NiagaraVFXController.tsx` | Wire soft particles, ribbons, flipbook, heat haze, sub-emitters, thermal colors |
| `src/components/editor/effects/CometEffect.tsx` | Migrate to Niagara system with ribbon trail |
| `src/components/editor/effects/GerbEffect.tsx` | Migrate to Niagara system with collision |
| `src/components/editor/effects/SmokeTrail.tsx` | Migrate to Niagara smoke emitter |

