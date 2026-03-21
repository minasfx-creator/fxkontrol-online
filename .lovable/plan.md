

# Plan: Apply Niagara Guide Knowledge — Modular Emitter System + Missing VFX Techniques

## Summary

The Niagara tutorial reveals several core concepts our system lacks:
1. **No modular emitter abstraction** — our effects are monolithic per-component, not composable Niagara-style (System → Emitter → Module)
2. **No soft-particle depth fading** in spark/smoke shaders (Niagara core technique)
3. **No velocity stretching** for sprites (key for realistic sparks/comets)
4. **No ribbon/trail renderer** as a reusable system (only ad-hoc trail history in sparkTrailsGPU)
5. **No flipbook animation system** for smoke/explosion sprites
6. **No distortion/heat haze shader** for shockwaves and post-burst heat
7. **No event system** between emitters (e.g., burst triggers secondary smoke/sparks)
8. **Training page** lacks Niagara-specific learning content

This plan adds the missing Niagara-grade rendering techniques and introduces a composable emitter module architecture.

## Changes

### 1. `src/render_ultra/fireworks/niagaraEmitterSystem.ts` — NEW: Modular Emitter Architecture

A composable system mirroring Niagara's System → Emitter → Module pipeline:

```text
NiagaraSystem
  └─ NiagaraEmitter[]
       ├─ SpawnModule (rate, burst count)
       ├─ InitializeModule (lifetime, size, velocity, color)
       ├─ UpdateModule[] (drag, gravity, curl noise, color-over-life, size-over-life)
       └─ RenderModule (sprite | ribbon | mesh | gpu-sprite)
```

Types and interfaces:
- `NiagaraModule` — base with `id`, `type` (spawn/init/update/render), `enabled`
- `SpawnConfig` — `rate`, `burstCount`, `burstInterval`
- `InitConfig` — `lifetime` range, `size` range, `velocity` range, `color`, `rotation`
- `UpdateConfig` — `drag`, `gravityScale`, `curlNoiseStrength`, `colorOverLife` gradient, `sizeOverLife` curve
- `RenderConfig` — `mode` (sprite/ribbon/mesh), `blendMode`, `softParticles`, `velocityStretch`, `flipbookFrames`
- `NiagaraEmitter` — holds modules array + particle buffer
- `NiagaraSystem` — holds emitters array, `maxParticleBudget`, LOD tier

Factory functions:
- `createEmitter(config)` — builds emitter from module configs
- `createSystem(emitters[])` — composes system
- `tickSystem(system, dt)` — runs spawn → init → update pipeline
- `getSystemParticleCount(system)` — budget tracking

Event system:
- `EmitterEvent` — `type` ('burst-complete' | 'particle-death' | 'collision'), `emitterId`, `position`, `data`
- `onEmitterEvent(system, handler)` — register cross-emitter triggers (e.g., burst-complete → spawn smoke emitter)

### 2. `src/render_ultra/fireworks/softParticleShader.ts` — NEW: Soft Particle + Velocity Stretch

Niagara's two most important sprite techniques, missing from our system:

**Soft Particles** — depth-fade shader that reads scene depth to avoid hard cuts against geometry:
```glsl
// Fragment: fade alpha near scene surfaces
uniform sampler2D uDepthTexture;
float sceneDepth = texture2D(uDepthTexture, screenUV).r;
float particleDepth = gl_FragCoord.z;
float depthDiff = sceneDepth - particleDepth;
float softFade = smoothstep(0.0, uSoftRange, depthDiff);
alpha *= softFade;
```

**Velocity Stretching** — elongates sprites along velocity direction for sparks/comets:
```glsl
// Vertex: stretch billboard along velocity
vec3 viewVel = (viewMatrix * vec4(aVelocity, 0.0)).xyz;
float speed = length(viewVel);
float stretchFactor = 1.0 + speed * uStretchScale;
// Apply stretch along velocity axis in screen space
```

Export: `createSoftParticleMaterial(options)` returning THREE.ShaderMaterial with uniforms for `uSoftRange`, `uStretchScale`, `uDepthTexture`.

### 3. `src/render_ultra/fireworks/ribbonTrailRenderer.ts` — NEW: Ribbon Renderer

Niagara ribbon system for weapon trails, comet tails, and beam effects:

- `RibbonParticle` — position, width, color, age, UV
- `RibbonTrail` class — manages ordered particle chain, generates triangle strip geometry
- `createRibbonMaterial(blendMode, texture?)` — soft-edged ribbon with UV scrolling
- `updateRibbon(trail, dt)` — adds new point, removes expired, rebuilds geometry
- UV modes: `stretch` (0→1 over length) and `tile` (repeating texture)
- Width curve: tapering from head to tail via configurable curve

