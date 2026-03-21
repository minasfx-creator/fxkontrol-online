

# Plan: UE5.7 Niagara Parity — Data Interfaces, Spawn Shapes, Scalability & Emitter Inheritance

## Gap Analysis

Comparing our system against UE5.7 Niagara docs reveals these missing core features:

| UE5.7 Niagara Feature | Our Status |
|---|---|
| Data Interfaces (mesh sampling, curves, textures) | Missing |
| Spawn Shapes (sphere, cone, mesh surface, box, torus) | Missing — all particles spawn at origin |
| Emitter Inheritance / Templates | Missing — no base emitter → variant pattern |
| Scalability Groups (per-platform quality) | Partial — LOD exists but not tied to emitter system |
| Warmup / Pre-simulation | Missing |
| Particle Attributes (custom per-particle data) | Missing — fixed struct only |
| Orbit / Point Attractor modules | Missing |
| Collision module (plane, depth buffer) | Missing |
| Sub-emitter spawning (spawn on event) | Missing — events exist but no auto-spawn |
| Kill Zone / Kill Volume | Missing |

## Changes

### 1. `src/render_ultra/fireworks/niagaraSpawnShapes.ts` — NEW

Spawn shape modules matching UE5.7:
- `SpawnShape` type: `'point' | 'sphere' | 'hemisphere' | 'cone' | 'box' | 'torus' | 'ring' | 'cylinder' | 'mesh-surface'`
- `SpawnShapeConfig` — shape type + dimensions (radius, angle, extents)
- `sampleSpawnShape(config)` → returns position + normal vectors
- Each shape generates properly distributed random positions (e.g., sphere uses cube root for uniform volume distribution)
- Integrate into `InitConfig` as optional `spawnShape` field

### 2. `src/render_ultra/fireworks/niagaraDataInterfaces.ts` — NEW

Data Interface system for reading external engine data into particle modules:
- `CurveDataInterface` — sample float/color curves by normalized time (reusable across emitters)
- `MeshDataInterface` — sample positions/normals from THREE.BufferGeometry vertices (spawn on mesh surface)
- `TextureDataInterface` — sample color/alpha from a texture at UV coordinates
- `SkeletalDataInterface` — read bone transforms for attachment (skeleton joint positions)
- Each interface: `{ type, sample(particle, t) → value }` pattern

### 3. `src/render_ultra/fireworks/niagaraForceModules.ts` — NEW

Missing physics modules from UE5.7:
- `PointAttractorModule` — attract/repel particles toward a world position with falloff
- `VortexModule` — spin particles around an axis (tornado/whirlpool effects)
- `OrbitModule` — orbital motion around emitter center with configurable radius/speed
- `WindModule` — global directional force with turbulence
- `KillZoneModule` — kill particles entering/exiting a box/sphere volume
- `CollisionModule` — ground plane collision with bounce coefficient + friction
- Each returns a velocity delta to apply in the update pipeline

### 4. `src/render_ultra/fireworks/niagaraEmitterSystem.ts` — Enhance

Add to existing system:
- `InitConfig.spawnShape?: SpawnShapeConfig` — use spawn shapes from #1
- `NiagaraEmitter.forceModules: ForceModule[]` — pluggable force modules from #3
- `NiagaraEmitter.dataInterfaces: DataInterface[]` — data feeds from #2
- `NiagaraParticle.customAttributes: Record<string, number>` — extensible per-particle data
- `NiagaraSystem.warmupTime: number` — pre-simulate N seconds on creation
- `NiagaraSystem.scalabilityGroup: 'cinematic' | 'high' | 'medium' | 'low' | 'mobile'`
- `warmupSystem(system, warmupSeconds)` — runs tickSystem in a loop to pre-fill particles
- Sub-emitter spawning: new `SubEmitterConfig` on emitter that auto-spawns a child emitter template on particle-death/collision events
- `createEmitterFromTemplate(baseEmitter, overrides)` — inheritance pattern for emitter variants

Add 4 new presets using the new features:
- `createFireballPreset()` — sphere spawn + attractor + smoke sub-emitter
- `createCometPreset()` — cone spawn + ribbon render + velocity stretch
- `createVortexPreset()` — ring spawn + vortex force + orbit
- `createDebrisPreset()` — box spawn + collision + mesh render

### 5. `src/lib/niagaraBlenderRules.ts` — Scalability Groups

Expand budget system with UE5.7-style scalability:
- `ScalabilityGroup` config: particle count multiplier, spawn rate multiplier, max emitters, enable/disable soft particles, ribbon quality
- 5 presets: `cinematic` (2x everything), `high`, `medium`, `low`, `mobile` (0.25x, no soft particles)
- `applyScalability(system, group)` — clamps system settings to group limits
- Link to existing `useLOD` adaptive system

### 6. `src/render_ultra/index.ts` — Export New Modules

Add exports for spawn shapes, data interfaces, force modules, and new presets.

## Files

| File | Change |
|------|--------|
| `src/render_ultra/fireworks/niagaraSpawnShapes.ts` | NEW — 9 spawn shapes with uniform sampling |
| `src/render_ultra/fireworks/niagaraDataInterfaces.ts` | NEW — Curve, Mesh, Texture, Skeletal data interfaces |
| `src/render_ultra/fireworks/niagaraForceModules.ts` | NEW — Attractor, Vortex, Orbit, Wind, Kill Zone, Collision |
| `src/render_ultra/fireworks/niagaraEmitterSystem.ts` | Spawn shapes, force modules, custom attributes, warmup, sub-emitters, inheritance, 4 new presets |
| `src/lib/niagaraBlenderRules.ts` | Scalability groups with 5 platform presets |
| `src/render_ultra/index.ts` | Export new modules |

