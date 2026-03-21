

# Plan: Integrate render_ultra Pipeline into All Effects

## Summary

Most effects (Mine, Waterfall, SparkShower, RomanCandle, Fan, Tourbillon, Wheel, MultiBurst, Flame, CryoJet, Fog, Haze, Confetti, Bengal, Saxon, SetPiece, FirecrackerString, ParachuteFlare, Rocket, SnowMachine, BubbleMachine) still use raw THREE.js particle systems with manual physics. Only GerbEffect, CometEffect, and ShellBurstRenderer currently use `render_ultra` modules (NiagaraEmitterSystem, RibbonTrail, particleChemistry).

This plan upgrades the remaining effects to use render_ultra's composable Niagara pipeline: emitter systems with force modules, soft-particle depth-fade, velocity stretching, ribbon trails, heat distortion, and fluid grid integration.

## Architecture

```text
render_ultra modules used per effect:
┌─────────────────────┬──────────┬──────────┬────────┬──────┬───────┐
│ Effect              │ Emitter  │ Ribbon   │ Soft   │ Heat │ Fluid │
│                     │ System   │ Trail    │ Part.  │ Dist │ Grid  │
├─────────────────────┼──────────┼──────────┼────────┼──────┼───────┤
│ GerbEffect ✓        │ ✓        │          │        │      │       │
│ CometEffect ✓       │          │ ✓        │        │      │       │
│ ShellBurstRenderer ✓│          │          │        │      │       │
│ MineEffect          │ ✓ NEW    │          │ ✓ NEW  │      │ ✓ NEW │
│ WaterfallEffect     │ ✓ NEW    │          │        │      │       │
│ SparkShower         │ ✓ NEW    │          │        │      │       │
│ RomanCandleEffect   │ ✓ NEW    │ ✓ NEW    │        │      │       │
│ FanEffect           │ ✓ NEW    │          │        │      │       │
│ MultiBurstEffect    │ ✓ NEW    │          │        │      │       │
│ FlameEffect         │          │          │ ✓ NEW  │ ✓NEW │       │
│ SaluteEffect        │          │          │        │ ✓NEW │ ✓ NEW │
│ CryoJetEffect       │ ✓ NEW    │          │ ✓ NEW  │      │       │
│ TourbillonEffect    │ ✓ NEW    │ ✓ NEW    │        │      │       │
│ WheelEffect         │ ✓ NEW    │ ✓ NEW    │        │      │       │
│ FogMachineEffect    │          │          │ ✓ NEW  │      │ ✓ NEW │
│ HazeMachineEffect   │          │          │ ✓ NEW  │      │ ✓ NEW │
│ FireworkBurst (Sky) │          │          │ ✓ NEW  │      │       │
└─────────────────────┴──────────┴──────────┴────────┴──────┴───────┘
```

## Changes

### 1. Pyro Effects → NiagaraEmitterSystem (6 files)

**MineEffect.tsx**: Replace manual velocity arrays with `createEmitter` using cone spawn shape (30-60° from vertical), collision module for ground bounce, wind force module from store. Inject density into NiagaraFluids grid on burst for smoke advection.

**WaterfallEffect.tsx**: Replace manual seed loop with `createEmitter` using box spawn shape (width × thin), downward velocity with gravity, collision module. Keeps zero-GC buffer strategy but physics computed by NiagaraSystem.

**SparkShower.tsx**: Replace manual cycling with `createEmitter` using sphere spawn, high spawn rate, short lifetime. Add wind force module.

**RomanCandleEffect.tsx**: Replace manual shot timing with `createSystem` containing one emitter per shot with `burstDelay`. Add `RibbonTrail` for each star's comet trail.

**FanEffect.tsx**: Replace manual ray calculation with `createSystem` containing one emitter per ray, each with different cone angle within the spread. Uses burst spawn mode.

**MultiBurstEffect.tsx**: Replace MiniBurst function with `createSystem` using multiple emitters at staggered delays and different positions.

