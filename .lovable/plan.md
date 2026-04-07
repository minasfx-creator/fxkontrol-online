

# Limpeza Total — Fase 3: Core Modules Mortos + modules/ai/

## RESUMO

Remoção de **39 arquivos** e **~5.078 LOC** de código morto em `src/core/` e `modules/ai/` — zero referências no app React.

---

## CATEGORIA 1 — `modules/ai/` Inteiro (898 LOC, 12 arquivos)

O diretório `modules/ai/` contém 6 arquivos `.ts` + 6 duplicatas `.cjs`. **Nenhum** é importado pelo app — o React usa `useAICoPilotStore`, `AICoPilotPanel`, `AICoPilotOverlay` e `FXKAssistant.tsx` (todos em `src/`).

**Ação**: Remover `modules/ai/` inteiro.

---

## CATEGORIA 2 — `src/core/` Módulos Sem Importação (27 arquivos, 4.180 LOC)

| Subdiretório | Arquivos Mortos | LOC |
|---|---|---|
| `drones/` | `droneLOD.ts`, `dronePhysicsEngine.ts` | 400 |
| `simulation/` | `fixedTimestep.ts` | 79 |
| `network/` | `realtimeClient.ts` | 106 |
| `environment/` | `sunSystem.ts` | 150 |
| `execution/` | `droneExecutor.ts`, `pyroExecutor.ts` | 190 |
| `interaction/` | `terrainRaycaster.ts` | 210 |
| `performance/` | `aiOptimizer.ts`, `memoryManager.ts` | 401 |
| `project/` | `projectManager.ts` | 133 |
| `state/` | `stateBuffer.ts` | 46 |
| `system/` | `eventBus.ts` | 83 |
| `reliability/` | `autoHealEngine`, `blackBoxRecorder`, `emergencySystem`, `predictiveEngine`, `realityEngine`, `selfDiagnostic` | 993 |
| `sync/` | `clusterSyncHook`, `globalClockAdapter`, `globalSyncEngine`, `latencyCompensator`, `multiSiteSyncEngine`, `multiSiteValidator` | 1.139 |
| `time/` | `frameTimeService`, `timecodeProvider` | 250 |

**Nota**: Arquivos com referências ativas são **preservados** (`autoScaler`, `lockstepEngine`, `seededRandom`, `clusterSyncEngine`, `frameSyncEngine`, `unrealBridge`, `deterministicClock`, `simulationValidator`, `cinematicSequencer`, `geoCamera`, `environmentEngine`, `executionBridge`, `exportEngine`).

**Ação**: Remover os 27 arquivos mortos. Remover diretórios vazios resultantes (`simulation/`, `interaction/`, `performance/`, `project/`, `state/`, `system/`). Atualizar `src/core/reliability/index.ts` se exportar módulos removidos.

---

## ORDEM DE EXECUÇÃO

| Passo | Tarefa |
|---|---|
| 1 | Remover `modules/ai/` inteiro (12 arquivos) |
| 2 | Remover 27 arquivos mortos de `src/core/` |
| 3 | Atualizar barrel exports (`reliability/index.ts`) |
| 4 | Verificar build (`npx vite build`) |

## IMPACTO

| Categoria | Arquivos | LOC |
|---|---|---|
| `modules/ai/` | 12 | 898 |
| `src/core/` dead | 27 | 4.180 |
| **Total** | **39** | **~5.078** |

**Acumulado Fases 1+2+3**: ~100+ arquivos, ~9.500+ LOC eliminados.

