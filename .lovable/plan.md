

# Ciclo #85 — Bug Fixes & Improvements Audit

## Bugs Found

### BUG 1 — `useRenderCounter` violates Rules of Hooks (P0)
**File**: `src/hooks/useRenderCounter.ts`  
**Issue**: Early return before `useRef` on line 42-44. React hooks cannot be called conditionally.
```typescript
if (!import.meta.env.DEV) return;  // ← early return
const ref = useRef(0);             // ← hook called after conditional return
```
This will crash in production or trigger React warnings. The conditional must wrap the *logic*, not gate the hooks.

**Fix**: Move `useRef` before the guard, make the logging conditional instead.

---

### BUG 2 — Google 3D Tiles: Missing DRACOLoader (P1)
**File**: `src/core/geo/GoogleTilesEngine.tsx`  
**Issue**: Console shows `THREE.GLTFLoader: No DRACOLoader instance provided.` repeatedly. Google's Photorealistic 3D Tiles use Draco-compressed meshes. The `TilesRenderer` initializes without a `DRACOLoader`, causing all tile loads to fail.

**Fix**: Register a `GLTFLoader` with `DRACOLoader` set up (using CDN decoder path from three.js). Use the `GLTFExtensionsPlugin` from `3d-tiles-renderer/plugins` to attach the configured loader.

---

### BUG 3 — `HealthPersistenceService` writes to non-existent tables (P1)
**Files**: `src/core/cluster/HealthPersistenceService.ts`, `src/hooks/useHealthHistory.ts`  
**Issue**: Uses `supabase.from('health_snapshots' as any)` and `supabase.from('health_incidents' as any)`. The `as any` cast hides the fact that these tables don't exist in the database schema (not in `types.ts`). Every 30s flush silently fails.

**Fix**: Create `health_snapshots` and `health_incidents` tables via migration, or remove the persistence service if not needed. Tables need proper RLS policies.

---

### BUG 4 — `lastPersistedIds` memory leak in `HealthPersistenceService` (P2)
**File**: `src/core/cluster/HealthPersistenceService.ts`  
**Issue**: `lastPersistedIds` Set grows unbounded — every incident ID is added, never removed. Over long sessions this leaks memory.

**Fix**: Clear and rebuild from current incidents on each flush cycle, or cap the Set size.

---

## Improvements

### IMP 1 — `ClusterHealthService` polls at 500ms with no backoff (P2)
**File**: `src/core/cluster/ClusterHealthService.ts`  
**Issue**: Polls every 500ms unconditionally via `setInterval`, even when idle. Wastes CPU.

**Fix**: Use adaptive polling — 500ms during active incidents, 5s when healthy.

---

### IMP 2 — `SnapshotManager.restore` uses `as any` casts (P2)
**File**: `src/core/state/SnapshotManager.ts`  
**Issue**: 4 `as any` casts on `structuredClone` results suggest type mismatch between snapshot schema and store types. Fragile — won't catch schema drift.

**Fix**: Type the `Snapshot.state` interface to match the store slice, eliminating casts.

---

## Execution Plan

| Step | Action | File(s) |
|------|--------|---------|
| 1 | Fix `useRenderCounter` hook order violation | `src/hooks/useRenderCounter.ts` |
| 2 | Add DRACOLoader to GoogleTilesEngine | `src/core/geo/GoogleTilesEngine.tsx` |
| 3 | Create DB migration for health tables + RLS | Migration SQL |
| 4 | Cap `lastPersistedIds` + adaptive polling | `HealthPersistenceService.ts`, `ClusterHealthService.ts` |
| 5 | Build verification | `tsc --noEmit` |

## Expected Impact
- **BUG 1**: Prevents production crash from hooks violation
- **BUG 2**: Enables Google 3D Tiles to actually render (currently 100% broken)
- **BUG 3**: Health telemetry starts persisting to real tables
- **BUG 4 + IMP 1**: Reduces memory/CPU waste in long sessions

