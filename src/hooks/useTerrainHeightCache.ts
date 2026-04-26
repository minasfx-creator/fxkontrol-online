/**
 * useTerrainHeightCache — Caches terrain Y heights for position XZ coordinates.
 *
 * Raycasts against the Google 3D Tiles mesh to find the terrain surface so
 * positions/effects render ON TOP of the terrain, not below or floating above
 * an outdated LOD.
 *
 * Reliability rules (matches "Terrain Sync" memory):
 *  - Cache values are *resolved* hits only. A miss is recorded as `undefined`
 *    so we keep retrying instead of pinning the entry to 0 and burying pins.
 *  - The cache is invalidated whenever the loaded tile set changes
 *    (mesh count delta) or when a re-sample reveals a height drift > 0.5 m.
 *    This prevents stale heights when Google streams in higher-LOD tiles.
 *  - On every frame, any *unresolved* position is sampled immediately (cheap,
 *    handful of rays) so newly-added pins never render at y=0.
 *  - Resolved positions are re-validated in batches at a slower cadence.
 */
import { useRef, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { terrainMetrics } from './terrainCacheMetrics';
import { useTerrainCacheConfig } from './useTerrainCacheConfig';
import { createTerrainCachePersistence, type TerrainCachePersistenceHandle, type TilesetKind } from './terrainCachePersistence';

const _ray = new THREE.Raycaster();
const _origin = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);

// Defaults are now defined in useTerrainCacheConfig.TERRAIN_CACHE_DEFAULTS.
// The hot path reads the latest values via useTerrainCacheConfig.getState()
// each frame so operator-driven slider changes take effect immediately.

export interface TerrainHeightCache {
  /**
   * Get cached terrain Y for a given XZ position. Returns 0 if no terrain hit yet.
   *
   * One-shot fallback: when the position is not in the cache and the tiles
   * group is currently in the scene, performs a synchronous raycast and
   * caches the result, so newly created pins land on the surface on the
   * very first render instead of dropping to y=0.
   */
  getHeight: (x: number, z: number) => number;
  /** True iff a terrain hit has been resolved for this XZ (cached). */
  isResolved: (x: number, z: number) => boolean;
  /** Raw map for direct access */
  heights: Map<string, number>;
}

function posKey(x: number, z: number): string {
  return `${(x * 10 | 0)}:${(z * 10 | 0)}`;
}

/** One-shot downward raycast against the tiles group. Returns null on miss. */
function sampleTerrain(tilesGroup: THREE.Object3D, x: number, z: number): number | null {
  _origin.set(x, 2000, z);
  _ray.set(_origin, _down);
  _ray.far = 4000;
  const hits = _ray.intersectObject(tilesGroup, true);
  return hits.length > 0 ? hits[0].point.y : null;
}

/**
 * Hook that maintains a cache of terrain heights by raycasting
 * against the Google 3D Tiles mesh group in the scene.
 *
 * @param positions - Array of {x, z} positions to track
 * @param enabled - Whether terrain height querying is active (e.g. google3DTilesEnabled)
 */
export interface TerrainCachePersistenceOptions {
  /** Project this cache belongs to (rows are scoped per project). */
  projectId: string;
  /** Owner user (RLS requires it on insert). */
  userId: string;
  /** Defaults to 'google3d'. Use a different value if you want isolated caches per tileset. */
  tilesetKind?: TilesetKind;
  /** Logical version label for the current tileset content. Stale-version rows
   *  are skipped on hydrate and purged on mount. Defaults to CACHE_SCHEMA_VERSION. */
  tilesetVersion?: string;
  /** Max age in days for cached rows; older rows are ignored & purged. 0 = unlimited. */
  maxAgeDays?: number;
}

