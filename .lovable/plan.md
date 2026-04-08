

# Ciclo #50 — SmokeTrail GC + PrefireShell Per-Frame Mesh Churn

## Bugs Identificados

| # | Bug | Local | Impacto |
|---|-----|-------|---------|
| 1 | **`_color.clone()` per-frame in SmokeTrail** — L168 calls `_color.clone().multiplyScalar(...)` inside `useFrame` for every visible smoke particle. With 80-120 particles × 60fps = 4800-7200 Color allocations/s. Defeats the purpose of the pre-allocated `_color` singleton | `SmokeTrail.tsx` L168 | **Alto** |
| 2 | **PrefireShell creates 30 `<mesh>` + `<sphereGeometry>` + `<meshBasicMaterial>` per frame** — L218-252 maps `sparkSeeds` (30 entries) into individual mesh elements every render. React reconciles all 30 on every progress change. Should use a single `<points>` with pre-allocated buffers | `PrefireShell.tsx` L218-252 | **Alto** |
| 3 | **PrefireShell computes `pitchRad`/`headingRad`/`dirX`/`dirY`/`dirZ` in render body** — L70-76 runs trig per render but values only change with props. Should be memoized | `PrefireShell.tsx` L70-76 | Médio |
| 4 | **PrefireShell `Math.random()` in useFrame** — L119-121 uses `Math.random()` for trail spread, causing non-deterministic jitter every frame (particles jump randomly). Should use seeded hash for stable positions | `PrefireShell.tsx` L119-121 | Médio |

## Implementação

**Fix 1 — Zero-alloc color in SmokeTrail (`SmokeTrail.tsx` L168):**
- Add a second pre-allocated Color singleton `_colorTemp`
- Replace `_color.clone().multiplyScalar(...)` with `_colorTemp.copy(_color).multiplyScalar(...)`
- Result: 0 allocations per frame

**Fix 2 — Replace 30 spark meshes with single `<points>` (`PrefireShell.tsx`):**
- Add pre-allocated spark buffers: `sparkPositions = new Float32Array(SPARK_COUNT * 3)`, `sparkColors = new Float32Array(SPARK_COUNT * 3)`
- Move spark position computation into `useFrame`, writing to buffers
- Replace the `.map()` JSX block with a single `<points>` element using `pointsMaterial` with `AdditiveBlending`
- Track visible spark count via `setDrawRange`

**Fix 3 — Memoize launch direction (`PrefireShell.tsx`):**
- Wrap `pitchRad`, `headingRad`, `dirX`, `dirY`, `dirZ` in `useMemo(() => ..., [heading, pitch])`

**Fix 4 — Replace `Math.random()` with deterministic hash (`PrefireShell.tsx`):**
- Use `hash01(i * 0.31 + progress * 7.3)` (already imported in project) for trail spread offset instead of `Math.random()`

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Fix SmokeTrail _color.clone() |
| 2 | Refactor PrefireShell sparks + memoize direction + deterministic hash |
| 3 | Build verification |

