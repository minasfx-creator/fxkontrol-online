
# Ciclo #40 — Depth Consistency, Smoke Chemistry, Wind GC

## Bugs Identificados

| # | Bug | Local | Impacto |
|---|-----|-------|---------|
| 1 | **Flash/shockwave/smoke ignore depthTest** — L1050, L1057, L1081, L1096 all use `depthTest={false}`. Stars and trails already fixed in Ciclo #38-39, but ancillary meshes (detonation flash, shockwave ring, smoke spheres) still render over buildings/terrain | `FireworkRenderer.tsx` | Alto — visual inconsistency |
| 2 | **Secondary smoke wisps hardcoded color** — L1092 uses `color="#665544"` ignoring burst color chemistry. Should blend burst color with gray like primary smoke does | `FireworkRenderer.tsx` L1092 | Médio — breaks color coherence |
| 3 | **`getWindAtPosition` called per trail segment** — L809, L820: trailing patterns call `getWindAtPosition()` per segment per star per frame (200 stars × 8 segments = 1600 calls). Each call reads the project store + syncs wind config. Should sample wind once per burst and reuse | `FireworkRenderer.tsx` L808-821 | Alto — CPU pressure in barrages |

## Implementação

**Fix 1 — Enable depthTest on all burst ancillary meshes:**
- L1050: `depthTest={false}` → `depthTest={true}` (detonation flash)
- L1057: `depthTest={false}` → `depthTest={true}` (shockwave ring)
- L1081: `depthTest={false}` → `depthTest={true}` (primary smoke sphere)
- L1096: `depthTest={false}` → `depthTest={true}` (secondary smoke wisps)

**Fix 2 — Secondary smoke color from burst chemistry:**
- L1092: replace `color="#665544"` with `color={_smokeBlendResult}` (reuses the already-computed smoke blend from L1077)

**Fix 3 — Cache wind sampling for trailing patterns:**
- Before the star loop (after L493), add a single wind sample for the burst center position:
  ```
  const wTrail = isTrailingPattern ? getWindAtPosition(position[0], position[1], position[2], 'ember') : w;
  ```
- Replace `getWindAtPosition(...)` calls at L809 and L820 with the cached `wTrail`
- Eliminates ~1600 store reads per frame per trailing burst

## Ordem

| Passo | Tarefa |
|-------|--------|
| 1 | Apply all 3 fixes |
| 2 | Build verification |
