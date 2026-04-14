

# Cinema-Grade Pyro Simulation Engine — Architecture Plan

## Current State Assessment

The codebase already has significant infrastructure:
- **Ballistics**: `pyroPhysics.ts` (NFPA lookup tables, gravity, drag coefficients)
- **Chemistry**: `particleChemistry.ts` (30+ compounds with temperatures, burn rates, emission spectra)
- **Burst patterns**: `burstSimulation.ts` (20 patterns with per-family configs)
- **Smoke**: `smokeSimulation.ts` (curl noise, 6-way lighting, soft particles)
- **Rendering**: `FireworkRenderer.tsx` (1470 lines, GPU points with custom shaders)
- **LOD**: `useLOD.ts` (4-tier distance-based + adaptive FPS)
- **Exposure**: `exposure.ts` (adaptive auto-exposure with flash events)
- **Sparks/Trails**: `sparkTrailsGPU.ts`, `instancedParticleRenderer.ts`
- **Flicker**: `pyroNoise.ts` (temporal flicker, combustion flicker, strobe)
- **Seeded PRNG**: `seededRandom.ts` (Mulberry32, deterministic)
- **Fixed timestep**: `fixedTimestep.ts` (60Hz accumulator)
- **Feature flags**: `featureFlags.ts` (toggle system)

What's **missing** is the unifying energy-based simulation layer that ties these pieces together with physically coherent combustion, thermal color, layered wind, and a proper render pipeline separation.

---

## Architecture — 10 New Modules

All new files under `src/core/pyrosim/`.

### 1. `PyroSimulationCore.ts` (~200 lines)
Central orchestrator. Manages a pool of `EnergyEvent` objects. Each shell burst creates an EnergyEvent with:
```
energy_total, release_curve, release_duration, spatial_distribution,
decay_constant, ignition_jitter, turbulence_factor, smoke_yield,
ember_yield, flash_peak
```
Three release curves: `explosive` (fast exponential), `gradual` (linear-ish), `hybrid` (two-phase).
Tick method processes all active events via fixed timestep, delegates to BallisticSolver and CombustionModel.

### 2. `BallisticSolver.ts` (~180 lines)
Per-particle physics integration:
- Gravity (9.81 m/s²)
- Quadratic drag with per-particle coefficient (from DRAG_TABLE by mass/type)
- Wind sampling from WindFieldSystem at particle altitude
- Angular instability: slight random torque on heavy fragments
- Velocity-Verlet integration (more stable than Euler for stiff drag)

### 3. `ParticleStateModel.ts` (~120 lines)
Struct-of-arrays particle pool (zero-GC):
```
mass[], velocity[x,y,z], position[x,y,z], temperature[],
brightness[], lifetime[], drag_coefficient[], turbulence[],
fuel_mass[], burn_rate[], decay_curve_type[]
```
Pool allocation/recycling. No per-frame object creation.

### 4. `CombustionModel.ts` (~140 lines)
Per-particle fuel consumption:
- `fuel_mass -= burn_rate * dt`
- `brightness = f(fuel_remaining / fuel_initial)` — exponential decay, not linear
- Burn rate modulated by compound type (from `particleChemistry.ts`)
- Flicker integration from existing `pyroNoise.ts`
- No abrupt cutoff — asymptotic fade to ember glow

### 5. `ThermalColorModel.ts` (~100 lines)
Simplified blackbody radiation:
- Maps temperature (K) → RGB using Planckian locus approximation
- Temperature decreases as fuel depletes: `T = T_initial * (fuel_remaining / fuel_initial)^0.6`
- Continuous gradient: white-hot → yellow → orange → red → dark ember
- Blends with compound emission color (chemical color contribution fades as temperature drops)

### 6. `WindFieldSystem.ts` (~150 lines)
Layered wind with turbulence:
- 3 altitude layers: low (0-80m), mid (80-200m), high (200m+)
- Per-layer: direction, speed, gust variance
- Vertical shear interpolation between layers
- Micro-turbulence: curl noise perturbation per particle
- Macro drift: slow sinusoidal wind direction shift over time
- Replaces current flat wind model in FireworkBurst

### 7. `SmokeVolumeSystem.ts` (~180 lines)
Enhanced smoke extending existing `SmokeSystem`:
- Density field per puff (not just opacity)
- Residual temperature → buoyancy drives initial rise
- Expansion rate proportional to initial energy, decelerating over time
- Wind advection from WindFieldSystem
- Cluster breakup: large puffs split into sub-puffs after threshold age
- Dissipation: density decay accelerated by wind speed