### 4. `src/render_ultra/fireworks/flipbookAnimator.ts` — NEW: Sprite Sheet Animation

Flipbook system for smoke puffs, explosions, and magic effects:

- `FlipbookConfig` — `rows`, `cols`, `totalFrames`, `fps`, `loop`
- `getFlipbookUV(age, config)` → `{uMin, vMin, uMax, vMax}` — calculates UV rect for current frame
- `FLIPBOOK_FRAGMENT` — GLSL snippet that samples texture with animated SubUV coordinates
- `createFlipbookMaterial(texture, config, blendMode)` — ready-to-use material

### 5. `src/render_ultra/fireworks/heatDistortion.ts` — NEW: Heat Haze/Distortion

Post-burst heat shimmer effect (Niagara distortion material):

- `createDistortionMaterial()` — ShaderMaterial that offsets scene texture UVs based on noise
- Uniforms: `uDistortionStrength`, `uNoiseScale`, `uTime`, `uSceneTexture`
- `HeatHazeEmitter` — spawns invisible distortion sprites at burst center, fading over 2-3 seconds
- Fragment uses animated Perlin noise to warp background

### 6. `src/render_ultra/fireworks/sparkTrailsGPU.ts` — Enhance with Velocity Stretch

Add velocity-stretched point rendering to existing spark system:
- New vertex attribute `aVelocity` (vec3)
- Vertex shader: compute elongated point size along velocity direction
- Add `velocityStretchFactor` uniform (default 0.3)

### 7. `src/render_ultra/fireworks/smokeSimulation.ts` — Add Soft Particles + Curl Noise

Upgrade smoke shader:
- Add `uDepthTexture` uniform for soft-particle blending
- Add curl noise motion in update (FBM-based turbulence instead of random jitter)
- Add `uNoiseScale`, `uTurbulenceStrength` uniforms

### 8. `src/lib/niagaraBlenderRules.ts` — Niagara Performance Budgets

Add per-emitter budget system from the guide's optimization checklist:
```typescript
export interface NiagaraBudgetConfig {
  maxParticlesPerEmitter: number;
  maxOverdrawLayers: number;
  maxConcurrentEmitters: number;
  maxRibbonPoints: number;
  gpuParticleThreshold: number; // above this count → force GPU mode
}
```
Add `DESKTOP_BUDGET` and `MOBILE_BUDGET` presets.
Add `checkBudget(system)` that warns when limits exceeded.

### 9. `src/pages/Training.tsx` — Cap. 9: Niagara VFX Fundamentals

New chapter with 4 missions:

| Mission ID | Title | Description | Difficulty | XP |
|---|---|---|---|---|
| `niagara-system-emitter` | Sistema vs Emitter vs Módulo | Understand the hierarchy: System contains Emitters, Emitters contain Modules (Spawn, Init, Update, Render) | easy | 200 |
| `niagara-sprite-materials` | Materiais de Partículas | Soft particles, velocity stretching, flipbook animation, additive vs screen blending | medium | 300 |
| `niagara-ribbon-trails` | Ribbon Trails | Create ribbon trails for comets and weapon effects. UV modes, width curves, tapering | medium | 350 |
| `niagara-optimization` | Otimização GPU vs CPU | Budget particles, use GPU for dense sparks, CPU for collisions. LOD emitters, overdraw reduction | hard | 400 |

### 10. `src/render_ultra/index.ts` — Export New Modules

Add exports for all new systems:
- `niagaraEmitterSystem` types and functions
- `softParticleShader` material factory
- `ribbonTrailRenderer` classes
- `flipbookAnimator` utilities
- `heatDistortion` material

## Files Summary

| File | Change |
|------|--------|
| `src/render_ultra/fireworks/niagaraEmitterSystem.ts` | NEW — Modular System→Emitter→Module architecture with event system |
| `src/render_ultra/fireworks/softParticleShader.ts` | NEW — Depth-fade + velocity stretch shader materials |
| `src/render_ultra/fireworks/ribbonTrailRenderer.ts` | NEW — Triangle-strip ribbon trails with UV modes |
| `src/render_ultra/fireworks/flipbookAnimator.ts` | NEW — Sprite sheet SubUV animation system |
| `src/render_ultra/fireworks/heatDistortion.ts` | NEW — Post-burst heat shimmer distortion |
| `src/render_ultra/fireworks/sparkTrailsGPU.ts` | Add velocity stretch attribute + shader |
| `src/render_ultra/fireworks/smokeSimulation.ts` | Add soft particles + curl noise turbulence |
| `src/lib/niagaraBlenderRules.ts` | Per-emitter budget system + mobile/desktop presets |
| `src/render_ultra/index.ts` | Export new modules |
| `src/pages/Training.tsx` | Cap. 9 — Niagara VFX Fundamentals (4 missions) |

