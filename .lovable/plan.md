

# Refactor: UE5.7 Virtual Worlds + VFX + Rendering Pipeline Overhaul

## Current State Assessment

The `render_ultra` engine already has strong UE5.7-inspired foundations:
- Niagara emitter system with spawn shapes, force modules, data interfaces, sub-emitters
- Volumetric clouds (raymarched FBM), Sky Atmosphere v2 (Rayleigh+Mie), Water (Gerstner waves)
- Terrain PBR, Ground Decals, Volumetric Fog, Time-of-Day
- Post-processing: SSR, SSAO, DOF, Bloom (3-layer), Heat Distortion, Sharpening, Color Grading
- Soft particles, Velocity Stretching, Ribbon Trails, Flipbook Animation
- Global Illumination (probe-based), HDR Lighting, Adaptive Exposure, Lens Flares
- Niagara Fluids (2D grid advection)

## Gaps vs UE5.7 Standard

### 1. Terrain — No procedural detail or texture layers
`terrainPBR.ts` creates a plain `MeshStandardMaterial` with a solid color. UE5.7 uses **Landscape Material** with triplanar projection, detail normal maps, and multi-layer blending. Current terrain looks flat and uniform.

### 2. Volumetric Fog — No height-based density or light scattering
Current fog is a flat plane with FBM noise. UE5.7 uses **Exponential Height Fog** with volumetric light shafts and inscattering from explosion light sources.

### 3. Clouds — No explosion-reactive lighting or 3D depth
Clouds use 2D FBM on a dome. UE5.7 has temporal reprojection and multi-octave 3D noise. Current `uExplosionFlash` uniform exists but is never driven by actual burst events.

### 4. Water — No caustics or SSR integration
Water has Gerstner waves and Fresnel but no subsurface scattering approximation or caustic patterns on nearby surfaces.

### 5. Post-Processing — Missing Motion Blur and Auto-Exposure integration
UE5.7 has per-object motion blur and camera auto-exposure built into the pipeline. Current `exposure.ts` exists but is only partially wired to PostProcessing.

### 6. Niagara — No GPU Instanced rendering for particles
All particle rendering is CPU-side with individual meshes. UE5.7 uses GPU instancing for thousands of particles efficiently.

### 7. Lighting — No Light Functions or IES Profiles
HDR rig is static. UE5.7 supports light cookies/IES profiles for realistic light distribution from stage fixtures.

## Plan — Priority Changes (Impact vs Effort)

### Phase 1: Terrain PBR v2 — Triplanar + Detail Texturing
**File**: `src/render_ultra/environment/terrainPBR.ts`
- Replace `MeshStandardMaterial` with custom `ShaderMaterial` using triplanar UV projection
- Add procedural detail normal map (FBM-based micro-bumps)
- Multi-layer blending: base (grass/concrete) + detail (gravel/moss) with slope-based mixing
- Add 6 new presets: `beach-sand`, `gravel`, `snow`, `mud`, `rocky`, `festival-ground`
- Wetness now produces real specular puddles with animated ripple noise

### Phase 2: Exponential Height Fog v2
**File**: `src/render_ultra/environment/volumetricFog.ts`
- Replace flat plane fog with **Exponential Height Fog** using volumetric raymarching
- Height-based density falloff (configurable `fogHeightFalloff`)
- Inscattering from sun direction (light shafts through fog)
- Explosion flash scattering (burst light illuminates nearby fog volumes)
- Wind-driven fog drift (synced to scene wind)
- Add `FogConfig` type: `{ density, heightFalloff, inscatteringColor, inscatteringIntensity, maxOpacity, startDistance }`

### Phase 3: Cloud v2 — Explosion-Reactive + Temporal
**File**: `src/render_ultra/environment/volumetricClouds.ts`
- Wire `uExplosionFlash` and `uExplosionColor` uniforms to actual burst events via NiagaraVFXController
- Add temporal smoothing for cloud lighting (flash in → decay out over 0.5s)
- Improve noise: add Worley noise layer for more natural cloud edges
- Add `uCloudThickness` uniform for parallax depth illusion
- New preset: `storm` (dark, low, turbulent) for dramatic shows

### Phase 4: GPU Instanced Particle Rendering
**File**: `src/render_ultra/fireworks/instancedParticleRenderer.ts` (NEW)
- Create `InstancedParticleRenderer` class using `THREE.InstancedMesh` + `THREE.InstancedBufferGeometry`
- Write particle state to instance matrices + color attributes each frame
- Support velocity stretching via custom vertex shader on instances
- Budget: 4096 particles per instanced batch vs current per-mesh approach
- Wire into `NiagaraVFXController` as the primary render path

### Phase 5: Post-Processing Pipeline v2
**File**: `src/components/editor/PostProcessing.tsx`
- Add per-object motion blur effect (velocity buffer based)
- Wire adaptive exposure from `exposure.ts` into ToneMapping — auto-darken during dense salvos, recover in quiet periods
- Add `ColorLUT` effect for cinematic color grading presets (Day-for-Night, Warm Golden Hour, Cool Blue Night)
- Add God Rays as a separate radial blur pass (not just bloom)

### Phase 6: Lighting v2 — Light Functions + Dynamic Shadows
**File**: `src/render_ultra/lighting/hdrLighting.ts`
- Add IES profile support via `THREE.SpotLight` with cookie textures
- Per-burst point light spawning with physics-based falloff (inverse square)
- Burst lights cast dynamic shadows onto terrain + structures
- Light color inherits from chemical compound (`particleChemistry`)

### Phase 7: Terrain Renderer Integration
**File**: `src/components/editor/TerrainRenderer.tsx`
- Replace `createTerrainMaterial` call with new triplanar shader material
- Pass wind/time uniforms for animated grass/ripple detail
- Connect wetness to weather system for dynamic puddles

## Files Summary

| File | Change |
|------|--------|
| `src/render_ultra/environment/terrainPBR.ts` | Triplanar ShaderMaterial, detail normals, 6 new presets |
| `src/render_ultra/environment/volumetricFog.ts` | Exponential height fog, inscattering, explosion reactivity |
| `src/render_ultra/environment/volumetricClouds.ts` | Worley noise, explosion flash wiring, storm preset |
| `src/render_ultra/fireworks/instancedParticleRenderer.ts` | NEW — GPU instanced particle renderer |
| `src/components/editor/PostProcessing.tsx` | Motion blur, auto-exposure wiring, Color LUT, God Rays |
| `src/render_ultra/lighting/hdrLighting.ts` | IES profiles, per-burst dynamic point lights |
| `src/components/editor/TerrainRenderer.tsx` | Wire new terrain shader, animated detail |
| `src/components/editor/NiagaraVFXController.tsx` | Wire cloud flash uniforms, instanced renderer |
| `src/render_ultra/environment/waterRendering.ts` | Caustic pattern overlay, subsurface approximation |
| `src/render_ultra/index.ts` | Export new modules |