### 2. Specialty Effects → Ribbon + Heat (3 files)

**TourbillonEffect.tsx**: Add `RibbonTrail` for the helical spark trail (like CometEffect). Replace manual trail buffer with ribbon renderer. Add wind force module.

**WheelEffect.tsx**: Add `RibbonTrail` per arm for trailing spark arcs. Each arm gets its own ribbon instance managed in a ref array.

**FlameEffect.tsx**: Add `HeatHazeEmitter` from heatDistortion.ts for realistic heat shimmer above the flame column. Replace the basic cylinderGeometry heat mesh with proper distortion particles.

### 3. Atmospheric Effects → Soft Particles + Fluid Grid (4 files)

**CryoJetEffect.tsx**: Convert main column and ground fog to use `createSoftParticleMaterial` for depth-fade against terrain/objects. Add `createEmitter` for the column particles with collision module.

**FogMachineEffect.tsx**: Replace manual puff meshes with soft-particle point cloud using `createSmokeSoftMaterial`. Connect to `niagaraFluids` grid — read density field to modulate puff positions/opacity (fog follows fluid advection).

**HazeMachineEffect.tsx**: Replace PointsMaterial with `createSmokeSoftMaterial` for depth-aware blending. Read wind from fluid grid via `readDensityAt` for drift coherence.

**SaluteEffect.tsx**: Add `HeatHazeEmitter` for post-detonation heat shimmer. Inject temperature + density into fluid grid on flash for realistic smoke plume advection.

### 4. FireworkBurst (SkyCanvas) → Soft Particles (1 file)

**SkyCanvas.tsx** (FireworkBurst component ~line 264): Replace `PointsMaterial` with custom shader that includes soft-particle depth fade uniform. Import `updateSoftParticleUniforms` and call in useFrame to pass depth texture.

### 5. Shared: Fluid Grid Event Bus

**NiagaraVFXController.tsx**: Add fluid grid instance (`createFluidGrid`). On burst events, call `injectDensity` + `injectTemperature` at burst position. Call `advectFluid` each frame. Expose grid via `window.__niagaraFluidGrid` for effects to read.

Effects that need fluid (Fog, Haze, Salute, Mine) read from the shared grid via `readDensityAt` to modulate their particles.

## Files

| File | Change |
|------|--------|
| `src/components/editor/effects/MineEffect.tsx` | NiagaraEmitter + collision + wind + fluid inject |
| `src/components/editor/effects/WaterfallEffect.tsx` | NiagaraEmitter + collision |
| `src/components/editor/effects/SparkShower.tsx` | NiagaraEmitter + wind |
| `src/components/editor/effects/RomanCandleEffect.tsx` | NiagaraSystem multi-emitter + RibbonTrail |
| `src/components/editor/effects/FanEffect.tsx` | NiagaraSystem multi-emitter |
| `src/components/editor/effects/MultiBurstEffect.tsx` | NiagaraSystem staggered emitters |
| `src/components/editor/effects/TourbillonEffect.tsx` | RibbonTrail + wind |
| `src/components/editor/effects/WheelEffect.tsx` | RibbonTrail per arm |
| `src/components/editor/effects/FlameEffect.tsx` | HeatHazeEmitter |
| `src/components/editor/effects/SaluteEffect.tsx` | HeatHazeEmitter + fluid inject |
| `src/components/editor/effects/CryoJetEffect.tsx` | NiagaraEmitter + softParticleMaterial |
| `src/components/editor/effects/FogMachineEffect.tsx` | softParticleMaterial + fluid read |
| `src/components/editor/effects/HazeMachineEffect.tsx` | softParticleMaterial + fluid read |
| `src/components/editor/SkyCanvas.tsx` | FireworkBurst soft-particle depth fade |
| `src/components/editor/NiagaraVFXController.tsx` | Shared fluid grid instance + advection loop |

