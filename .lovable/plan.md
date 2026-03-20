

# Plan: Maximum Performance Optimization

## Analysis

After reviewing the full 4070-line `SkyCanvas.tsx`, all rendering systems, LOD, pools, and scene store, I identified several performance bottlenecks and optimization opportunities.

## Critical Issues Found

### 1. Sky Sphere — 64x64 segments is excessive
The `SkyGradient` uses `sphereGeometry args={[90000, 64, 64]}` — that's 8192 vertices for a shader-only background. Since all color comes from the fragment shader, 32x16 is more than sufficient.

### 2. Moon — multiple overlapping spheres with expensive shaders
4 nested meshes (body 64x64, inner glow 32x32, halo 32x32, scatter 16x16) plus a `pointLight`. The body shader has redundant `noise()` calls. The scatter sphere (1600 radius, 16x16) adds draw calls for nearly invisible effect.

### 3. Ground plane — 100000x100000 with 16x16 subdivisions
`FinaleDarkGround`, `GrassGround`, and `GroundFog` all create enormous planes (`100000x100000`). The ground fog shader runs a 4-octave FBM on every pixel. These should use `1, 1` subdivisions (flat plane needs no subdivisions).

### 4. TreelineSilhouette — creates 500+ individual `<mesh>` elements
Each tree is a separate React element with its own material. This creates 500+ draw calls. Should use `InstancedMesh`.

### 5. SFXStageEnvironment — 40+ individual meshes
Truss bars, LED panels, moving heads — each is a separate `<mesh>` with separate material. Many could share materials or use InstancedMesh.

### 6. GroundReflections — runs timeline scan every frame
The `useFrame` loop iterates `timelineItems` every frame to check for explosion flashes, creating `new THREE.Color()` per burst found — GC pressure.

### 7. GI/Smoke/Flare Controllers — all scan timeline every frame
Three separate controllers (`GlobalIlluminationController`, `SmokeController`, `LensFlareController`) each independently iterate `timelineItems` and call `EFFECT_LIBRARY.find()` every frame. Should consolidate into one scan.

### 8. SparkTrailController — creates `new THREE.Vector3()` per spark per frame
Line 2269 creates `new Color()` per spark per frame. Line 2243-2248 creates `new THREE.Vector3()` per spawn. These should use pre-allocated objects.

### 9. Vite config — no build optimizations
No tree-shaking hints, no chunk splitting, no dependency optimization.

### 10. FloorLogo — 4096x1024 canvas texture on every mount
Creates a huge canvas texture every mount. Should be smaller (2048x512 is plenty) and the texture should use power-of-2 dimensions.

### 11. AtmosphericParticles — 200 particles with per-frame Math.sin/cos per particle
Minor but runs 200 trig calls per frame. Could be simplified.

### 12. PostProcessing — SSR + SSAO + DOF + multiple Bloom layers simultaneously
Default settings enable too many expensive effects. The `performance` preset is already defined but not auto-applied.

## Changes

### `vite.config.ts`
- Add `build.rollupOptions.output.manualChunks` to split Three.js and postprocessing into separate chunks
- Add `optimizeDeps.include` for Three.js
- Set `build.target: 'esnext'` for modern JS output

### `src/components/editor/SkyCanvas.tsx`

**A. Sky sphere segments**: `[90000, 64, 64]` → `[90000, 32, 16]`

**B. Moon optimization**: Remove outer scatter sphere (opacity 0.008 = invisible). Reduce body to `[450, 32, 32]`. Remove inner glow sphere. Reduce halo to `[800, 16, 16]`.

**C. Ground planes**: Change all `planeGeometry args={[100000, 100000, 16, 16]}` to `args={[100000, 100000, 1, 1]}` — flat planes don't need subdivisions.

**D. TreelineSilhouette**: Replace 500+ individual `<mesh>` with a single `InstancedMesh`. Pre-compute matrix and color per instance in `useMemo`.

**E. Consolidate timeline scan**: Create a single `ActiveBurstScanner` component that runs once per frame and writes results to a shared ref. Remove duplicate scans from GroundReflections, GI, Smoke, Flare, and SparkTrail controllers.

**F. Pre-allocate objects in GroundReflections**: Replace `new THREE.Color(effect.color)` with a reusable pre-allocated color.

**G. Pre-allocate objects in SparkTrailController**: Replace per-spawn `new THREE.Vector3()` with pooled vectors. Replace per-frame `new Color()` with reusable.

**H. FloorLogo texture**: Reduce canvas to `2048x512`. Add `tex.generateMipmaps = false` and `tex.minFilter = THREE.LinearFilter`.

**I. AtmosphericParticles**: Reduce count from 200 to 100.

**J. ContactShadows resolution**: Only render when `groundStyle !== 'flat-black'`.

### `src/store/useSceneStore.ts`

**K. Optimize default settings for better baseline performance**:
- Default `particleDensity`: `1.2` → `1.0`
- Default `bloomStrength`: `1.4` → `1.1`
- Default `groundFogIntensity`: `0.6` → `0.4`
- Default `shadowQuality`: `'high'` → `'medium'` (4096→2048 shadow map)
- Default `ssaoEnabled`: already false by default (good)
- Disable `contactShadowsEnabled` by default
- Lower `starDensity`: `1.3` → `1.0`

### `src/lib/niagaraBlenderRules.ts`

**L. Tighten Niagara budgets**:
- Desktop `maxConcurrentBursts`: `6` → `5`
- Desktop `maxStarBudget`: `1400` → `1200`
- Mobile `maxStarBudget`: `420` → `350`

### `src/hooks/useLOD.ts`

**M. Tune adaptive LOD thresholds**:
- `FPS_DROP_THRESHOLD`: `30` → `35` (trigger quality drop sooner)
- `FPS_RAISE_THRESHOLD`: `55` → `50` (recover sooner too)
- `FPS_DROP_DURATION`: `500` → `400` (react faster)

## Files Summary

| File | Change |
|------|--------|
| `vite.config.ts` | Build optimizations, chunk splitting |
| `SkyCanvas.tsx` | Sky segments, Moon cleanup, ground subdivisions, TreelineInstanced, consolidate timeline scans, pre-allocate GC-heavy objects, FloorLogo optimization |
| `useSceneStore.ts` | Lower default quality settings for better baseline perf |
| `niagaraBlenderRules.ts` | Tighter particle budgets |
| `useLOD.ts` | More responsive adaptive thresholds |