### 8. `PyroRenderPipeline.ts` (~160 lines)
Layer separation config and orchestration:
- Layer 0: Emissive fire core (additive, HDR bright)
- Layer 1: Spark particles (additive, velocity-stretched)
- Layer 2: Ember trails (additive, dimmer, longer life)
- Layer 3: Smoke volume (normal blend, soft particles)
- Layer 4: Bloom/HDR (existing exposure system enhanced)
- Layer 5: Camera response (desaturation at high luminance, highlight compression)
Provides per-layer enable/disable for debug and LOD.

### 9. `PyroLODManager.ts` (~120 lines)
Extends existing `useLOD.ts` with:
- Importance scoring: caliber × recency × screen-coverage
- Per-burst LOD: big shells keep full detail, small distant ones reduce
- Particle budget: global cap (e.g., 50K particles) distributed by importance
- Screen-size culling: bursts covering <2px → skip entirely
- Explicit quality presets: Ultra (100%), High (75%), Medium (50%), Safe (25%)

### 10. `CalibrationLayer.ts` (~200 lines)
Per-family effect profiles and calibration:
- **Peony**: high star count, moderate drag, short trails, medium smoke
- **Chrysanthemum**: long trails, tip-curl via progressive drag increase
- **Willow**: extreme droop (4.5× gravity), long life, heavy charcoal drag
- **Brocade**: slow velocity, gold shimmer, high smoke yield
- **Salute**: near-zero star count, massive flash, shockwave, heavy smoke
- Each family: `{ energy_total, mass, drag, persistence, trail_behavior, smoke_yield, temporal_shape }`
- Validation metrics: rise_time, max_height, expansion_rate, brightness_curve, wind_response
- Comparison function: overlay two family profiles for visual diff

---

## Feature Flags (added to `featureFlags.ts`)

```typescript
advanced_ballistics: false,        // Velocity-Verlet + per-particle drag
thermal_color_model: false,        // Blackbody temperature→color
smoke_volume_system: false,        // Enhanced smoke with density/clusters
hdr_bloom_physical: false,         // Layer-separated bloom pipeline
cinematic_camera_response: false,  // Desaturation + highlight compression
turbulence_field: false,           // Layered wind + micro-turbulence
high_density_particles: false,     // 2× particle budget
```

All default to `false`. Existing behavior is preserved. Each flag gates its module; when disabled, the current implementation runs unchanged.

---

## Integration with SkyCanvas

**No breaking changes.** The new system is opt-in via feature flags.

- `FireworkBurst` component checks flags before using new modules
- When `advanced_ballistics` is enabled, particle update loop delegates to `BallisticSolver` instead of inline physics
- When `thermal_color_model` is enabled, color comes from `ThermalColorModel` instead of static compound color
- `WindFieldSystem` replaces flat `getWindForce()` when `turbulence_field` is on
- `SmokeVolumeSystem` extends existing `SmokeSystem` class (inheritance), gated by flag
- Camera response shader uniforms added to existing post-processing, gated by flag

Startup remains clean — no new geometry or draw calls until a shell fires.

---

## Calibration Panel

New React component: `src/components/editor/PyroCalibrationPanel.tsx` (~250 lines)

Organized by family tabs (Peony, Chrysanthemum, Willow, Brocade, Salute).
Each tab shows:
- Energy total, burst radius, drag multiplier
- Turbulence amount, smoke density, ember persistence
- Thermal falloff curve preview
- Bloom intensity, exposure response

Plus a "Validation" section showing computed metrics:
- Rise time, max height, avg velocity, expansion shape
- Wind drift, brightness persistence, smoke coherence

---

## Files to Create (10 core + 1 UI)

1. `src/core/pyrosim/PyroSimulationCore.ts`
2. `src/core/pyrosim/BallisticSolver.ts`
3. `src/core/pyrosim/ParticleStateModel.ts`
4. `src/core/pyrosim/CombustionModel.ts`
5. `src/core/pyrosim/ThermalColorModel.ts`
6. `src/core/pyrosim/WindFieldSystem.ts`
7. `src/core/pyrosim/SmokeVolumeSystem.ts`
8. `src/core/pyrosim/PyroRenderPipeline.ts`
9. `src/core/pyrosim/PyroLODManager.ts`
10. `src/core/pyrosim/CalibrationLayer.ts`
11. `src/core/pyrosim/index.ts` (barrel export)
12. `src/components/editor/PyroCalibrationPanel.tsx`

## Files to Modify

1. `src/lib/featureFlags.ts` — add 7 new flags
2. `src/components/editor/skycanvas/FireworkRenderer.tsx` — gate new modules behind flags
3. `src/components/editor/skycanvas/sharedState.tsx` — expose WindFieldSystem instance
4. `src/components/editor/skycanvas/LightingSystem.tsx` — add camera response uniforms when flag enabled

## Estimated Size

~1,800 lines of new simulation code + ~250 lines UI. Zero new dependencies.

