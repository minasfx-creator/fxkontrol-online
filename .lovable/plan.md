
# Plan: Complete Niagara Integration — COMPLETED ✅

## Implemented

1. **Legacy Controller Removal** — Removed `SmokeController` and `SparkTrailController` from SkyCanvas, eliminating duplicate particles
2. **NiagaraVFXController Enhanced** — Wired soft-particle material (depth-fade), ribbon trails (comet/willow), heat haze emitter (caliber ≥6"), sub-emitter spawning (ember on spark death), thermal color evolution
3. **CometEffect → Niagara Ribbon** — Replaced hand-rolled trail with `RibbonTrail` from ribbonTrailRenderer, keeping spark detach and muzzle flash
4. **GerbEffect → Niagara Emitter** — Replaced manual particle arrays with `NiagaraSystem` using cone spawn shape + collision module
5. **SmokeTrail → Niagara Smoke Emitter** — Replaced manual smoke with `NiagaraSystem` using sphere spawn, curl noise turbulence, negative gravity, soft-particle config

## Architecture

```text
SkyCanvas
  ├─ NiagaraVFXController (central burst VFX)
  │    ├─ SparkEmitter (velocity stretch + sub-emitter on death)
  │    ├─ SmokeEmitter (soft particles + curl noise)
  │    ├─ EmberEmitter (collision + bounce)
  │    ├─ RibbonTrail (comet/willow patterns)
  │    └─ HeatHazeEmitter (distortion, caliber ≥ 6)
  │
  ├─ CometEffect → RibbonTrail + detach sparks
  ├─ GerbEffect → NiagaraSystem (cone spawn + collision)
  ├─ SmokeTrail → NiagaraSystem (sphere spawn + curl noise)
  │
  ├─ LensFlareController (kept — complementary)
  └─ [other effects unchanged]
```
