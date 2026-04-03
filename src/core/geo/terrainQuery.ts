/**
 * ─── Terrain Height Query ───────────────────────────────────────────
 * Raycast against Google 3D Tiles mesh to get real terrain height.
 * Used for snapping barges, launch points, and drones to ground.
 */

import * as THREE from 'three';
import { geoToLocalSync } from './useGeo';

const _raycaster = new THREE.Raycaster();
const _origin = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);

/**
 * Query terrain height at a given lat/lng by raycasting against the
 * Google Tiles mesh group in the scene.
 *
 * @param lat - Latitude in degrees
 * @param lng - Longitude in degrees
 * @param scene - Three.js scene containing the GoogleTilesGroup
 * @param anchorLat - Geo anchor latitude
 * @param anchorLon - Geo anchor longitude
 * @param anchorAlt - Geo anchor altitude
 * @returns Height in local Y coords, or null if no terrain hit
 */
export function getTerrainHeight(
  lat: number,
  lng: number,
  scene: THREE.Scene,
  anchorLat: number,
  anchorLon: number,
  anchorAlt: number,
): number | null {
  const tilesGroup = scene.getObjectByName('GoogleTilesGroup');
  if (!tilesGroup) return null;

  // Convert geo to local position
  const local = geoToLocalSync(lat, lng, 1000, anchorLat, anchorLon, anchorAlt);

  // Cast ray downward from 1000m above
  _origin.set(local.x, local.y, local.z);
  _raycaster.set(_origin, _down);
  _raycaster.far = 2000;

  const hits = _raycaster.intersectObject(tilesGroup, true);
  if (hits.length > 0) {
    return hits[0].point.y;
  }

  return null;
}

/**
 * Batch terrain query for multiple positions.
 */
export function batchTerrainHeight(
  positions: { lat: number; lng: number }[],
  scene: THREE.Scene,
  anchorLat: number,
  anchorLon: number,
  anchorAlt: number,
): (number | null)[] {
  return positions.map((p) =>
    getTerrainHeight(p.lat, p.lng, scene, anchorLat, anchorLon, anchorAlt),
  );
}

// ── Local-space terrain raycast (no geo conversion) ───────────────

const _localOrigin = new THREE.Vector3();
const _localDown = new THREE.Vector3(0, -1, 0);
const _localRaycaster = new THREE.Raycaster();

/**
 * Raycast terrain height using local scene coordinates (no lat/lng).
 * Casts from (x, startHeight, z) downward and returns hit Y or null.
 *
 * @param x - Local X position
 * @param z - Local Z position
 * @param scene - Three.js scene to intersect
 * @param startHeight - Ray origin height (default 2000)
 */
export function raycastTerrainLocal(
  x: number,
  z: number,
  scene: THREE.Scene,
  startHeight = 2000,
): number | null {
  _localOrigin.set(x, startHeight, z);
  _localRaycaster.set(_localOrigin, _localDown);
  _localRaycaster.far = startHeight * 2;

  const hits = _localRaycaster.intersectObjects(scene.children, true);

  // Filter to visible mesh hits only
  for (let i = 0; i < hits.length; i++) {
    const obj = hits[i].object;
    if (obj.visible && (obj as THREE.Mesh).isMesh) {
      return hits[i].point.y;
    }
  }

  return null;
}
