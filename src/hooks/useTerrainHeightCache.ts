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
import { useRef, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const _ray = new THREE.Raycaster();
const _origin = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);

/** How often to re-validate already-resolved heights (every N frames) */
const REVALIDATE_INTERVAL = 30; // ~0.5s at 60fps
/** Max already-resolved positions to re-check per validation tick */
const REVALIDATE_BATCH = 8;
/** Max unresolved positions to sample per frame (cheap, keeps new pins on ground) */
const UNRESOLVED_BATCH_PER_FRAME = 16;
/** Drift (meters) above which we treat the cached height as stale */
const HEIGHT_DRIFT_THRESHOLD = 0.5;

export interface TerrainHeightCache {
  /** Get cached terrain Y for a given XZ position. Returns 0 if no terrain hit yet. */
  getHeight: (x: number, z: number) => number;
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
export function useTerrainHeightCache(
  positions: { x: number; z: number }[],
  enabled: boolean,
): TerrainHeightCache {
  const { scene } = useThree();
  // Resolved Y values (positions actually sitting on a tile mesh)
  const cacheRef = useRef<Map<string, number>>(new Map());
  const frameRef = useRef(0);
  const revalidateIndexRef = useRef(0);
  // Tracks the last-seen tile mesh count; a delta means LOD changed → revalidate
  const lastMeshCountRef = useRef(0);

  useFrame(() => {
    if (!enabled || positions.length === 0) {
      // When tiles are disabled, drop the cache so we don't reuse stale values
      if (cacheRef.current.size > 0) cacheRef.current.clear();
      return;
    }

    const tilesGroup = scene.getObjectByName('GoogleTilesGroup');
    if (!tilesGroup) return;

    // Count current tile meshes to detect LOD changes
    let meshCount = 0;
    tilesGroup.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) meshCount++;
    });
    const lodChanged = meshCount !== lastMeshCountRef.current;
    lastMeshCountRef.current = meshCount;

    const cache = cacheRef.current;

    // ── Pass 1: always sample positions that have NO resolved height yet.
    //   Bounded per-frame so we never spike the frame budget.
    let unresolvedSampled = 0;
    for (let i = 0; i < positions.length && unresolvedSampled < UNRESOLVED_BATCH_PER_FRAME; i++) {
      const pos = positions[i];
      const key = posKey(pos.x, pos.z);
      if (cache.has(key)) continue;
      const y = sampleTerrain(tilesGroup, pos.x, pos.z);
      if (y !== null) cache.set(key, y);
      unresolvedSampled++;
    }

    frameRef.current++;
    const shouldRevalidate = lodChanged || frameRef.current % REVALIDATE_INTERVAL === 0;
    if (!shouldRevalidate) return;

    // ── Pass 2: re-validate resolved positions in a rolling batch.
    //   When the LOD changed we sweep a larger batch immediately so pins
    //   re-snap to the new surface without a visible jump-and-settle.
    const batchSize = lodChanged ? Math.min(positions.length, REVALIDATE_BATCH * 4) : REVALIDATE_BATCH;
    const startIdx = revalidateIndexRef.current % positions.length;
    const endIdx = Math.min(startIdx + batchSize, positions.length);

    for (let i = startIdx; i < endIdx; i++) {
      const pos = positions[i];
      const key = posKey(pos.x, pos.z);
      const y = sampleTerrain(tilesGroup, pos.x, pos.z);
      if (y === null) continue;
      const prev = cache.get(key);
      if (prev === undefined || Math.abs(prev - y) > HEIGHT_DRIFT_THRESHOLD) {
        cache.set(key, y);
      }
    }
    revalidateIndexRef.current = endIdx >= positions.length ? 0 : endIdx;
  });

  const getHeight = useCallback((x: number, z: number): number => {
    return cacheRef.current.get(posKey(x, z)) ?? 0;
  }, []);

  return { getHeight, heights: cacheRef.current };
}
