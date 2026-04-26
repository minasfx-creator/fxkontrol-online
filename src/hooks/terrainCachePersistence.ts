/**
 * terrainCachePersistence — Cloud persistence for resolved terrain heights.
 *
 * Backed by `public.terrain_height_cache` (see migration). Stores one row per
 * (project_id, tileset_kind, x_tenths, z_tenths) and lets us prepopulate the
 * in-memory cache when a project re-opens, so pins "stick" to the surface
 * before Google 3D Tiles even finishes streaming.
 *
 * Design notes:
 *  - Keys mirror posKey() in useTerrainHeightCache (XZ * 10, integer).
 *  - Writes are batched + debounced to avoid hammering the API on every
 *    drift event. We track an in-memory "dirty set" of keys whose y differs
 *    from what was last persisted (or never persisted at all).
 *  - All RPCs are best-effort; failures are logged and never throw into the
 *    render loop.
 */
import { supabase } from '@/integrations/supabase/client';

// The generated Database types may not yet include `terrain_height_cache`
// (it was added in a recent migration). Fall back to an untyped client view
// for this table so the typecheck passes; runtime behavior is identical.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (table: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

export interface PersistedHeight {
  x_tenths: number;
  z_tenths: number;
  y: number;
}

export type TilesetKind = 'google3d' | 'synthetic' | 'custom';

const FLUSH_DEBOUNCE_MS = 1500;
const MAX_BATCH = 500;

/** Default cache lifetime. Rows older than this are ignored on hydrate and
 *  purged on the server. 0 disables time-based expiration (version-only). */
export const DEFAULT_MAX_AGE_DAYS = 30;
/** Bumped whenever the *meaning* of a cached y changes (e.g. coord system).
 *  Combine with the per-instance `tilesetVersion` opt — different values
 *  cause stale rows to be ignored AND purged on next mount. */
export const CACHE_SCHEMA_VERSION = 'v1';

export interface TerrainCachePersistenceHandle {
  /** Load all resolved rows for this project+tileset into the provided map.
   *  Rows older than `maxAgeDays` (if > 0) or from a different
   *  `tilesetVersion` are skipped. */
  hydrate: (cache: Map<string, number>) => Promise<number>;
  /** Mark a key as needing upload (debounced flush). */
  markDirty: (key: string, x_tenths: number, z_tenths: number, y: number) => void;
  /** Force-flush any pending writes (e.g. on unmount). */
  flush: () => Promise<void>;
  /** Server-side purge of expired/stale-version rows. Returns deleted count. */
  purgeExpired: () => Promise<number>;
  /** Server-side delete of ALL rows for the current scope. Returns deleted count. */
  clearAll: () => Promise<number>;
  /** Disable further writes/reads (cleanup). */
  dispose: () => void;
}

interface PendingRow {
  x_tenths: number;
  z_tenths: number;
  y: number;
}

/** Decode the posKey() format `${(x*10|0)}:${(z*10|0)}` back to integer tenths. */
function decodeKey(k: string): { x_tenths: number; z_tenths: number } | null {
  const i = k.indexOf(':');
  if (i < 0) return null;
  const xs = Number(k.slice(0, i));
  const zs = Number(k.slice(i + 1));
  if (!Number.isFinite(xs) || !Number.isFinite(zs)) return null;
  return { x_tenths: xs | 0, z_tenths: zs | 0 };
}

function encodeKey(x_tenths: number, z_tenths: number): string {
  return `${x_tenths}:${z_tenths}`;
}

