

# Plan: Calibrate Platform — Maximize Existing Technology Usage

## Summary

Connect 6 unused `render_ultra` modules to the scene pipeline and wire 3 disconnected engine→UI integrations. No new features — just connecting existing code that was built but never plugged in.

## Problems Found

### Unused render_ultra Modules (built, exported, never imported)
1. **`render_ultra/environment/volumetricFog.ts`** — Full shader with FBM noise, height fade, animation. SkyCanvas has an inline GroundFog with simpler version of same shader, ignoring the render_ultra implementation
2. **`render_ultra/environment/atmosphereScattering.ts`** — Rayleigh sky sphere with explosion light scatter uniforms. SkyCanvas has inline SkyGradient that duplicates this but lacks the `uLightScatter` reactivity
3. **`render_ultra/environment/terrainPBR.ts`** — PBR terrain materials (grass, concrete, wet, sand presets). TerrainRenderer uses basic `meshStandardMaterial` with hardcoded colors instead
4. **`render_ultra/environment/reflections.ts`** — Wet-look ground reflection shader. SkyCanvas has inline GroundReflections that partially duplicates this
5. **`render_ultra/drones/propellerMotionBlur.ts`** — Motion blur disc rig for quadcopters. InstancedDroneSwarm creates its own rotor discs manually instead of using this
6. **`render_ultra/drones/droneLights.ts`** — LED halo sprites + nav light rig with HDR emission. InstancedDroneSwarm doesn't use LED halos or nav lights from this module

### Disconnected Engine → UI
7. **`reportEngine.ts`** — ReportsPanel imports it correctly, but is the ONLY consumer; the auto-save system doesn't persist report snapshots
8. **`lightProgramEngine.ts`** — LightProgramPanel imports it, but the drone programs are never sent to InstancedDroneSwarm for live color preview during playback
9. **`generativeEngine.ts`** — GenerativeEffectsPanel renders to a small canvas preview but the pixel map output is never bridged to the DMX engine for actual fixture output

## Changes

### 1. `src/components/editor/SkyCanvas.tsx` — Wire render_ultra environment modules

- **Replace inline GroundFog** with `createVolumetricFogPlane()` from `render_ultra/environment/volumetricFog`; connect `uTime` via useFrame. Saves ~80 lines of duplicated shader code
- **Replace inline SkyGradient shader** with `createAtmosphereSphere()` from `render_ultra/environment/atmosphereScattering`; wire `uLightScatter` + `uScatterIntensity` to the existing `_skyScatterUniforms` system so explosions properly tint the atmosphere
- **Wire GroundReflections** to use `createReflectionPlane()` from `render_ultra/environment/reflections` instead of inline shader, gaining the wet-look specular calculation

### 2. `src/components/editor/TerrainRenderer.tsx` — Use PBR terrain materials

- Import `createTerrainMaterial` and `getTerrainPresets` from `render_ultra/environment/terrainPBR`
- Replace hardcoded `meshStandardMaterial` with `createTerrainMaterial(preset)` based on scene settings
- Add terrain preset selection to SceneEditorPanel (grass-field, concrete, wet, sand)

### 3. `src/components/editor/InstancedDroneSwarm.tsx` — Connect drone render modules

- Import `createDroneLightRig` from `render_ultra/drones/droneLights` for nav light colors/positions (use as instanced data, not full Group — keep InstancedMesh pattern)
- Import nav light color constants from `droneLights.ts` and apply to the existing navRef instanced mesh
- Wire `lightProgramEngine` colors: accept an optional `lightPrograms` prop; when provided, evaluate `evaluateLightProgram()` per drone at current time and override LED emissive colors

### 4. `src/components/editor/SceneEditorPanel.tsx` — Expose terrain preset selector

- Add dropdown for terrain material preset (grass-field, concrete, wet, sand) from `getTerrainPresets()`
- Store selection in `useSceneStore`

### 5. `src/store/useSceneStore.ts` — Add terrain preset field

- Add `terrainPreset: string` to scene settings with default `'grass-field'`

### 6. `src/components/editor/GenerativeEffectsPanel.tsx` — Bridge to DMX output

- When `viewportLinked` is true AND DMX engine is active, pipe `renderGenerativeFrame()` output colors to DMX universe channels via `dmxEngine.setChannelValues()`
- Import `dmxEngine` and bridge the existing pixel array to DMX channels (RGB per fixture, starting at channel 1)

## Files Summary

| File | Change |
|------|--------|
| `src/components/editor/SkyCanvas.tsx` | Replace inline GroundFog/SkyGradient/Reflections with render_ultra module calls |
| `src/components/editor/TerrainRenderer.tsx` | Use `createTerrainMaterial(preset)` from render_ultra |
| `src/components/editor/InstancedDroneSwarm.tsx` | Wire nav light constants from droneLights + accept light program colors |
| `src/components/editor/SceneEditorPanel.tsx` | Add terrain preset dropdown |
| `src/store/useSceneStore.ts` | Add `terrainPreset` field |
| `src/components/editor/GenerativeEffectsPanel.tsx` | Bridge generative output to DMX channels |