export function useTerrainHeightCache(
  positions: { x: number; z: number }[],
  enabled: boolean,
  persistence?: TerrainCachePersistenceOptions,
): TerrainHeightCache {
  const { scene } = useThree();
  // Resolved Y values (positions actually sitting on a tile mesh)
  const cacheRef = useRef<Map<string, number>>(new Map());
  const frameRef = useRef(0);
  const revalidateIndexRef = useRef(0);
  // Tracks the last-seen tile mesh count; a delta means LOD changed → revalidate
  const lastMeshCountRef = useRef(0);
  // Latest reference to the tiles group; used by the one-shot fallback in getHeight()
  const tilesGroupRef = useRef<THREE.Object3D | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // ── Cloud persistence (optional) ──
  // Recreate the handle when the project/user/tileset identity changes; on
  // hydrate, prepopulate the cache so pins snap to the surface immediately,
  // before Google 3D Tiles even start streaming.
  const persistenceRef = useRef<TerrainCachePersistenceHandle | null>(null);
  const persistKey = persistence
    ? `${persistence.projectId}:${persistence.userId}:${persistence.tilesetKind ?? 'google3d'}:${persistence.tilesetVersion ?? 'v1'}:${persistence.maxAgeDays ?? 30}`
    : '';
  useEffect(() => {
    if (!persistence || !persistence.projectId || !persistence.userId) {
      persistenceRef.current?.dispose();
      persistenceRef.current = null;
      return;
    }
    const handle = createTerrainCachePersistence({
      projectId: persistence.projectId,
      userId: persistence.userId,
      tilesetKind: persistence.tilesetKind,
      tilesetVersion: persistence.tilesetVersion,
      maxAgeDays: persistence.maxAgeDays,
    });
    persistenceRef.current = handle;
    // 1) Purge stale rows (other version OR > maxAgeDays). Best-effort, fire-and-forget.
    void handle.purgeExpired();
    // 2) Hydrate; new entries do not overwrite existing in-memory ones.
    void handle.hydrate(cacheRef.current).then((n) => {
      if (n > 0) {
        terrainMetrics.setCacheSize(cacheRef.current.size);
        console.log(`[terrainCache] hydrated ${n} resolved heights from cloud`);
      }
    });
    return () => {
      void handle.flush();
      handle.dispose();
      if (persistenceRef.current === handle) persistenceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistKey]);

  useFrame(() => {
    const _t0 = performance.now();
    if (!enabled || positions.length === 0) {
      // When tiles are disabled, drop the cache so we don't reuse stale values
      if (cacheRef.current.size > 0) cacheRef.current.clear();
      tilesGroupRef.current = null;
      terrainMetrics.setTrackedPositions(positions.length);
      terrainMetrics.setCacheSize(0);
      terrainMetrics.setTilesGroupFound(false);
      terrainMetrics.recordFrame(performance.now() - _t0);
      return;
    }

    const tilesGroup = scene.getObjectByName('GoogleTilesGroup') ?? null;
    tilesGroupRef.current = tilesGroup;
    terrainMetrics.setTilesGroupFound(!!tilesGroup);
    terrainMetrics.setTrackedPositions(positions.length);
    if (!tilesGroup) {
      terrainMetrics.recordFrame(performance.now() - _t0);
      return;
    }

    // Snapshot operator-tuned config once per frame (sliders mutate between frames)
    const cfg = useTerrainCacheConfig.getState();

    // Count current tile meshes to detect LOD changes
    let meshCount = 0;
    tilesGroup.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) meshCount++;
    });
    const lodChanged = meshCount !== lastMeshCountRef.current;
    if (lodChanged && lastMeshCountRef.current !== 0) terrainMetrics.recordLodChange();
    lastMeshCountRef.current = meshCount;

    const cache = cacheRef.current;
    const persist = persistenceRef.current;

    // ── Pass 1: always sample positions that have NO resolved height yet.
    //   Bounded per-frame so we never spike the frame budget.
    let unresolvedSampled = 0;
    for (let i = 0; i < positions.length && unresolvedSampled < cfg.unresolvedBatchPerFrame; i++) {
      const pos = positions[i];
      const xt = (pos.x * 10) | 0;
      const zt = (pos.z * 10) | 0;
      const key = `${xt}:${zt}`;
      if (cache.has(key)) continue;
      const y = sampleTerrain(tilesGroup, pos.x, pos.z);
      terrainMetrics.recordUnresolvedSample();
      if (y !== null) {
        cache.set(key, y);
        persist?.markDirty(key, xt, zt, y);
      }
      unresolvedSampled++;
    }

    frameRef.current++;
    const shouldRevalidate = lodChanged || frameRef.current % cfg.revalidateInterval === 0;
    if (!shouldRevalidate) {
      terrainMetrics.setCacheSize(cache.size);
      terrainMetrics.recordFrame(performance.now() - _t0);
      return;
    }

    // ── Pass 2: re-validate resolved positions in a rolling batch.
    //   When the LOD changed we sweep a larger batch immediately so pins
    //   re-snap to the new surface without a visible jump-and-settle.
    const batchSize = lodChanged ? Math.min(positions.length, cfg.revalidateBatch * 4) : cfg.revalidateBatch;
    const startIdx = revalidateIndexRef.current % positions.length;
    const endIdx = Math.min(startIdx + batchSize, positions.length);

    for (let i = startIdx; i < endIdx; i++) {
      const pos = positions[i];
      const xt = (pos.x * 10) | 0;
      const zt = (pos.z * 10) | 0;
      const key = `${xt}:${zt}`;
      const y = sampleTerrain(tilesGroup, pos.x, pos.z);
      terrainMetrics.recordRevalidation();
      if (y === null) continue;
      const prev = cache.get(key);
      if (prev === undefined || Math.abs(prev - y) > cfg.heightDriftThreshold) {
        if (prev !== undefined) terrainMetrics.recordDrift();
        cache.set(key, y);
        persist?.markDirty(key, xt, zt, y);
      }
    }
    revalidateIndexRef.current = endIdx >= positions.length ? 0 : endIdx;
    terrainMetrics.setCacheSize(cache.size);
    terrainMetrics.recordFrame(performance.now() - _t0);
  });

  const getHeight = useCallback((x: number, z: number): number => {
    const cache = cacheRef.current;
    const xt = (x * 10) | 0;
    const zt = (z * 10) | 0;
    const key = `${xt}:${zt}`;
    const v = cache.get(key);
    if (v !== undefined) {
      terrainMetrics.recordGet(true);
      return v;
    }
    // ── One-shot fallback ──
    // Position not yet resolved: try a synchronous raycast against the
    // currently loaded tiles. If a tile mesh exists under the XZ ray, we
    // resolve immediately and cache, so the pin never falls to y=0 between
    // its first render and the next useFrame pass.
    const tilesGroup = tilesGroupRef.current;
    if (enabledRef.current && tilesGroup) {
      const y = sampleTerrain(tilesGroup, x, z);
      if (y !== null) {
        cache.set(key, y);
        persistenceRef.current?.markDirty(key, xt, zt, y);
        terrainMetrics.recordOneShotResolve();
        terrainMetrics.recordGet(true);
        terrainMetrics.setCacheSize(cache.size);
        return y;
      }
    }
    terrainMetrics.recordGet(false);
    return 0;
  }, []);

  const isResolved = useCallback((x: number, z: number): boolean => {
    return cacheRef.current.has(posKey(x, z));
  }, []);

  return { getHeight, isResolved, heights: cacheRef.current };
}
