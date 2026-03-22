

# UE5.7 Render Pipeline — Final Integration Pass

## Current State

The `render_ultra` engine is already 90%+ complete with UE5.7 parity:
- Niagara emitter system with GPU instancing, sub-emitters, force modules ✅
- Volumetric clouds, sky atmosphere v2, water (Gerstner), terrain PBR (triplanar) ✅
- Explosion-reactive clouds/fog, dynamic burst lights, adaptive exposure ✅
- SSR, SSAO, DOF, Bloom (3-layer), Heat Distortion, Sharpening ✅
- Ribbon trails, flipbook animation, soft particles, velocity stretching ✅
- Ground decals, GI probes, lens flares, Niagara fluids ✅

## Remaining Gaps vs UE5.7

| Gap | Impact |
|-----|--------|
| No **Motion Blur** (per-object velocity-based) | Fast-moving sparks/shells look static |
| **God Rays** faked via bloom, not proper radial blur | No volumetric light shaft directionality |
| No **Color LUT** presets | No cinematic grading (Day-for-Night, Golden Hour) |
| **GI probes** not wired to burst events | GI system exists but only driven by SkyCanvas, not VFX controller |
| **Ground decals** not triggered by bursts | `spawnScorchMark` imported but never called on impact |

## Changes

### 1. `PostProcessing.tsx` — Add Motion Blur + God Rays + Color LUT

**Motion Blur**: Custom `Effect` class using velocity-based screen-space blur. Uses per-pixel motion vector estimation from frame delta to simulate UE5's `MotionBlurAmount`. Controlled by `settings.motionBlurEnabled` and `settings.motionBlurIntensity`.

**God Rays (Radial Blur)**: Replace the fake bloom Layer 3 with a proper radial blur `Effect` that samples toward a configurable sun/explosion source point. This produces directional light shafts instead of uniform bloom glow.

**Color LUT**: Add a `ColorGradingEffect` with 6 presets: `neutral`, `day-for-night`, `golden-hour`, `cool-blue-night`, `warm-sunset`, `high-contrast`. Uses a 3D color transform in the fragment shader (no texture needed). Controlled by `settings.colorGradingPreset`.

### 2. `useSceneStore.ts` — Add settings for new effects

Add to `SceneSettings`:
- `motionBlurEnabled: boolean` (default `false`)
- `motionBlurIntensity: number` (default `0.5`)
- `colorGradingPreset: string` (default `'neutral'`)

### 3. `SceneEditorPanel.tsx` — UI controls for new effects

Add controls in the Post-Processing section:
- Motion Blur toggle + intensity slider
- Color Grading preset dropdown
- God Rays toggle already exists — will now use the real radial blur

### 4. `NiagaraVFXController.tsx` — Wire GI probes + ground decals

On burst spawn:
- Call `GlobalIlluminationSystem.addExplosionProbe(burstPos, burstColor, caliber * 1.5)` via window ref
- Call `spawnScorchMark(burstPos, caliber * 2)` for ground impact marks
- Call `spawnLightSplash(burstPos, burstColor, caliber * 3)` for temporary light decals

### 5. `SkyCanvas.tsx` — Expose GI system globally

Expose `GlobalIlluminationSystem` instance via `window.__giSystem` so NiagaraVFXController can register explosion probes directly.

## Files

| File | Change |
|------|--------|
| `src/components/editor/PostProcessing.tsx` | Motion Blur effect, Radial God Rays effect, Color LUT effect |
| `src/store/useSceneStore.ts` | Add motionBlur, colorGrading settings |
| `src/components/editor/SceneEditorPanel.tsx` | UI for motion blur + color grading |
| `src/components/editor/NiagaraVFXController.tsx` | Wire GI probes + ground decals on burst |
| `src/components/editor/SkyCanvas.tsx` | Expose GI system globally |