export function createTerrainCachePersistence(opts: {
  projectId: string;
  userId: string;
  tilesetKind?: TilesetKind;
  /** Logical version label for the *current* tileset content. Bump when you
   *  know the underlying mesh changed (e.g. Google updated a region) so
   *  cached heights from the previous version are dropped. */
  tilesetVersion?: string;
  /** Max age in days; rows older than this are ignored on hydrate and
   *  deleted by purgeExpired. 0 disables time-based expiration. */
  maxAgeDays?: number;
}): TerrainCachePersistenceHandle {
  const tilesetKind: TilesetKind = opts.tilesetKind ?? 'google3d';
  const tilesetVersion = opts.tilesetVersion ?? CACHE_SCHEMA_VERSION;
  const maxAgeDays = opts.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const pending = new Map<string, PendingRow>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let flushing = false;

  async function flushNow(): Promise<void> {
    if (disposed) return;
    if (timer) { clearTimeout(timer); timer = null; }
    if (pending.size === 0 || flushing) return;
    flushing = true;
    try {
      // Drain up to MAX_BATCH rows at a time.
      const rows: Array<{
        project_id: string; user_id: string; tileset_kind: string;
        tileset_version: string;
        x_tenths: number; z_tenths: number; y: number;
      }> = [];
      const drained: string[] = [];
      for (const [k, v] of pending) {
        rows.push({
          project_id: opts.projectId,
          user_id: opts.userId,
          tileset_kind: tilesetKind,
          tileset_version: tilesetVersion,
          x_tenths: v.x_tenths,
          z_tenths: v.z_tenths,
          y: v.y,
        });
        drained.push(k);
        if (rows.length >= MAX_BATCH) break;
      }
      const { error } = await db
        .from('terrain_height_cache')
        .upsert(rows, { onConflict: 'project_id,tileset_kind,tileset_version,x_tenths,z_tenths' });
      if (error) {
        console.warn('[terrainCache] flush failed:', error.message);
        // Keep entries pending so the next flush retries.
      } else {
        for (const k of drained) pending.delete(k);
      }
    } catch (e) {
      console.warn('[terrainCache] flush threw:', e);
    } finally {
      flushing = false;
      // If there are still pending rows (overflow or new arrivals), reschedule.
      if (!disposed && pending.size > 0) {
        timer = setTimeout(() => { void flushNow(); }, FLUSH_DEBOUNCE_MS);
      }
    }
  }

  return {
    async hydrate(cache) {
      if (disposed) return 0;
      try {
        let from = 0;
        const PAGE = 1000;
        let total = 0;
        // Time-based filter: ignore rows older than maxAgeDays. Done in SQL
        // so the network payload stays small even for very old projects.
        const minUpdatedAt = maxAgeDays > 0
          ? new Date(Date.now() - maxAgeDays * 86400_000).toISOString()
          : null;
        while (true) {
          let q = db
            .from('terrain_height_cache')
            .select('x_tenths,z_tenths,y')
            .eq('project_id', opts.projectId)
            .eq('tileset_kind', tilesetKind)
            .eq('tileset_version', tilesetVersion);
          if (minUpdatedAt) q = q.gte('updated_at', minUpdatedAt);
          const { data, error } = await q.range(from, from + PAGE - 1);
          if (error) {
            console.warn('[terrainCache] hydrate failed:', error.message);
            return total;
          }
          if (!data || data.length === 0) break;
          for (const row of data) {
            const k = encodeKey(row.x_tenths, row.z_tenths);
            if (!cache.has(k)) cache.set(k, Number(row.y));
          }
          total += data.length;
          if (data.length < PAGE) break;
          from += PAGE;
        }
        return total;
      } catch (e) {
        console.warn('[terrainCache] hydrate threw:', e);
        return 0;
      }
    },
    markDirty(key, x_tenths, z_tenths, y) {
      if (disposed) return;
      pending.set(key, { x_tenths, z_tenths, y });
      if (!timer) {
        timer = setTimeout(() => { void flushNow(); }, FLUSH_DEBOUNCE_MS);
      }
    },
    async flush() {
      await flushNow();
    },
    async purgeExpired() {
      if (disposed) return 0;
      try {
        const { data, error } = await db.rpc('purge_terrain_height_cache', {
          p_project_id: opts.projectId,
          p_tileset_kind: tilesetKind,
          p_current_version: tilesetVersion,
          p_max_age_days: maxAgeDays,
        });
        if (error) {
          console.warn('[terrainCache] purge failed:', error.message);
          return 0;
        }
        const n = Number(data ?? 0);
        if (n > 0) console.log(`[terrainCache] purged ${n} stale rows`);
        return n;
      } catch (e) {
        console.warn('[terrainCache] purge threw:', e);
        return 0;
      }
    },
    dispose() {
      disposed = true;
      if (timer) { clearTimeout(timer); timer = null; }
      // Best-effort final flush is fire-and-forget (caller may also await flush()).
    },
  };
}

export const _terrainCachePersistenceInternals = { decodeKey, encodeKey };
