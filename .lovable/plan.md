

# Ciclo #73 — Sprint 19: Health Score Persistence Service

## Context

Database tables `health_snapshots` and `health_incidents` already exist (created in Cycle #71). The `HealthPersistenceService` and UI integration were never implemented. The Supabase types file doesn't include these tables yet — we'll use manual typing since the types auto-regenerate.

## Deliverables

### 1. Create `src/core/cluster/HealthPersistenceService.ts`

Singleton service:
- `start(projectId: string)` — begins 30s interval sampling
- Each tick: reads `clusterHealthService.getSnapshot()` and `getIncidents()`
- Upserts snapshot row to `health_snapshots` (global_score, global_level, subsystem_scores as JSONB, active_incidents, uptime_ms)
- Diffs incidents via `lastPersistedIds` Set — only inserts new incidents to `health_incidents`
- Requires authenticated session (reads `supabase.auth.getSession()`, skips if null)
- All DB writes in try/catch — never blocks UI
- `stop()` clears interval

### 2. Create `src/hooks/useHealthHistory.ts`

Hook that:
- Queries `health_snapshots` ordered by `created_at DESC`, limit param (default 60)
- Returns `{ scores: number[], loading: boolean }`
- Refreshes every 60s
- Requires auth (returns empty if not logged in)

### 3. Edit `src/orchestration/EngineProvider.tsx`

- Import `healthPersistenceService`
- Add to boot sequence via `safeBoot` with project ID from `VITE_SUPABASE_PROJECT_ID`
- Register in `autoRecoveryService`
- Stop on unmount

### 4. Edit `src/components/editor/cluster/ClusterHealthTab.tsx`

- Import `useHealthHistory` and `Sparkline`
- Add sparkline above HealthRing showing last 60 scores with "Last 30min" label
- Render only when scores array has 2+ points

## Files

| Action | File |
|--------|------|
| Create | `src/core/cluster/HealthPersistenceService.ts` |
| Create | `src/hooks/useHealthHistory.ts` |
| Edit | `src/orchestration/EngineProvider.tsx` |
| Edit | `src/components/editor/cluster/ClusterHealthTab.tsx` |

## Execution Order

1. Create HealthPersistenceService
2. Create useHealthHistory hook
3. Integrate in EngineProvider
4. Add sparkline to ClusterHealthTab
5. Build verification

