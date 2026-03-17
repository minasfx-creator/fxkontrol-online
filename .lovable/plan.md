

# Plano: Engine de Renderização de Fogos Web 3D — Nível V-Ray/Blender/Niagara

## Diagnóstico Atual

O pipeline atual já possui:
- Shaders customizados GLSL com transição térmica (white-hot → saturated → ember → charcoal)
- ACES Filmic via PostProcessing EffectComposer
- Adaptive exposure com burst-load awareness
- Niagara-style budgets (star count, burst limits)
- HDR clamping per-particle

**Problema principal**: Tudo usa `THREE.AdditiveBlending` hardcoded — 100% dos 20+ efeitos. Isso causa acumulação descontrolada de luminância quando múltiplos efeitos se sobrepõem, resultando no "white-out" persistente. Additive blending soma RGB sem limite, e o ACES tonemapping no final não consegue compensar quando dezenas de layers aditivas se acumulam antes do tone map pass.

## Estratégia: Pipeline V-Ray/Blender/Niagara Completo

### 1. Blend Mode System para o Pipeline 3D (Core Fix)

Criar um sistema de blend modes que mapeia para `THREE.CustomBlending` com equações e fatores corretos:

```text
┌─────────────┬──────────────────────────────────────────────┐
│ Blend Mode  │ THREE.js Custom Blending Config              │
├─────────────┼──────────────────────────────────────────────┤
│ Additive    │ SrcAlpha + One (current, for core stars)     │
│ Screen      │ One + OneMinusSrcColor (haloes, afterglow)   │
│ Normal      │ SrcAlpha + OneMinusSrcAlpha (smoke, debris)  │
│ Soft Light  │ Custom shader pass (glow clouds)             │
│ Multiply    │ DstColor + Zero (ground shadows)             │
│ Overlay     │ Shader-based (flash rings)                   │
│ Hard Light  │ Shader-based (laser beams)                   │
└─────────────┴──────────────────────────────────────────────┘
```

**Key insight from V-Ray/Blender**: Only the incandescent star core should be Additive. Everything else (afterglow, smoke, flash rings, ground illumination halos) should use Screen or Normal blending to prevent energy accumulation.

### 2. Refactor `niagaraBlenderRules.ts` — Full Compositing Engine

Expand to provide:
- `getThreeBlending(mode)` → returns `{blending, blendEquation, blendSrc, blendDst}` for THREE.js
- `getShaderBlendFunction(mode)` → returns GLSL snippet for shader-based modes (Overlay, Soft Light, Hard Light)
- Energy conservation: `applyEnergyConservation(color, blendMode)` scales output to prevent >1.0 accumulation across layers

### 3. Apply Correct Blend Modes to Each Effect Component

Based on real-world pyrotechnic rendering (V-Ray fire/explosion presets, Blender Cycles emission shaders):

| Component | Current | Corrected |
|-----------|---------|-----------|
| ShellBurstRenderer (stars) | Additive | Additive (keep, but with energy cap) |
| ShellBurstRenderer (afterglow) | Additive | **Screen** |
| ShellBurstRenderer (flash sphere) | Additive | **Screen** |
| ShellBurstRenderer (flash ring) | Additive | **Screen** |
| CrossetteSubBurst | Additive | Additive (smaller, ok) |
| SmokeTrail | Normal | Normal (keep) |
| GerbEffect | Additive | **Screen** for halo, Additive for core |
| FlameEffect | Additive | **Screen** |
| CometEffect, MineEffect, CakeEffect | Additive | **Screen** for flash, Additive for star core only |
| LaserEffect | Additive | **Hard Light** for beam, **Screen** for haze |
| CryoJetEffect | Additive | **Normal** (opaque fog) |
| PointLight (ground illumination) | N/A | Reduce intensity × 0.4 |

### 4. Shader Enhancement — V-Ray Fire Shader Inspired

Update `BURST_FRAGMENT` shader to include:
- **Energy conservation**: `gl_FragColor.rgb = min(thermalColor * glow, vec3(MAX_ENERGY))` where MAX_ENERGY adapts to burst load
- **Opacity-weighted emission**: Instead of raw additive, use `premultiplied alpha` approach where alpha controls energy contribution

### 5. Files to Edit

1. **`src/lib/niagaraBlenderRules.ts`** — Add blend mode mapping functions + energy conservation
2. **`src/components/editor/effects/ShellBurstRenderer.tsx`** — Change afterglow, flash sphere, flash ring to Screen blending; add energy cap to fragment shader
3. **`src/components/editor/effects/MineEffect.tsx`** — Flash → Screen
4. **`src/components/editor/effects/CakeEffect.tsx`** — Flash → Screen
5. **`src/components/editor/effects/FlameEffect.tsx`** — Screen blending
6. **`src/components/editor/effects/GerbEffect.tsx`** — Screen for halo
7. **`src/components/editor/effects/LaserEffect.tsx`** — Hard Light for beams
8. **`src/components/editor/effects/CryoJetEffect.tsx`** — Normal blending
9. **`src/components/editor/effects/CometEffect.tsx`** — Screen for trail glow
10. **`src/components/editor/effects/MultiBurstEffect.tsx`** — Screen for flash overlays

This is the **root cause fix** — switching from "everything additive" to physically-correct compositing modes eliminates white-out at the source rather than trying to clamp it downstream.

