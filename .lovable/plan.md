

# Ciclo #54 — Sprint 1 Kernel: Análise e Plano

## Diagnóstico: O que JÁ existe vs o que é pedido

| Componente Pedido | Já Existe? | Onde | Avaliação |
|---|---|---|---|
| FixedClock (tick discreto 16.67ms) | **SIM** — `DeterministicClock` | `src/core/time/deterministicClock.ts` | Mais completo que o pedido: drift correction, SMPTE sync, monotonic guards, zero-GC callbacks |
| LockstepEngine (60Hz fixed step) | **SIM** — `LockstepEngine` | `src/core/reliability/lockstepEngine.ts` | Priority-sorted subsystems, accumulator, fixed DT, perf tracking |
| SafetyValidator | **SIM** — `SimulationValidator` | `src/core/validation/simulationValidator.ts` | Geofence, collision, altitude, timing validation |
| CommandBus | **NÃO** | — | Não existe — único componente novo real |
| EngineProvider | **PARCIAL** — `FXKEngine` | `src/core/engine/fxkEngine.ts` | Orchestrator existe mas sem React bridge provider |
| FXK Orchestrator | **SIM** | `src/core/engine/fxkEngine.ts` | Já integra environment, cluster, unreal, AI, timeline, firework |

## Problema Central

**O projeto já possui 80% do que o Sprint 1 pede**, em versões mais robustas. Criar os ficheiros propostos introduziria:

1. **Duplicação** — `FixedClock` vs `DeterministicClock` (que já tem SMPTE sync, drift correction)
2. **Conflito de nomes** — novo `LockstepEngine` em `core/engine/` vs existente em `core/reliability/`
3. **Regressão** — o `LockstepEngine` existente já é usado pelo pipeline; substituí-lo quebraria subsystems registados

## Plano: Adicionar o que FALTA sem duplicar

### 1. CommandBus (NOVO) — `src/core/command/CommandBus.ts`

Único componente genuinamente ausente. Criar com tipos extensíveis:

```ts
export type Command =
  | { type: 'OPEN_PANEL'; panel: string }
  | { type: 'CLOSE_PANEL' }
  | { type: 'FIRE'; payload?: any }
  | { type: 'ARM_SYSTEM' }
  | { type: 'DISARM_SYSTEM' }
  | { type: 'E_STOP' };
```

Singleton `commandBus` com `dispatch()` e `drain()`. Zero-GC: reusa array interno.

### 2. Integrar CommandBus no LockstepEngine EXISTENTE

Adicionar ao `LockstepEngine` em `src/core/reliability/lockstepEngine.ts`:
- Import `commandBus`
- No início de `tick()`, antes de avançar subsystems: `drain()` commands e aplicar via handler registry
- Adicionar `registerHandler(type, fn)` para subsystems receberem commands

### 3. EngineProvider (NOVO) — `src/orchestration/EngineProvider.tsx`

React bridge que:
- Inicia `deterministicClock` + `lockstep` no mount
- Conecta `deterministicClock.onTick` → `lockstep.tick`
- Cleanup no unmount

### 4. Refactor pontual no Index.tsx

Converter 2-3 ações diretas (e.g. `setActivePanel`) para usar `commandBus.dispatch()` como prova de conceito. NÃO refatorar tudo — apenas demonstrar o padrão.

## Ficheiros

| Ação | Ficheiro |
|------|---------|
| Criar | `src/core/command/CommandBus.ts` |
| Editar | `src/core/reliability/lockstepEngine.ts` (integrar command drain) |
| Criar | `src/orchestration/EngineProvider.tsx` |
| Editar | `src/pages/Index.tsx` (2-3 dispatch exemplos) |

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Criar CommandBus |
| 2 | Integrar drain no LockstepEngine existente |
| 3 | Criar EngineProvider |
| 4 | Refactor pontual no Index |
| 5 | Build verification |

