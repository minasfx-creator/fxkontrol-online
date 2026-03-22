

# Refactor: Wire UE5.7 Render Systems into Live Pipeline

## Problem

The `render_ultra` engine has all the UE5.7-grade modules built but **they're not connected**. Three critical systems exist in isolation:

1. **GPU Instanced Renderer** — `InstancedParticleRenderer` is exported but NiagaraVFXController still uses `THREE.Points` with CPU buffer writes
2. **Dynamic Burst Lights** — `spawnBurstLight` in `hdrLighting.ts` is never called from any burst event
3. **Cloud/Fog Explosion Flash** — `flashExplosion` on volumetric clouds and fog is never triggered by bursts
4. **HDR Lighting Rig** — `createHDRLightingRig` is exported but never instantiated in SkyCanvas

These are integration wires, not new features. The modules work — they just need to be plugged in.

## Changes

### 1. `NiagaraVFXController.tsx` — Replace Points with InstancedParticleRenderer

Replace the manual `THREE.Points` + `writeParticlesToBuffers` approach with the GPU instanced path:
- Import `createSparkInstancedRenderer`, `createSmokeInstancedRenderer` from render_ultra
- Create instanced renderers in `useMemo`, add their `.mesh` to scene
- In `useFrame`, collect particles into the `writeParticles()` API with camera for billboarding
- Remove the old `createNiagaraBuffers`, `sparkBuffers`, `smokeBuffers`, `NIAGARA_SPARK_VERTEX/FRAGMENT` shader code
- This gives velocity stretching on GPU and supports 4096 particles per batch

### 2. `NiagaraVFXController.tsx` — Wire Burst Lights

When spawning a new burst system:
- Access the HDR lighting rig (via ref or scene lookup)
- Call `spawnBurstLight(burstPos, burstColor, caliber * 2.5, 1.0 + caliber * 0.15)`
- Call `updateBurstLights(dt)` every frame

### 3. `NiagaraVFXController.tsx` — Wire Cloud/Fog Flash

When spawning a new burst:
- Find volumetric cloud and fog materials in scene (via refs or window global)
- Call `flashExplosion(burstColor, caliber * 0.3, burstPos)` on both cloud and fog systems
- This makes clouds and fog react to explosions with light scattering

### 4. `SkyCanvas.tsx` — Instantiate HDR Lighting Rig

- Import `createHDRLightingRig` from render_ultra
- Create the rig in a `useMemo` and add group to scene
- Pass rig ref to NiagaraVFXController via props or context
- Call `updateBurstLights(dt)` in the NiagaraVFXController frame loop

### 5. `SkyCanvas.tsx` — Wire Cloud/Fog refs to NiagaraVFXController

- Store refs to volumetric cloud and fog systems
- Pass `flashExplosion` callbacks to NiagaraVFXController
- NiagaraVFXController calls them on burst spawn

## Files

| File | Change |
|------|--------|
| `src/components/editor/NiagaraVFXController.tsx` | Replace Points with InstancedParticleRenderer; wire burst lights and cloud/fog flash |
| `src/components/editor/SkyCanvas.tsx` | Instantiate HDR lighting rig; pass flash callbacks to VFX controller |

