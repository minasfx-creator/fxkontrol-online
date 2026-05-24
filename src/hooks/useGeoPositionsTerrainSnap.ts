/**
 * useGeoPositionsTerrainSnap — On each tick, raycasts geo-bound positions
 * against the live Google Tiles mesh and writes the resulting Y back into
 * `useProjectStore.positions`. Idempotent: positions already marked
 * `snappedToTerrain` are skipped unless their geo changes.
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { raycastTerrainGeo } from '@/core/geo/terrainQuery';

/** Default ~ every 1 s at 60 fps */
const QUERY_INTERVAL = 60;
const BATCH = 6;

export function useGeoPositionsTerrainSnap(enabled = true) {
  const { scene } = useThree();
  const frameRef = useRef(0);
  const cursorRef = useRef(0);
  const settings = useSceneStore((s) => s.settings);

  // Reset cursor when anchor changes
  useEffect(() => {
    cursorRef.current = 0;
  }, [settings.geoAnchorLat, settings.geoAnchorLon, settings.geoAnchorAlt]);

  useFrame(() => {
    if (!enabled) return;
    frameRef.current++;
    if (frameRef.current % QUERY_INTERVAL !== 0) return;

    const tiles = scene.getObjectByName('GoogleTilesGroup');
    if (!tiles) return;

    const { positions, updatePosition } = useProjectStore.getState();
    const candidates = positions.filter((p) => p.geo && !p.snappedToTerrain);
    if (candidates.length === 0) return;

    const anchor = {
      lat: settings.geoAnchorLat,
      lng: settings.geoAnchorLon,
      alt: settings.geoAnchorAlt,
    };

    const start = cursorRef.current % candidates.length;
    const end = Math.min(start + BATCH, candidates.length);
    for (let i = start; i < end; i++) {
      const p = candidates[i]!;
      const r = raycastTerrainGeo(p.geo!.lat, p.geo!.lng, scene, anchor);
      if (r.hit) {
        const yAGL = (p.geo!.altAGL ?? 0);
        updatePosition(p.id, { y: r.y + yAGL, snappedToTerrain: true });
      }
    }
    cursorRef.current = end >= candidates.length ? 0 : end;
  });
}
