
# Ciclo #39 — Rendering Bugs: Rocket Prefire, Smoke GC, Trail DepthTest

## Bugs Identificados

| # | Bug | Local | Impacto |
|---|-----|-------|---------|
| 1 | **Rocket prefire interceptado pelo handler genérico** — L1300 `if (inPrefire)` retorna `PrefireShell` para TODOS os isShellType, incluindo `rocket`. O `RocketEffect` em L1379 nunca executa durante prefire | `FireworkRenderer.tsx` L1300 | Alto |
| 2 | **`_smokeBlendColor.clone()` cria objeto por frame** — L1076 `.clone()` anula o singleton pré-alocado | `FireworkRenderer.tsx` L1076 | Médio |
| 3 | **Trail lineSegments usa `depthTest: false`** — L1023 trails renderizam sobre toda geometria | `FireworkRenderer.tsx` L1023 | Médio |

## Implementação — `src/components/editor/skycanvas/FireworkRenderer.tsx`

**Fix 1 — Rocket prefire routing (L1300):**
- Trocar `if (inPrefire)` por `if (inPrefire && pt !== 'rocket')`
- Permite rockets usar o handler dedicado L1379 com `RocketEffect`

**Fix 2 — Smoke GC (L67-68, L1076):**
- Adicionar singleton `const _smokeBlendResult = new THREE.Color();` após L68
- L1076: trocar `_smokeBlendColor.set(color).lerp(_smokeGrayTarget, 0.7).clone()` por `_smokeBlendResult.copy(_smokeBlendColor.set(color).lerp(_smokeGrayTarget, 0.7))`

**Fix 3 — Trail depthTest (L1023):**
- Trocar `depthTest={false}` por `depthTest={true}` no `lineBasicMaterial`

## Ordem

| Passo | Tarefa |
|-------|--------|
| 1 | Aplicar 3 fixes no FireworkRenderer.tsx |
| 2 | Build verification |
