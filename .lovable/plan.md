

# Plano: Refinamento 360° Seamless + Integração V-Ray Completa

## Problemas Identificados

Após revisão exaustiva, há **9 inconsistências** que precisam ser corrigidas:

### Escala inconsistente (não escalados no ×5)
1. **Moon glow layers**: body=450 mas inner glow=95, outer halo=160, scatter=320, pointLight distance=6000 — tudo desproporcional
2. **GroundReflections fade**: `/ 600.0` (line 2253) — reflexões somem a 600m, deveria ser `/3000.0`
3. **Treeline**: `baseDist = 800 + layer * 300` (line 2387) — árvores a 800m, deveria ser `4000 + layer * 1500`
4. **AtmosphericParticles respawn**: `camX ± 200` (lines 1584-1585) — partículas reaparecem em área minúscula, deveria ser `±1000`
5. **Ground fog edge fade**: `smoothstep(0.0, 0.3, ...)` (line 1734) — bordas do fog visíveis no plano 10000×10000, deveria ser `0.12`

### Sky/Ground seam
6. **Sky below-horizon cor fixa**: `ground = vec3(0.005, 0.005, 0.015)` hardcoded — não combina com groundStyle
7. **Horizon band estreita**: transição `smoothstep(-0.15, -0.02, h)` muito apertada — cria "linha" visível com câmera alta

### V-Ray Integration (completamente desconectada)
8. **PostProcessing.tsx**: ToneMapping hardcoded como `ACES_FILMIC` — ignora o `ViewTransform` system que já existe em `niagaraBlenderRules.ts`
9. **SceneEditorPanel.tsx**: Nenhum dropdown de View Transform — impossível alternar entre ACES/AgX/Standard
10. **useSceneStore.ts**: Sem campo `viewTransform` no `SceneSettings`

## Mudanças

### Arquivo 1: `src/components/editor/SkyCanvas.tsx`

**Moon glow ×5 proporcional (lines 1186-1218):**
- Inner glow sphere: `95` → `500`
- Outer halo sphere: `160` → `800`
- Atmospheric scatter sphere: `320` → `1600`
- pointLight distance: `6000` → `30000`

**GroundReflections fade (line 2253):**
- `/ 600.0` → `/ 3000.0`

**Treeline scale (lines 2387-2390):**
- `baseDist = 800 + layer * 300` → `4000 + layer * 1500`
- random offset: `Math.random() * 60` → `Math.random() * 300`

**AtmosphericParticles respawn (lines 1584-1585):**
- `(Math.random() - 0.5) * 200` → `(Math.random() - 0.5) * 2000` (both X and Z)

**Ground fog edge (line 1734):**
- `smoothstep(0.0, 0.3, ...)` → `smoothstep(0.0, 0.12, ...)`

**Sky shader — dynamic ground tint (line 1043):**
- Add uniform `uGroundTint` to SkyGradient
- Replace hardcoded `vec3(0.005, 0.005, 0.015)` with `uGroundTint`
- Set `uGroundTint` based on `groundStyle`:
  - `finale-dark`: `(0.003, 0.004, 0.008)`
  - `flat-black`: `(0.001, 0.001, 0.001)`
  - `google-earth`: `(0.005, 0.008, 0.004)`
  - `concrete`: `(0.006, 0.006, 0.007)`

**Sky shader — wider horizon band (lines 1054-1057):**
- `smoothstep(-0.02, 0.02, h)` → `smoothstep(-0.05, 0.02, h)`
- `smoothstep(-0.15, -0.02, h)` → `smoothstep(-0.35, -0.05, h)`

### Arquivo 2: `src/store/useSceneStore.ts`

- Add `viewTransform: ViewTransform` to `SceneSettings` interface (import from niagaraBlenderRules)
- Default: `'aces-filmic'`
- Export the type for other files

### Arquivo 3: `src/components/editor/PostProcessing.tsx`

- Read `settings.viewTransform` from store
- Map dynamically:
  - `'aces-filmic'` → `ToneMappingMode.ACES_FILMIC`
  - `'agx'` → `ToneMappingMode.AGX`
  - `'standard'` → `ToneMappingMode.LINEAR`
- Adjust bloom intensity per view transform (AgX = softer bloom ×0.7, Standard = no compression)

### Arquivo 4: `src/components/editor/SceneEditorPanel.tsx`

- Import `getAllViewTransforms` from niagaraBlenderRules
- Add "View Transform" dropdown in Post-Processing section (before Vignette)
- Options: ACES Filmic, AgX (Blender 4.0), Standard (Linear)
- Wired to `updateSettings({ viewTransform: v })`

### Arquivo 5: `src/lib/niagaraBlenderRules.ts`

- Make `clampNiagaraHDR` accept optional `ViewTransform` parameter to use per-mode limits instead of global constants

## Resumo: 5 arquivos, ~25 mudanças

| Arquivo | Mudanças |
|---------|----------|
| `SkyCanvas.tsx` | Moon glow ×5, reflections fade, treeline scale, particles respawn, fog edge, ground tint uniform, horizon band |
| `useSceneStore.ts` | Add `viewTransform` field + default |
| `PostProcessing.tsx` | Dynamic ToneMapping from store |
| `SceneEditorPanel.tsx` | View Transform dropdown |
| `niagaraBlenderRules.ts` | `clampNiagaraHDR` per-mode HDR limits |

