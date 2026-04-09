

# Ciclo #67 — Sprint 14: Graceful Degradation no EngineProvider

## Problema

O boot atual no EngineProvider é sequencial e sem proteção — se `startProfiler()`, `networkHealthService.start()`, ou qualquer reporter lançar exceção, todo o boot falha silenciosamente ou crasheia o componente. Não há isolamento entre serviços.

## Solução

Envolver cada fase de boot num `try/catch` isolado usando uma helper `safeBoot()`. Falhas são capturadas, logadas, reportadas como incidentes no `ClusterHealthService`, e exibidas via toast — mas os demais serviços continuam funcionando.

## Deliverables

### 1. Helper `safeBoot` — inline no EngineProvider

```typescript
function safeBoot(label: string, fn: () => void): boolean {
  try { fn(); return true; }
  catch (e) {
    console.error(`[EngineProvider] ${label} failed:`, e);
    clusterHealthService.reportBootFailure(label, String(e));
    toast.error(`⚠ ${label} falhou no boot — sistema degradado`);
    return false;
  }
}
```

### 2. Boot sequence com isolamento

Cada serviço no boot envolvido individualmente:
- `safeBoot('DeterministicClock', () => deterministicClock.start())`
- `safeBoot('LockstepEngine', () => lockstep.start())`
- `safeBoot('PerformanceProfiler', () => startProfiler())`
- `safeBoot('NetworkHealth', () => networkHealthService.start())`

Cleanup condicional — só chama `stop()` de serviços que bootaram com sucesso.

### 3. Boot failure tracking no ClusterHealthService

Adicionar método `reportBootFailure(subsystem, error)` que cria um incidente `critical` no histórico existente. Sem alteração de arquitetura — reutiliza o mecanismo de incidentes já implementado.

### 4. Async boot (IndexedDB load) — já tem try/catch

A fase async de load do IndexedDB já está protegida. Apenas adicionar reporte ao ClusterHealth em caso de falha.

## Files

| Action | File |
|--------|------|
| Edit | `src/orchestration/EngineProvider.tsx` (safeBoot wrapper + isolamento) |
| Edit | `src/core/cluster/ClusterHealthService.ts` (add `reportBootFailure`) |

## Execution Order

| Step | Task |
|------|------|
| 1 | Add `reportBootFailure` to ClusterHealthService |
| 2 | Refactor EngineProvider boot with `safeBoot` isolation |
| 3 | Build verification |

