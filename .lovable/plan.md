

# Ciclo #46 — Critical Runtime Crash + GC Fixes

## Bugs Identificados

| # | Bug | Local | Impacto |
|---|-----|-------|---------|
| 1 | **`tipCurlMods` crashes when `stepMods` is undefined** — L523 assigns `const tipCurlMods = stepMods` and L524 does `tipCurlMods.tipCurlFactor = ...`. When `fallingLeaves` is false (default), `stepMods` is `undefined` → **TypeError crash** on every frame | L523-533 | **CRÍTICO** |
| 2 | **Smoke uniforms spread per-render** — L905 `{...smokeUniforms, aAge: {...}}` creates a new object for each of 16 smoke meshes every React render | L905-911 | Alto |
| 3 | **Glitter `shift()` is O(n)** — L540 still uses `shift()` on 800-element array for overflow cap | L540 | Médio |
| 4 | **`pistilBuffers` over-allocated** — L429-435 allocates `MAX_PARTICLES` (2000) when pistil uses max ~500 particles | L429-435 | Baixo |

## Implementação — `ShellBurstRenderer.tsx`

**Fix 1 (CRITICAL) — Replace undefined stepMods with pre-allocated singleton (L385-388 + L523-533):**
- Change `stepMods` useMemo to always return an object (never undefined):
```ts
const stepMods = useMemo<StepModifiers>(
  () => fallingLeaves ? { fallingLeaves: true, reducedGravity: 0.3 } : {},
  [fallingLeaves]
);
```
- This makes L523 `tipCurlMods.tipCurlFactor = ...` safe without any other changes needed

**Fix 2 — Pre-allocate per-smoke uniforms (L893-918):**
- Create a `smokeUniformsArray` of 16 uniform objects in `useMemo`, each with own `aAge`, `aMaxAge`, `aScale`, `aSeed` uniform values sharing base `smokeUniforms` refs
- In JSX, use `smokeUniformsArray[i]` directly instead of spread

**Fix 3 — Replace glitter `shift()` with index overwrite (L539-541):**
- Use circular write index: when overflow, overwrite oldest entry and increment index mod GLITTER_MAX

**Fix 4 — Right-size pistil buffers (L429-435):**
- Allocate based on `pistilCount` (with minimum of 1) instead of `MAX_PARTICLES`

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Apply 4 fixes to ShellBurstRenderer.tsx |
| 2 | Build verification |

