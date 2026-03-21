

# Plan: Niagara Fluids + Weather/Atmosphere Panel + Environment v2 Integration + Time-of-Day Controls

## Summary

Integrate the existing `render_ultra` environment systems (volumetric clouds, sky atmosphere v2, water, time-of-day, ground decals) into the SkyCanvas as R3F components, create a Niagara Fluids simulation module for rain/smoke/fog, and build a unified Weather/Atmosphere panel with time-of-day controls.

## Changes

### 1. `src/render_ultra/fireworks/niagaraFluids.ts` — NEW: Niagara Fluid Simulation

A GPU-based fluid simulation module inspired by UE5.7 Niagara Fluids:
- **2D velocity field** on a grid (64x64) for smoke/fog advection
- **Density advection** with diffusion and dissipation for volumetric smoke that reacts to wind and explosions
- **Rain particle interaction**: rain drops create splashes that inject density into the fluid grid
- Exports: `createFluidGrid`, `advectFluid`, `injectDensity`, `injectVelocity`, `readDensityAt`, `applyWindForce`
- Used by NiagaraVFXController to drive smoke drift realistically and by the water system for rain ripple injection

### 2. `src/store/useSceneStore.ts` — Extend State for Environment v2

Add to `SceneSettings`:
- `cloudCoverage: number` (0-1, default 0.1)
- `cloudDensity: number` (0-2, default 0.5)  
- `cloudWindSpeed: number` (0-20, default 8)
- `waterEnabled: boolean` (default false)
- `waterLevel: number` (-5 to 5, default -0.5)
- `waterPreset: 'lake' | 'river' | 'ocean' | 'puddle'` (default 'lake')
- `timeOfDay: number` (0-24, default 21.5)
- `timeOfDayEnabled: boolean` (default false)
- `skyEngineV2: boolean` (default false — toggle between legacy SkyGradient and new SkyAtmosphereV2)
- `decalsEnabled: boolean` (default true)

### 3. `src/components/editor/SkyCanvas.tsx` — Add R3F Wrappers for render_ultra Systems

**New R3F components** (inside SkyCanvas):

- **`VolumetricCloudLayer`**: Creates cloud mesh via `createVolumetricCloudLayer()`, adds to scene via `useThree`, reads `cloudCoverage`/`cloudDensity`/`cloudWindSpeed` from store, calls `update(time)` in `useFrame`. Listens for burst events to call `flashExplosion()`.

- **`SkyAtmosphereV2Layer`**: When `skyEngineV2` is true, replaces `<SkyGradient />` with a sphere mesh created by `createSkyAtmosphereV2()`. Reads `timeOfDay` state from `evaluateTimeOfDay()` to set sun direction, colors, star brightness.

- **`WaterLayer`**: When `waterEnabled`, creates water mesh via `createWaterSystem()`, positions at `waterLevel`. Updates in `useFrame`. Receives explosion flashes from burst events.

- **`GroundDecalManager`**: Creates decal system via `createDecalSystem()`. Listens for burst events to spawn scorch marks and light splashes at impact positions. Calls `updateDecals()` each frame.

- **`TimeOfDayController`**: When `timeOfDayEnabled`, evaluates `evaluateTimeOfDay(hour)` each frame, applies results to scene lighting (ambient color/intensity, sun direction, fog color/density, sky colors). Drives `SkyAtmosphereV2Layer` and `VolumetricCloudLayer` sun parameters.

**In the JSX tree** (around line 3620):
```
{settings.skyEngineV2 ? <SkyAtmosphereV2Layer /> : <SkyGradient />}
{settings.cloudCoverage > 0 && <VolumetricCloudLayer />}
{settings.waterEnabled && <WaterLayer />}
{settings.decalsEnabled && <GroundDecalManager />}
{settings.timeOfDayEnabled && <TimeOfDayController />}
```

### 4. `src/components/editor/WeatherAtmospherePanel.tsx` — NEW: Unified Panel

A new panel combining weather data + atmosphere controls + time-of-day:

**Sections**:

- **Time of Day**: Slider 0-24h with phase label (night/dawn/golden-hour/day/sunset/twilight/blue-hour), quick preset buttons (Firework Show 21:30, Sunset 18:00, Golden Hour 6:30, Noon, Midnight), toggle to enable/disable ToD system, animate button for auto-cycling.

- **Sky Engine**: Toggle between Legacy sky and Sky Atmosphere V2. When V2 is active, show Rayleigh density and Mie anisotropy sliders.

- **Clouds**: Coverage slider (0-1), density slider (0-2), wind speed slider (0-20), cloud preset buttons (clear/scattered/overcast/dramatic/stormy from `CLOUD_PRESETS`).

- **Weather**: Existing weather condition selector + rain intensity + wind + humidity + temperature + visibility (migrated from SceneEditorPanel weather section). Add Niagara Fluid toggle for GPU-driven smoke advection.

- **Water**: Enable toggle, water level slider (-5 to 5), wave amplitude slider, water preset selector (lake/river/ocean/puddle).

- **Live Weather** (existing): GPS-based real weather fetch from WeatherPanel, compressed into this panel as a collapsible section.

### 5. `src/components/editor/SceneEditorPanel.tsx` — Simplify Weather Section

Remove the weather controls from SceneEditorPanel (they move to WeatherAtmospherePanel). Replace with a button "Open Weather & Atmosphere Panel" that opens the new panel. Keep sky/ground/effects/post-processing sections as-is.

### 6. `src/render_ultra/index.ts` — Export Niagara Fluids

Add exports for the new fluid module.

## Architecture

```text
WeatherAtmospherePanel (UI)
  ├─ Time-of-Day slider → useSceneStore.timeOfDay
  ├─ Cloud controls → useSceneStore.cloudCoverage/density/wind
  ├─ Water controls → useSceneStore.waterEnabled/level/preset
  ├─ Weather controls → useSceneStore.weather/rain/wind/humidity
  └─ Live Weather fetch → Open-Meteo API

SkyCanvas (3D)
  ├─ TimeOfDayController → evaluateTimeOfDay() → drives lighting
  ├─ SkyAtmosphereV2Layer → Rayleigh/Mie scattering sphere
  ├─ VolumetricCloudLayer → FBM raymarched cloud plane
  ├─ WaterLayer → Gerstner wave reflective plane
  ├─ GroundDecalManager → scorch marks + light splashes
  └─ NiagaraVFXController → uses niagaraFluids for smoke advection
```

## Files

| File | Change |
|------|--------|
| `src/render_ultra/fireworks/niagaraFluids.ts` | NEW — GPU fluid grid simulation |
| `src/render_ultra/index.ts` | Export niagaraFluids |
| `src/store/useSceneStore.ts` | Add cloud/water/ToD/skyV2 settings |
| `src/components/editor/SkyCanvas.tsx` | Add VolumetricCloudLayer, SkyAtmosphereV2Layer, WaterLayer, GroundDecalManager, TimeOfDayController R3F components |
| `src/components/editor/WeatherAtmospherePanel.tsx` | NEW — unified weather/atmosphere/ToD panel |
| `src/components/editor/SceneEditorPanel.tsx` | Remove weather section, add link to new panel |

