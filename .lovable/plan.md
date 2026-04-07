

# Otimização e Hardening Total da Plataforma FX KONTROL

---

## RESUMO

Execução combinada de 4 frentes: (1) Fase 3 pendente de limpeza, (2) Integração completa do hardening engine no runtime, (3) Otimização de performance do SkyCanvas, (4) Proteções de segurança de rede e dados.

---

## PARTE 1 — Fase 3 Pendente: Remoção de Código Morto (~20 arquivos)

A Fase 3 foi aprovada mas não executada. Arquivos a remover:

| Arquivo | LOC | Motivo |
|---|---|---|
| `modules/ai/` (12 arquivos) | ~900 | Zero imports no app React |
| `src/core/drones/droneLOD.ts` | ~160 | Zero imports (LOD integrado no InstancedDroneSwarm) |
| `src/core/drones/dronePhysicsEngine.ts` | ~240 | Zero imports |
| `src/core/reliability/predictiveEngine.ts` | ~150 | Só exportado pelo barrel, nunca consumido pelo app |
| `src/core/reliability/realityEngine.ts` | ~170 | Idem |
| `src/core/reliability/emergencySystem.ts` | ~150 | Idem |
| `src/core/reliability/selfDiagnostic.ts` | ~180 | Idem (feedDiagnosticFps nunca chamado) |
| `src/core/sync/clusterSyncHook.ts` | ~100 | Zero imports fora do barrel |
| `src/core/sync/globalClockAdapter.ts` | ~120 | Idem |
| `src/core/sync/globalSyncEngine.ts` | ~200 | Idem |
| `src/core/sync/multiSiteSyncEngine.ts` | ~250 | Idem |
| `src/core/sync/multiSiteValidator.ts` | ~200 | Idem |

**Preservados** (têm imports ativos): `blackBoxRecorder`, `autoHealEngine`, `latencyCompensator`, `autoScaler`, `lockstepEngine`, `seededRandom`, `frameSyncEngine`, `clusterSyncEngine`, `unrealBridge`.

**Atualizar** `src/core/reliability/index.ts` — remover re-exports dos módulos deletados.

---

## PARTE 2 — Hardening Engine: Integração Completa

O hardening engine (`src/lib/hardening/`) tem 4 módulos prontos mas **parcialmente integrados**:

| Módulo | Status Atual | Ação |
|---|---|---|
| `runtimeSafety` — watchdog + crash loop | ✅ Ativo via `HardeningWatchdog` | — |
| `runtimeSafety` — `scanSceneTransforms` | ❌ Nunca chamado | Integrar no `HardeningWatchdog` (scan a cada 60 frames) |
| `runtimeSafety` — `checkFrameBudget` | ❌ Nunca chamado | Integrar no watchdog — acionar degradação se over-budget |
| `runtimeSafety` — `getDegradationLevel` / `onDegradationChange` | ❌ Nunca consumido | Conectar ao `FXKQualityController` para unificar degradação |
| `gpuMemoryManager` — `checkSceneHealth` | ❌ Nunca chamado | Chamar a cada 5s no watchdog, logar warnings |
| `gpuMemoryManager` — `deepDispose` | ❌ Nunca chamado | Usar no `ContextLossGuard` ao receber `webglcontextlost` |
| `gpuMemoryManager` — `textureCache/geometryCache` | ❌ Nunca usados | Integrar nos loaders de assets 3D (SiteModelRenderer) |
| `assetGate` — `validateAssetFile` | ❌ Nunca chamado | Integrar no importador VVIZ e nos uploads de assets |
| `observability` — `recordContextLoss` | ✅ Ativo | — |

### Implementação

**A. `HardeningWatchdog` expandido** — Adicionar ao componente existente:
- `scanSceneTransforms(scene)` a cada frame (já throttled internamente a 60 frames)
- `checkSceneHealth(gl)` a cada 300 frames (~5s)
- `checkFrameBudget(frameTime, drawCalls, triangles)` — se `withinBudget === false` por 3 checks consecutivos, chamar `pushLog` com warning

