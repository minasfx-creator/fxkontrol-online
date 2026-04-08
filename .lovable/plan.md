
# Ciclo #39 — Rendering Bugs: Rocket Prefire, Smoke GC, Trail DepthTest

## Bugs Identificados

| # | Bug | Local | Impacto |
|---|-----|-------|---------|
| 1 | **Rocket prefire interceptado pelo handler genérico** — L1300 `if (inPrefire)` retorna `PrefireShell` para TODOS os isShellType, incluindo `rocket`. O código dedicado do `RocketEffect` em L1379 nunca executa durante prefire. Rockets mostram trail de shell genérico em vez de motor+exaustão | `FireworkRenderer.tsx` L1300-1311 | Alto — RocketEffect nunca renderiza durante subida |
| 2 | **`_smokeBlendColor.clone()` cria objeto por frame** — L1076 chama `.clone()` no resultado de `_smokeBlendColor.set().lerp()`, criando `new THREE.Color` a cada frame por burst ativo. Isso anula o propósito do singleton pré-alocado | `FireworkRenderer.tsx` L1076 | Médio — GC pressure não resolvida |
| 3 | **Trail lineSegments usa `depthTest: false`** — L1023 trail segments renderizam sobre toda geometria. Deveria usar `depthTest: true` (como as estrelas já usam) para oclusão por edifícios/terreno | `FireworkRenderer.tsx` L1023 | Médio — trails aparecem sobre terreno |
| 4 | **emberColor cria 2x THREE.Color no useMemo** — L203-207 cria `new THREE.Color(color)` temporário + `new THREE.Color()` final. O temporário é descartado imediatamente. Pode usar pre-allocated | `FireworkRenderer.tsx` L202-208 | Baixo — só no mount, não por frame |
| 5 | **RocketEffect L1381 condition `prefireProgress < 1` always true** — Quando rocket passa L1300, `inPrefire` é true, então nunca chega L1379. Quando chega L1379, `inPrefire` é false e `prefireProgress` pode ser 1.0, mas a condição `< 1` exclui frame exato de transição | `FireworkRenderer.tsx` L1381 | Baixo — edge case de 1 frame |

## Plano de Implementação

### Arquivo 1: `src/components/editor/skycanvas/FireworkRenderer.tsx`

**Fix 1 — Rocket prefire routing (L1300-1311):**
- Alterar o guard `if (inPrefire)` para excluir rockets:
  ```
  if (inPrefire && pt !== 'rocket') {
  ```
- Isso permite que rockets caiam no handler dedicado L1379 que renderiza `RocketEffect` durante subida + `FireworkBurst` após apogeu

**Fix 2 — Remover `.clone()` do smoke blend (L1076):**
- Pré-alocar um segundo singleton `_smokeBlendResult = new THREE.Color()` no topo do arquivo
- Em L1076, trocar:
  ```
  color={_smokeBlendColor.set(color).lerp(_smokeGrayTarget, 0.7).clone()}
  ```
  por:
  ```
  color={_smokeBlendResult.copy(_smokeBlendColor.set(color).lerp(_smokeGrayTarget, 0.7))}
  ```
  Nota: React Three Fiber aceita Color object diretamente, sem clone

**Fix 3 — Trail depthTest (L1023):**
- Trocar `depthTest={false}` por `depthTest={true}` no `lineBasicMaterial` dos trail segments
- Mantém `depthWrite={false}` para blending aditivo

**Fix 4 — Rocket prefire condition (L1381):**
- Trocar `prefireProgress < 1` por `prefireProgress <= 1` para incluir frame de transição
- Ou simplificar: renderizar RocketEffect sempre que `progress <= 0` (antes do burst)

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Fix rocket prefire routing + smoke GC + trail depthTest |
| 2 | Build verification |
