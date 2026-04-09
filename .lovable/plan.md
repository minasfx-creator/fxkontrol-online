

# Ciclo #68 — Sprint 15: Auto-Recovery com Backoff Exponencial

## Problema

Quando um serviço falha no boot via `safeBoot`, ele fica permanentemente desativado. Não há tentativa de re-inicialização automática — o operador precisa recarregar a página.

## Solução

Criar um `AutoRecoveryService` que monitora serviços falhados e tenta re-inicializá-los com backoff exponencial (1s → 2s → 4s → 8s → 16s, max 5 tentativas). Recuperações são reportadas como incidentes resolvidos no ClusterHealth.

## Deliverables

### 1. AutoRecoveryService — `src/core/reliability/AutoRecoveryService.ts`

Singleton que gerencia retry de serviços falhados:

```text
┌─────────────────────────────────────┐
│       AutoRecoveryService           │
│  register(label, bootFn) → void     │
│  scheduleRecovery(label) → void     │
│  getStatus() → RecoveryStatus[]     │
│  dispose() → void                   │
└─────────────────────────────────────┘
```

- `RecoverableService`: `{ label, bootFn, attempts, maxAttempts, nextRetryAt, status, timerId }`
- Backoff: `delay = 1000 * 2^attempt` (1s, 2s, 4s, 8s, 16s)
- Max 5 attempts per service
- On success: resolve boot failure incident, toast success, log recovery
- On final failure: toast critical, mark as permanently failed
- `dispose()`: clear all pending timers

### 2. EngineProvider Integration

Refactor boot sequence to use `AutoRecoveryService`:
- Register each service with its boot function
- When `safeBoot` returns `false`, call `autoRecovery.scheduleRecovery(label)`
- Track recovery results via mutable refs for conditional cleanup
- On unmount, call `autoRecovery.dispose()`

### 3. ClusterHealthService — add `reportRecovery`

New method `reportRecovery(subsystem, message)` that:
- Auto-resolves the most recent unresolved incident for that subsystem
- Adds a new `warning`-level incident noting successful recovery
- Triggers `notify()`

## Files

| Action | File |
|--------|------|
| Create | `src/core/reliability/AutoRecoveryService.ts` |
| Edit | `src/core/cluster/ClusterHealthService.ts` (add `reportRecovery`) |
| Edit | `src/orchestration/EngineProvider.tsx` (integrate auto-recovery) |

## Execution Order

| Step | Task |
|------|------|
| 1 | Create AutoRecoveryService |
| 2 | Add `reportRecovery` to ClusterHealthService |
| 3 | Integrate in EngineProvider boot sequence |
| 4 | Build verification |