**B. Unificar degradação** — Conectar `onDegradationChange` do hardening ao `useFXKUltraRefinement`:
- Se `getDegradationLevel()` retornar `severe` ou `critical`, forçar `qualityIndex` para `performance`/`safe`
- Eliminar lógica duplicada de crash cooldown (existe no hardening E no useFXKUltraRefinement)

**C. `ContextLossGuard` reforçado** — No handler de `webglcontextlost`:
- Chamar `deepDispose(scene)` antes do remount
- Chamar `disposeAllTracked()` para limpar recursos rastreados

**D. Asset validation gate** — Nos componentes de upload:
- Chamar `validateAssetFile(file)` antes de processar qualquer upload de modelo 3D
- Bloquear e mostrar toast com os erros se `valid === false`

---

## PARTE 3 — Otimização de Performance do SkyCanvas

### 3A. Eliminar duplicação de contexto-loss handling

Atualmente existem **dois** sistemas de crash recovery executando em paralelo:
1. `ContextLossGuard` (linha 318) — usa `reportCrash()` do hardening
2. `useFXKUltraRefinement` (linha 124) — tem seu próprio `handleContextLoss()`

**Ação**: Remover o listener de `webglcontextlost` do `useFXKUltraRefinement`, mantendo apenas o `ContextLossGuard` como single source of truth.

### 3B. Throttle do `useSceneStore.getState()` inline

Nas linhas 1682-1704 do SkyCanvas, há chamadas `useSceneStore.getState()` dentro do JSX render (botões Lock/Rulers). Isto re-executa a cada render.

**Ação**: Extrair para seletores Zustand no topo do componente (`const lockPositions = useSceneStore(st => st.environment.lockPositions)`).

### 3C. Memoização de callbacks geo-tools

`handlePlaceMarker`, `handleFinishRuler`, `handleFinishPath` recriam closures a cada render por dependerem de `.length`.

**Ação**: Usar refs para os contadores em vez de state `.length` nas dependências.

### 3D. Canvas `resize` debounce

O `ResizeObserver` com `setTimeout(150)` dispara `window.dispatchEvent(new Event('resize'))` que força recálculo global.

**Ação**: Já existe `resize={{ debounce: 50 }}` no Canvas — remover o ResizeObserver manual (linha 1491) pois é redundante.

---

## PARTE 4 — Hardening de Rede e Dados

### 4A. Proteção da API key do Google Maps

Linha 1464: a API key é exposta no URL do fetch client-side. Já vem de edge function, mas a URL resultante fica no Network tab.

**Ação**: Mover o fetch da imagem satélite para a edge function (proxy) — a key nunca sai do servidor.

### 4B. Error boundaries por subsistema

Atualmente há um `WebGLErrorBoundary` global. Se qualquer componente dentro do Canvas crashar, todo o viewport cai.

**Ação**: Envolver subsistemas pesados em `<Suspense>` + `<ErrorBoundary>` individuais:
- `DroneRendererSwitch` (swarm rendering)
- `TimelineEffects` + `LiveSFXEffects` (pirotecnia)
- `GoogleTilesLayer` + `GeoCameraController` (Google Earth)
- `PostProcessing` (post-processing)

---

## ORDEM DE EXECUÇÃO

| Passo | Tarefa | Impacto |
|---|---|---|
| 1 | Remover `modules/ai/` + dead core files | -2.500 LOC |
| 2 | Atualizar `reliability/index.ts` barrel | Fixes imports |
| 3 | Expandir `HardeningWatchdog` (scanTransforms + checkHealth + checkBudget) | Runtime protection |
| 4 | Unificar degradação (hardening ↔ FXKUltraRefinement) | Elimina duplicação |
| 5 | Reforçar `ContextLossGuard` com deepDispose | Previne memory leaks |
| 6 | Remover context-loss handler duplicado do useFXKUltraRefinement | Cleanup |
| 7 | Otimizar SkyCanvas (inline getState, ResizeObserver, callbacks) | -renders/frame |
| 8 | Adicionar error boundaries por subsistema | Resiliência |
| 9 | Build verification | Estabilidade |

