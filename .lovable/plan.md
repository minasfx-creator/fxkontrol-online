

# Ciclo #49 — Wind GC Allocation + Dead GPU Attribute + Glitter Cleanup

## Bugs Identificados

| # | Bug | Local | Impacto |
|---|-----|-------|---------|
| 1 | **`windField.sample` allocates new tuple every call** — L151 returns `[x, y, z]` literal. ShellBurstRenderer L766 calls it 16× per frame in smoke loop = 960 arrays/s of GC pressure. Other callers in `sharedState.tsx` also affected | `windField.ts` L151-155, `ShellBurstRenderer.tsx` L766 | **Alto** |
| 2 | **`dragBuffer` / `aDragCoeff` — dead GPU attribute** — Buffer allocated (L427), attached to geometry (L816), shader declares `attribute float aDragCoeff` (L39) but **never reads it** in vertex calculations and buffer is **never written to** in useFrame. Wastes GPU bandwidth uploading 2000 zeros every frame | `ShellBurstRenderer.tsx` L39, L427, L816 | Médio |
| 3 | **Glitter backward-iterate swap-and-pop skips swapped element** — L641-648 iterates `i` from end→0. When dead particle at `i` is swapped with last element, `i` decrements → the swapped particle is never checked that frame. Particle survives 1 extra frame, causing faint ghost glitter | `ShellBurstRenderer.tsx` L641-648 | Baixo |
| 4 | **Flash sphere and ring missing explicit `depthTest`** — L881-893 flash and L897-911 ring use screen blending but no `depthTest` prop. Default `true` is correct but should be explicit to prevent regression if THREE defaults change | `ShellBurstRenderer.tsx` L881-911 | Baixo |

## Implementação

**Fix 1 — Zero-alloc windField.sample (`windField.ts` + `ShellBurstRenderer.tsx`):**
- Add `sampleInto(x, y, z, type, out: [number,number,number]): void` method to WindField that writes into a pre-allocated output tuple instead of returning a new array
- Add a module-level `_windOut: [number,number,number] = [0,0,0]` singleton in ShellBurstRenderer
- Replace L766 `const [windX, windY, windZ] = windField.sample(...)` with `windField.sampleInto(..., _windOut)` + read `_windOut[0/1/2]`
- Keep existing `sample()` for backward compat (calls sampleInto internally)

**Fix 2 — Remove dead dragBuffer + aDragCoeff (`ShellBurstRenderer.tsx`):**
- Delete `dragBuffer` from L427 useMemo
- Delete `<bufferAttribute attach="attributes-aDragCoeff" .../>` from L816
- Delete `attribute float aDragCoeff;` from BURST_VERTEX L39

**Fix 3 — Re-check swapped particle in glitter cleanup (L641-648):**
- After swap-and-pop, don't decrement `i` — use `continue` to re-check same index:
```ts
if (gp[i].life > gp[i].maxLife) {
  gp[i] = gp[gp.length - 1]; gp.pop();
  // don't decrement i — re-check swapped element
  continue;
}
```
- Adjust loop to use while instead of for to handle the continue correctly

**Fix 4 — Explicit depthTest on flash meshes (L883, L900):**
- Add `depthTest` prop to both meshBasicMaterial elements

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Add `sampleInto` to windField.ts |
| 2 | Apply fixes 1-4 in ShellBurstRenderer.tsx |
| 3 | Build verification |

