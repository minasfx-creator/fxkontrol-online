/**
 * ─── Terrain Raycaster ──────────────────────────────────────────────
 * Raycast against loaded terrain mesh for snap-to-ground, altitude
 * queries, and interactive GPS coordinate picking.
 * 
 * Works with both custom heightmap terrain and 3D Tiles geometry.
 */

import * as THREE from 'three';

// ── Pre-allocated objects (Zero-GC) ────────────────────────────────
const _raycaster = new THREE.Raycaster();
const _downDir = new THREE.Vector3(0, -1, 0);
const _upDir = new THREE.Vector3(0, 1, 0);
const _origin = new THREE.Vector3();
const _mouseNDC = new THREE.Vector2();

// ── Terrain Mesh Registry ──────────────────────────────────────────
let _terrainMeshes: THREE.Object3D[] = [];

export function registerTerrainMesh(mesh: THREE.Object3D): void {
  if (!_terrainMeshes.includes(mesh)) {
    _terrainMeshes.push(mesh);
  }
}

export function unregisterTerrainMesh(mesh: THREE.Object3D): void {
  _terrainMeshes = _terrainMeshes.filter(m => m !== mesh);
}

export function clearTerrainRegistry(): void {
  _terrainMeshes = [];
}

// ── Snap-to-Ground ─────────────────────────────────────────────────

export interface SnapResult {
  hit: boolean;
  worldY: number;        // terrain height at query point
  normal: THREE.Vector3;  // surface normal
  distance: number;       // ray distance to intersection
}

/**
 * Query terrain height at a world XZ position.
 * Casts a ray downward from a high altitude.
 * 
 * @param worldX - X position in scene space
 * @param worldZ - Z position in scene space
 * @param maxHeight - Starting altitude for the ray (default 2000m)
 */
export function getTerrainHeight(worldX: number, worldZ: number, maxHeight = 2000): SnapResult {
  _origin.set(worldX, maxHeight, worldZ);
  _raycaster.set(_origin, _downDir);
  _raycaster.far = maxHeight * 2;

  const hits = _raycaster.intersectObjects(_terrainMeshes, true);

  if (hits.length > 0) {
    const hit = hits[0];
    return {
      hit: true,
      worldY: hit.point.y,
      normal: hit.face?.normal?.clone() ?? _upDir.clone(),
      distance: hit.distance,
    };
  }

  return {
    hit: false,
    worldY: 0,
    normal: _upDir.clone(),
    distance: Infinity,
  };
}

/**
 * Snap a Three.js object to the terrain surface.
 * Optionally add a vertical offset (e.g., tide level).
 * 
 * @param object - Object3D to snap
 * @param offset - Vertical offset above terrain (default 0)
 * @returns Whether a terrain hit was found
 */
export function snapObjectToGround(
  object: THREE.Object3D,
  offset = 0,
): boolean {
  const result = getTerrainHeight(object.position.x, object.position.z);
  if (result.hit) {
    object.position.y = result.worldY + offset;
    return true;
  }
  return false;
}

/**
 * Batch snap multiple objects to terrain. Efficient for fleet updates.
 * 
 * @param objects - Array of objects to snap
 * @param offsets - Per-object offsets (or single offset for all)
 */
export function batchSnapToGround(
  objects: THREE.Object3D[],
  offsets: number | number[] = 0,
): void {
  for (let i = 0; i < objects.length; i++) {
    const offset = typeof offsets === 'number' ? offsets : (offsets[i] ?? 0);
    snapObjectToGround(objects[i], offset);
  }
}

// ── Interactive Terrain Picking ────────────────────────────────────

export interface TerrainPickResult {
  hit: boolean;
  worldPosition: THREE.Vector3;
  /** GPS coordinates (if anchor is known) */
  geoPosition?: { lat: number; lng: number; alt: number };
}

/**
 * Pick a point on the terrain from a mouse/touch event.
 * Use for interactive GPS coordinate dropping.
 * 
 * @param event - Mouse or pointer event
 * @param camera - Active camera
 * @param canvas - Renderer's DOM element
 * @param geoTransform - Optional function to convert world→GPS
 */
export function pickTerrainPoint(
  event: { clientX: number; clientY: number },
  camera: THREE.Camera,
  canvas: HTMLElement,
  geoTransform?: (worldPos: THREE.Vector3) => { lat: number; lng: number; alt: number },
): TerrainPickResult {
  const rect = canvas.getBoundingClientRect();
  _mouseNDC.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );

  _raycaster.setFromCamera(_mouseNDC, camera);
  const hits = _raycaster.intersectObjects(_terrainMeshes, true);

  if (hits.length > 0) {
    const hit = hits[0];
    const result: TerrainPickResult = {
      hit: true,
      worldPosition: hit.point.clone(),
    };
    if (geoTransform) {
      result.geoPosition = geoTransform(hit.point);
    }
    return result;
  }

  return { hit: false, worldPosition: new THREE.Vector3() };
}

// ── Trajectory Collision (against real terrain mesh) ───────────────

export interface TrajectoryCollisionResult {
  hasCollision: boolean;
  collisionIndex: number;
  collisionPoint: THREE.Vector3 | null;
  minClearance: number;
  clearances: number[];
}

/**
 * Check if a trajectory path collides with terrain geometry.
 * Tests each waypoint against terrain height.
 * 
 * @param waypoints - Array of world-space positions [x, y, z]
 * @param safetyMargin - Minimum clearance required (default 10m)
 */
export function checkTrajectoryAgainstTerrain(
  waypoints: [number, number, number][],
  safetyMargin = 10,
): TrajectoryCollisionResult {
  let minClearance = Infinity;
  let collisionIndex = -1;
  let collisionPoint: THREE.Vector3 | null = null;
  const clearances: number[] = [];

  for (let i = 0; i < waypoints.length; i++) {
    const [x, y, z] = waypoints[i];
    const terrain = getTerrainHeight(x, z);
    const clearance = terrain.hit ? (y - terrain.worldY) : Infinity;
    clearances.push(clearance);

    if (clearance < minClearance) {
      minClearance = clearance;
    }

    if (clearance < safetyMargin && collisionIndex === -1) {
      collisionIndex = i;
      collisionPoint = new THREE.Vector3(x, terrain.worldY, z);
    }
  }

  return {
    hasCollision: collisionIndex >= 0,
    collisionIndex,
    collisionPoint,
    minClearance,
    clearances,
  };
}
