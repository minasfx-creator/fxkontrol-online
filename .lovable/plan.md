

# Ciclo #39 — Rendering Bugs: Rocket Prefire, Smoke GC, Trail DepthTest

## Bugs Identificados

| # | Bug | Local | Impacto |
|---|-----|-------|---------|
| 1 | **Rocket prefire interceptado pelo handler genérico** — L1300 `if (inPrefire)` retorna `PrefireShell` para TODOS os tipos shell, incluindo `rocket`. O `RocketEffect` dedicado em L1379 nunca executa durante a fase de subida — rockets usam trail genérico de shell em vez de motor+exaustão | `FireworkRenderer.tsx` L1300 | Alto |
| 2 | **`_smokeBlendColor.clone()` cria objeto por frame** — L1076 chama `.clone()` no singleton, criando `new THREE.Color` a cada frame por burst ativo, anulando a otimização GC-free do Ciclo #38 | `FireworkRenderer.tsx` L1076 | Médio |
| 3 | **Trail lineSegments usa `depthTest: false`** — L1023 trails renderizam sobre toda geometria sólida (edifícios, terreno). Estrelas já usam `depthTest: true` desde o Ciclo #38, mas trails ficaram inconsistentes | `FireworkRenderer.tsx` L1023 | Médio |

## Implementação — `src/components/editor/skycanvas/FireworkRenderer.tsx`

**Fix 1 — Rocket prefire routing (L1300):**
- Trocar `if (inPrefire)` por `if (inPrefire && pt !== 'rocket')`
- Rockets caem no handler dedicado L1379 que renderiza `RocketEffect` durante subida + `FireworkBurst` após apogeu

**Fix 2 — Smoke GC fix (L67-68 + L1076):**
- Adicionar singleton `const _smokeBlendResult = new THREE.Color()` após L68
- L1076: trocar `.clone()` por `.copy()` no resultado — `_smokeBlendResult.copy(_smokeBlendColor.set(color).lerp(_smokeGrayTarget, 0.7))`

**Fix 3 — Trail depthTest (L1023):**
- Trocar `depthTest={false}` por `depthTest={true}` no `lineBasicMaterial` dos trail segments

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Aplicar 3 fixes no FireworkRenderer.tsx |
| 2 | Build verification |

