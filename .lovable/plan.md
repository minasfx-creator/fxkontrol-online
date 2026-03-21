

# Plan: Ultra-Realistic Rendering Refinements — Niagara/UE5 Techniques

## Summary

Upgrade the particle effects pipeline with Niagara-inspired techniques: GPU instanced sprites with proper soft-particle depth, volumetric smoke billboards, heat distortion, per-particle size attenuation curves, and fix critical per-frame GC allocations in 5 effects.

## Current State

The rendering pipeline is already strong — custom GLSL shaders in ShellBurstRenderer, thermal color gradients, Niagara blend modes, chemical compound simulation. But several effects still use basic `pointsMaterial` with flat circles, and 5 effects allocate `new Float32Array()` every frame inside `useFrame` (GC pressure causing micro-stutters).

## Close Button Verification

VirtualControllerHub and FieldMap2D already have `onClose` props implemented and wired in Index.tsx (lines 375-376). These are working correctly.

## Changes

### 1. Fix Per-Frame GC Allocations (Performance — Critical)

These effects create `new Float32Array()` inside `useFrame`, causing garbage collection spikes:

**`src/components/editor/effects/SparkShower.tsx`**: Move `posArr`/`colArr` to `useRef` (like MineEffect does), reuse buffers.

**`src/components/editor/effects/RomanCandleEffect.tsx`**: Same pattern — move allocations to `useRef`.

**`src/components/editor/effects/GerbEffect.tsx`**: Same — line 53-54 allocates every frame.

**`src/components/editor/effects/WaterfallEffect.tsx`**: Same — line 54-55.

**`src/components/editor/effects/MultiBurstEffect.tsx`**: Lines 47-48 allocate inside render function (not even useFrame).

### 2. Upgrade Particle Sprites — GPU Soft Particles (UE5 Niagara Style)

**`src/components/editor/effects/ShellBurstRenderer.tsx`** — Enhance fragment shader:
- Add **soft-particle depth fade**: sample depth buffer to fade particles near opaque surfaces (prevents hard cutoff at ground)
- Add **velocity stretching**: elongate sprites in direction of travel (like UE5 Niagara "Sprite Alignment → Velocity")
- Add **sub-frame interpolation**: blend between current and previous position for motion blur at high velocities
- Increase `MAX_PARTICLES` from 1500 to 2000 for denser bursts

Updated fragment shader additions:
```glsl
// Velocity-based sprite elongation
float speedFactor = clamp(vSpeed * 0.05, 0.0, 3.0);
vec2 stretchedCoord = gl_PointCoord;
stretchedCoord.y = (stretchedCoord.y - 0.5) / (1.0 + speedFactor) + 0.5;

// Soft particle edge (Gaussian with speed-dependent tightness)
float coreRadius = mix(28.0, 15.0, clamp(speedFactor * 0.3, 0.0, 1.0));
```

### 3. Enhanced Smoke — Billboard Volumetric Puffs

**`src/components/editor/effects/ShellBurstRenderer.tsx`** — Add smoke ring component:
- After burst at ~20% progress, emit 8-12 billboard smoke sprites
- Each sprite: large (2-5 units), low opacity (0.03-0.08), normal blending
- Turbulent drift using simplex noise approximation
- Slow expansion + upward buoyancy
- Color: warm gray tinted by burst color

### 4. Upgrade GerbEffect — Niagara Ribbon Trails

**`src/components/editor/effects/GerbEffect.tsx`**:
- Replace flat `pointsMaterial` with custom shader matching ShellBurstRenderer's thermal model
- Add **ribbon trail** per spark: store last 4 positions, render as `lineSegments` with fading opacity
- Increase particle count proportional to caliber (up to 800 for caliber 8+)
- Add **ground scatter sparks**: particles that hit y=0 bounce with 0.3 restitution and slide

### 5. Upgrade FlameEffect — Volumetric Fire (UE5 Niagara SubUV)

**`src/components/editor/effects/FlameEffect.tsx`**:
- Replace point particles with **billboard quads** (instanced mesh) for volumetric fire look
- Custom fragment shader with procedural noise for flame shape (Perlin-like turbulence)
- Add **heat distortion layer**: a transparent mesh behind flame that distorts the scene via refraction-like UV offset
- Increase particle count to 400 for denser combustion column
- Add **ember particles** (tiny additive dots) rising from flame tip

### 6. Upgrade CryoJetEffect — Dense Volumetric CO2

**`src/components/editor/effects/CryoJetEffect.tsx`**:
- Increase `PARTICLE_COUNT` to 350 for denser fog column
- Add **ground fog spread**: particles that reach y<0.5 switch to horizontal drift with very slow dissipation
- Custom shader for soft Gaussian sprites (replace basic `pointsMaterial`)
- Add **condensation droplets**: tiny fast-falling particles near the nozzle

### 7. Upgrade SaluteEffect — Concussive Shockwave

**`src/components/editor/effects/SaluteEffect.tsx`**:
- Add **volumetric shockwave sphere**: expanding transparent sphere with fresnel-like edge glow
- Add **debris particles**: 20-40 dark fragments ejected outward with gravity
- Add **air distortion ring**: second ring with UV distortion shader
- Ground crack/scorch mark (dark circle decal that fades over 2s)

### 8. PostProcessing — Heat Distortion Pass

**`src/components/editor/PostProcessing.tsx`**:
- Add conditional heat distortion effect when active flame/gerb effects > 0
- Uses screen-space UV displacement based on a scrolling noise texture
- Only active when `s.heatDistortionEnabled` (new scene setting)

### 9. Scene Store — New Quality Settings

**`src/store/useSceneStore.ts`**:
- Add `heatDistortionEnabled: boolean` (default true in `realistic` preset)
- Add `smokeQuality: 'off' | 'low' | 'high'` (default 'high' in realistic)
- Add `ribbonTrails: boolean` (default true in realistic/show)

## Files Summary

| File | Change |
|------|--------|
| `src/components/editor/effects/SparkShower.tsx` | Fix per-frame allocation, use reusable buffers |
| `src/components/editor/effects/RomanCandleEffect.tsx` | Fix per-frame allocation |
| `src/components/editor/effects/GerbEffect.tsx` | Fix allocation + custom shader + ribbon trails + ground bounce |
| `src/components/editor/effects/WaterfallEffect.tsx` | Fix per-frame allocation |
| `src/components/editor/effects/MultiBurstEffect.tsx` | Fix render-time allocation |
| `src/components/editor/effects/ShellBurstRenderer.tsx` | Velocity stretching, soft particles, smoke ring, MAX_PARTICLES 2000 |
| `src/components/editor/effects/FlameEffect.tsx` | Billboard quads, procedural noise, heat distortion layer, embers |
| `src/components/editor/effects/CryoJetEffect.tsx` | Denser fog, ground spread, custom shader |
| `src/components/editor/effects/SaluteEffect.tsx` | Volumetric shockwave, debris, air distortion |
| `src/components/editor/PostProcessing.tsx` | Conditional heat distortion pass |
| `src/store/useSceneStore.ts` | New quality settings: heatDistortion, smokeQuality, ribbonTrails |

