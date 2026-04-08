

# Ciclo #47 — Smoke Shader Bug + Crossette Render Stale

## Bugs Identificados

| # | Bug | Local | Impacto |
|---|-----|-------|---------|
| 1 | **Smoke shader declares `attribute` but receives `uniform`** — SMOKE_VERTEX (L174-177) declares `aAge`, `aMaxAge`, `aScale`, `aSeed` as `attribute` (per-vertex), but they are passed via `perSmokeUniforms` as uniform values on the shaderMaterial. The planeGeometry has no such attributes → shader reads garbage → smoke billboards render incorrectly or are invisible | L174-177, L930-933 | **CRÍTICO** |
| 2 | **Crossette sub-bursts read ref in JSX** — L866 `crossetteRef.current.map(...)` reads a mutable ref directly in the render body. Ref mutations don't trigger re-render → new crossette sub-bursts remain invisible until an unrelated state change forces re-render | L866-868 | Alto |
| 3 | **`smokeParticles.current.map()` in JSX** — L922 same pattern: smoke meshes are conditionally rendered based on ref length. After `smokeSpawned` is set (in useFrame, L707), the component doesn't re-render → smoke meshes never mount | L922-940 | Alto |
| 4 | **`noTrail` prop unused** — Prop declared (L316) but never read in any logic. Glitter trails still spawn even when `noTrail=true` | L316, L553 | Baixo |

## Implementação — `ShellBurstRenderer.tsx`

**Fix 1 — Smoke shader: change `attribute` → `uniform` (L174-177):**
```glsl
uniform float aAge;
uniform float aMaxAge;
uniform float aScale;
uniform float aSeed;
```
This matches how the values are actually passed via `perSmokeUniforms[i]`.

**Fix 2+3 — Force re-render when crossette/smoke state changes:**
- Add a `const [renderTick, setRenderTick] = useState(0)` counter
- In useFrame, after `smokeSpawned.current = true`, call `setRenderTick(t => t + 1)` to force mesh mount
- After adding crossette sub-bursts (L582), also increment renderTick
- This is minimal — a single state bump per lifecycle phase, not per-frame

**Fix 4 — Respect `noTrail` prop (L553):**
- Guard glitter emission: `if (trailType === 'glitter' && !noTrail && ...)`

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Fix smoke shader attribute→uniform |
| 2 | Add renderTick for crossette/smoke mount |
| 3 | Guard glitter with noTrail |
| 4 | Build verification |

