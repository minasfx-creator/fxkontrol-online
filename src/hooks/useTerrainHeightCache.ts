/**
 * useTerrainHeightCache — Caches terrain Y heights for position XZ coordinates.
 * Raycasts against Google 3D Tiles mesh to find terrain surface,
 * so that positions/effects render ON TOP of the terrain, not below it.
 */
import { useRef, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const _ray = new THREE.Raycaster();
const _origin = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);

/** How often to re-query terrain heights (every N frames) */
const QUERY_INTERVAL = 30; // ~0.5s at 60fps
/** Max positions to query per frame to avoid lag */
const BATCH_SIZE = 8;

export interface TerrainHeightCache {
  /** Get cached terrain Y for a given XZ position. Returns 0 if no terrain hit. */
  getHeight: (x: number, z: number) => number;
  /** Raw map for direct access */
  heights: Map<string, number>;
}

function posKey(x: number, z: number): string {
  return `${(x * 10 | 0)}:${(z * 10 | 0)}`;
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
  const cacheRef = useRef<Map<string, number>>(new Map());
  const frameRef = useRef(0);
  const batchIndexRef = useRef(0);

  useFrame(() => {
    if (!enabled || positions.length === 0) return;

    frameRef.current++;
    if (frameRef.current % QUERY_INTERVAL !== 0) return;

    const tilesGroup = scene.getObjectByName('GoogleTilesGroup');
    if (!tilesGroup) return;

    const cache = cacheRef.current;
    const startIdx = batchIndexRef.current % positions.length;
    const endIdx = Math.min(startIdx + BATCH_SIZE, positions.length);

    for (let i = startIdx; i < endIdx; i++) {
      const pos = positions[i];
      const key = posKey(pos.x, pos.z);

      // Raycast from high above downward
      _origin.set(pos.x, 2000, pos.z);
      _ray.set(_origin, _down);
      _ray.far = 4000;

      const hits = _ray.intersectObject(tilesGroup, true);
      if (hits.length > 0) {
        cache.set(key, hits[0].point.y);
      }
    }

    batchIndexRef.current = endIdx >= positions.length ? 0 : endIdx;
  });

  const getHeight = useCallback((x: number, z: number): number => {
    return cacheRef.current.get(posKey(x, z)) ?? 0;
  }, []);

  return { getHeight, heights: cacheRef.current };
}
