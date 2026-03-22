

# Niagara Full Integration — VDL → Emitter Physics Pipeline

## Problem

The `niagaraProfile` from VDL parsing (starCount, lifetime, velocity, drag, gravityScale, sparkleRate, fadeProfile) is stored on each effect but **never consumed by NiagaraVFXController**. The controller uses hardcoded `createSparkEmitterTemplate(caliber, color)` that ignores the VDL-derived physics. This means a "4in Gold Kamuro" and a "4in Blue Peony" get identical particle physics — wrong.

Additionally, per-type behavior (willow drooping, crossette splitting, mine ground-up, comet single-star) is not differentiated in the Niagara system — only the legacy `FireworkBurst` component in SkyCanvas handles pattern variation, but that's the old CPU path.

## Architecture Change

```text
VDL "4in Gold Kamuro"
  → parseVDL() → niagaraProfile { starCount:600, lifetime:3.5, drag:0.985, gravityScale:0.7, fadeProfile:'ember' }
  → NiagaraVFXController reads effect.niagaraProfile
  → createSparkEmitterTemplate(caliber, color, niagaraProfile)  ← NEW signature
  → Emitter init overrides: lifetime, velocity, drag, gravityScale from profile
  → Emitter update overrides: fadeProfile controls colorOverLife curve shape
```

## Changes

### 1. `NiagaraVFXController.tsx` — Apply niagaraProfile to emitter templates

**Modify `createSparkEmitterTemplate`** to accept optional `niagaraProfile` and `pattern`:
- `starCount` → override `sparkCount` (clamped to budget)
- `lifetime` → override `init.lifetime` range
- `velocity` → scale `breakSpeed` multiplier
- `drag` → override `update.drag`
- `gravityScale` → override `update.gravityScale`
- `fadeProfile` → switch colorOverLife curve shape (linear=even fade, exponential=fast burn, ember=slow glow)
- `sparkleRate` → add randomized brightness flicker in colorOverLife

**Add pattern-specific emitter variants**:
- `willow/kamuro`: high drag (0.98+), low gravity (0.5-0.7), long lifetime, downward-heavy velocity bias
- `crossette`: spawn 4 sub-bursts at spark death via sub-emitter with right-angle velocity
- `mine`: velocity bias upward only (no downward component), fast burn
- `comet`: single large star with ribbon trail, high velocity stretch
- `palm`: asymmetric velocity (strong upward, wide horizontal), heavy gravity for drooping
- `horsetail`: extreme lifetime, very high drag, low gravity — hangs in air
- `strobe`: add blink module (opacity oscillation in update)
- `ring`: spawn on torus shape instead of sphere
- `dahlia`: fewer stars, higher velocity, longer trails

**Read `effect.niagaraProfile`** when spawning burst systems (line ~356-376):
```typescript
const niagaraProfile = effect.niagaraProfile;
const sparkEmitter = createSparkEmitterTemplate(caliber, burstColor, pattern, niagaraProfile);
```

### 2. `NiagaraVFXController.tsx` — Pattern-specific spawn shapes + force modules

Map VDL patterns to Niagara spawn shapes:
- `ring` → `{ type: 'torus', radius: caliber*3, tubeRadius: 0.5 }`
- `crossette` → sphere surface + sub-emitter on death with 4-way split
- `palm` → cone spawn `{ type: 'cone', coneAngle: 25° }` + point attractor below
- `fan` → limited arc spawn

Add force modules per pattern:
- `willow/kamuro` → point attractor pulling down gently
- `horsetail` → extreme drag (0.99), minimal gravity
- `tourbillion` → vortex force module for spinning

### 3. `vdlParser.ts` — Expand auto-matching for all effect types

Currently `autoMatchNiagaraPreset` only matches by color+type for a few presets. Expand to ensure ALL VDL types get a `niagaraProfile` even without a named preset — generate profile from type physics:

Add `generateNiagaraProfileFromType(type, caliber)` function that creates a profile based on pyrotechnic reality:
- `willow`: starCount=300, lifetime=4.5, velocity=30, drag=0.985, gravityScale=0.6, fadeProfile='ember'
- `crossette`: starCount=100, lifetime=1.8, velocity=50, drag=0.95, gravityScale=1.2, fadeProfile='linear'
- `mine`: starCount=200, lifetime=1.5, velocity=60, drag=0.92, gravityScale=0.8, fadeProfile='linear'
- `comet`: starCount=50, lifetime=3.0, velocity=45, drag=0.98, gravityScale=0.9, fadeProfile='ember'
- `palm`: starCount=250, lifetime=3.0, velocity=40, drag=0.97, gravityScale=1.3, fadeProfile='exponential'
- `horsetail`: starCount=400, lifetime=6.0, velocity=25, drag=0.995, gravityScale=0.4, fadeProfile='ember'
- `strobe`: starCount=150, lifetime=2.5, velocity=35, drag=0.96, gravityScale=1.0, fadeProfile='linear' + sparkleRate=8
- (etc for all ~25 types)

This ensures every VDL description automatically gets physics-correct Niagara behavior.

### 4. `niagaraColorPresets.ts` — Add presets for missing effect types

Add presets for: `crossette`, `mine`, `comet`, `palm`, `horsetail`, `strobe`, `dahlia`, `ring`, `fan`, `waterfall`, `salute` — each with calibrated particleProfile and autoMatchTypes.

## Files Summary

| File | Change |
|------|--------|
| `src/components/editor/NiagaraVFXController.tsx` | Refactor emitter templates to consume niagaraProfile + pattern; add pattern-specific spawn shapes and force modules |
| `src/lib/vdlParser.ts` | Add `generateNiagaraProfileFromType()` fallback so all effects get a profile |
| `src/lib/niagaraColorPresets.ts` | Add ~12 new presets for missing effect types |

