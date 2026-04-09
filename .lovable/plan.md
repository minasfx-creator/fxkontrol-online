

# Ciclo #66 — Sprint 13: Service Registry Centralizado

## Problema Atual

O `ClusterHealthService` conhece cada subsistema diretamente via imports hardcoded (`safetyStateMachine`, `getPerfAlerts`, `networkHealthService`). Adicionar novos serviços requer editar a classe. Não há interface padronizada — cada subsistema é consultado de forma ad-hoc.

## Solução

Criar um `ServiceRegistry` com interface `HealthReporter` que cada serviço implementa. O `ClusterHealthService` passa a consultar apenas serviços registrados, eliminando imports diretos e permitindo extensibilidade plug-and-play.

## Deliverables

### 1. ServiceRegistry — `src/core/cluster/ServiceRegistry.ts`

```text
┌──────────────────────────────────┐
│         ServiceRegistry          │
│  Map<string, HealthReporter>     │
│  register(reporter) → unsub     │
│  getAll() → HealthReporter[]     │
│  get(id) → HealthReporter|null   │
└──────────────────────────────────┘
         ▲        ▲        ▲
   SafetyReporter  PerfReporter  NetReporter
```

**`HealthReporter` interface:**
- `id: string` — unique subsystem ID
- `label: string` — display name
- `weight: number` — 0–1 weight for global score
- `getHealth(): SubsystemHealth` — current health snapshot
- `getAlertCount(): number` — active alert count for incident detection

**`ServiceRegistry` class:**
- `register(reporter: HealthReporter): () => void` — returns unsubscribe
- `getAll(): HealthReporter[]`
- `get(id: string): HealthReporter | null`
- Singleton export: `serviceRegistry`

### 2. Health Reporter Adapters — `src/core/cluster/reporters/`

Three adapter files that wrap existing services into `HealthReporter`:

- **`SafetyHealthReporter.ts`** — wraps `safetyStateMachine` + `safetyAuditTrail`, self-registers on import
- **`PerformanceHealthReporter.ts`** — wraps `getFrameHistory` + `getActiveAlerts`, self-registers
- **`NetworkHealthReporter.ts`** — wraps `networkHealthService` + `fieldBus`, self-registers

Each moves the existing scoring logic from `ClusterHealthService` private methods into the reporter's `getHealth()`.

### 3. Refactor ClusterHealthService

- Remove hardcoded `getSafetyHealth()`, `getPerformanceHealth()`, `getNetworkHealth()` methods
- Replace with `serviceRegistry.getAll().map(r => r.getHealth())`
- Compute `globalScore` from dynamic weights: `sum(score * weight) / sum(weights)`
- Incident detection via `reporter.getAlertCount()` delta tracking per registered service
- Remove direct imports of safety/perf/network modules

### 4. EngineProvider Integration

- Import reporters in EngineProvider so they self-register on boot
- No other changes needed — ClusterHealthService already started

### 5. ClusterHealthTab Update

- `SubsystemId` becomes `string` (dynamic, not union)
- Subsystem icon selection uses a map with fallback
- No breaking changes to existing UI

## Files

| Action | File |
|--------|------|
| Create | `src/core/cluster/ServiceRegistry.ts` |
| Create | `src/core/cluster/reporters/SafetyHealthReporter.ts` |
| Create | `src/core/cluster/reporters/PerformanceHealthReporter.ts` |
| Create | `src/core/cluster/reporters/NetworkHealthReporter.ts` |
| Edit | `src/core/cluster/ClusterHealthService.ts` (use registry) |
| Edit | `src/orchestration/EngineProvider.tsx` (import reporters) |
| Edit | `src/components/editor/cluster/ClusterHealthTab.tsx` (dynamic subsystem IDs) |

## Execution Order

| Step | Task |
|------|------|
| 1 | Create ServiceRegistry + HealthReporter interface |
| 2 | Create 3 reporter adapters |
| 3 | Refactor ClusterHealthService to use registry |
| 4 | Update EngineProvider imports |
| 5 | Update ClusterHealthTab for dynamic IDs |
| 6 | Build verification |

