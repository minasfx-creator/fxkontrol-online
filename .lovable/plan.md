

# Ciclo #71 — Sprint 18: Health Score Persistence

## Problema

Health scores e incidentes existem apenas em memória (ring buffer de 200 entradas). Ao recarregar a página, todo o histórico é perdido. Não há como analisar tendências temporais ou gerar dashboards de saúde ao longo do tempo.

## Solução

Criar duas tabelas no banco (`health_snapshots` e `health_incidents`) para persistir periodicamente o global score e os incidentes. Um `HealthPersistenceService` no client faz flush a cada 30s dos dados acumulados. O `ClusterHealthTab` ganha um mini trend chart com sparkline do histórico de scores.

## Deliverables

### 1. Database Tables (Migration)

```sql
-- health_snapshots: periodic health score samples
CREATE TABLE public.health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  global_score integer NOT NULL,
  global_level text NOT NULL,
  subsystem_scores jsonb NOT NULL DEFAULT '{}',
  active_incidents integer NOT NULL DEFAULT 0,
  uptime_ms bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own health snapshots"
  ON public.health_snapshots FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- health_incidents: persisted incident log
CREATE TABLE public.health_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  incident_id text NOT NULL,
  subsystem text NOT NULL,
  severity text NOT NULL,
  message text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  incident_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.health_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own health incidents"
  ON public.health_incidents FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for time-range queries
CREATE INDEX idx_health_snapshots_created ON public.health_snapshots(user_id, created_at DESC);
CREATE INDEX idx_health_incidents_created ON public.health_incidents(user_id, created_at DESC);
```

### 2. HealthPersistenceService — `src/core/cluster/HealthPersistenceService.ts`

Singleton service that:
- Samples `clusterHealthService.getSnapshot()` every 30s
- Batches and upserts to `health_snapshots` (score, level, subsystem scores as JSONB)
- Diffs incidents — only inserts new/updated incidents to `health_incidents`
- Requires authenticated user (skips if no session)
- Tracks `lastPersistedIncidentIds` to avoid duplicates
- `start(projectId)` / `stop()` lifecycle
- Graceful: all DB writes wrapped in try/catch, never blocks the UI

### 3. EngineProvider Integration

- Import and start `HealthPersistenceService` in boot sequence via `safeBoot`
- Pass current project ID (from URL or context)
- Register in `autoRecoveryService` for graceful degradation
- Stop on unmount

### 4. Health Trend Sparkline in ClusterHealthTab

- New hook `useHealthHistory(limit=60)` that queries `health_snapshots` ordered by `created_at DESC`
- Renders existing `Sparkline` component above the HealthRing showing last 60 data points
- Shows time range label (e.g., "Last 30min")
- Loads on mount, refreshes every 60s

## Files

| Action | File |
|--------|------|
| Migration | Create `health_snapshots` + `health_incidents` tables |
| Create | `src/core/cluster/HealthPersistenceService.ts` |
| Edit | `src/orchestration/EngineProvider.tsx` (add persistence boot) |
| Edit | `src/components/editor/cluster/ClusterHealthTab.tsx` (add trend sparkline) |

## Execution Order

| Step | Task |
|------|------|
| 1 | Create database tables via migration |
| 2 | Create HealthPersistenceService |
| 3 | Integrate in EngineProvider |
| 4 | Add trend sparkline to ClusterHealthTab |
| 5 | Build verification |

