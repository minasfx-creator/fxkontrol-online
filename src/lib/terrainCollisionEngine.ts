/**
 * ─── Terrain Collision Engine ───────────────────────────────────────
 * Ground-snap (Anchor Ray) and trajectory collision detection against
 * heightmap terrain data. Designed for drone show safety validation.
 */

import type { TerrainData } from '@/lib/heightmapToTerrain';

// ── Types ───────────────────────────────────────────────────────────

export interface CollisionResult {
  hasCollision: boolean;
  collisionPoint: { x: number; y: number; z: number } | null;
  collisionIndex: number; // index in waypoint array, -1 if none
  minClearance: number;   // meters above terrain at closest point
  clearances: number[];   // per-waypoint clearance array
}

export interface TrajectoryPoint {
  x: number;
  y: number; // altitude
  z: number;
  time?: number; // seconds
}

export interface AnchorSnapResult {
  snappedY: number;
  terrainHeight: number;
  isValid: boolean;
}

// ── Heightmap Sampling ──────────────────────────────────────────────

/**
 * Sample terrain height at a world XZ position from heightmap data.
 * Uses bilinear interpolation for smooth results.
 */
export function sampleTerrainHeight(
  terrain: TerrainData,
  worldX: number,
  worldZ: number,
): number {
  const { config, heightmap } = terrain;
  const segments = Math.min(config.resolution, 256);
  const cols = segments + 1;
  const rows = cols;

  // World → normalized terrain UV
  const localX = worldX - config.offsetX + config.width / 2;
  const localZ = worldZ - config.offsetZ + config.depth / 2;

  const u = localX / config.width;
  const v = localZ / config.depth;

  // Out of bounds
  if (u < 0 || u > 1 || v < 0 || v > 1) return 0;

  // Grid coordinates
  const gx = u * (cols - 1);
  const gz = v * (rows - 1);
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = gx - ix;
  const fz = gz - iz;

  // Clamp indices
  const ix1 = Math.min(ix + 1, cols - 1);
  const iz1 = Math.min(iz + 1, rows - 1);

  // Bilinear sample
  const h00 = (heightmap[iz * cols + ix] ?? 0) * config.maxHeight;
  const h10 = (heightmap[iz * cols + ix1] ?? 0) * config.maxHeight;
  const h01 = (heightmap[iz1 * cols + ix] ?? 0) * config.maxHeight;
  const h11 = (heightmap[iz1 * cols + ix1] ?? 0) * config.maxHeight;

  const h0 = h00 * (1 - fx) + h10 * fx;
  const h1 = h01 * (1 - fx) + h11 * fx;

  return h0 * (1 - fz) + h1 * fz;
}

// ── Anchor Ray (Ground Snap) ────────────────────────────────────────

/**
 * Snap a launch position to terrain height.
 * Projects an "Anchor Ray" downward to find the terrain surface.
 * Smoothly adjusts Y so the base never floats or sinks.
 */
export function anchorSnap(
  terrain: TerrainData | null,
  worldX: number,
  worldZ: number,
  currentY: number = 0,
  smoothFactor: number = 0.1, // lerp factor per frame
): AnchorSnapResult {
  if (!terrain) {
    return { snappedY: currentY, terrainHeight: 0, isValid: false };
  }

  const terrainH = sampleTerrainHeight(terrain, worldX, worldZ);
  const targetY = terrainH;
  const snappedY = currentY + (targetY - currentY) * smoothFactor;

  return {
    snappedY,
    terrainHeight: terrainH,
    isValid: true,
  };
}

// ── Trajectory Collision Check ──────────────────────────────────────

/**
 * Check a full drone trajectory against terrain for collisions.
 * 
 * @param trajectory - Array of 3D waypoints (Y = altitude)
 * @param terrain - Loaded terrain data with heightmap
 * @param safetyMargin - Minimum clearance in meters (default 15m)
 * @returns Collision result with per-waypoint clearances
 */
export function checkTrajectoryCollision(
  trajectory: TrajectoryPoint[],
  terrain: TerrainData | null,
  safetyMargin: number = 15,
): CollisionResult {
  if (!terrain || trajectory.length === 0) {
    return {
      hasCollision: false,
      collisionPoint: null,
      collisionIndex: -1,
      minClearance: Infinity,
      clearances: [],
    };
  }

  const clearances: number[] = [];
  let minClearance = Infinity;
  let collisionIndex = -1;
  let collisionPoint: { x: number; y: number; z: number } | null = null;

  for (let i = 0; i < trajectory.length; i++) {
    const wp = trajectory[i];
    const terrainH = sampleTerrainHeight(terrain, wp.x, wp.z);
    const clearance = wp.y - terrainH;
    clearances.push(clearance);

    if (clearance < minClearance) {
      minClearance = clearance;
    }

    if (clearance < safetyMargin && collisionIndex === -1) {
      collisionIndex = i;
      collisionPoint = { x: wp.x, y: terrainH, z: wp.z };
    }
  }

  return {
    hasCollision: collisionIndex !== -1,
    collisionPoint,
    collisionIndex,
    minClearance,
    clearances,
  };
}

/**
 * Check multiple drone trajectories in batch.
 * Returns array of collision results indexed by drone.
 */
export function checkFleetCollisions(
  trajectories: TrajectoryPoint[][],
  terrain: TerrainData | null,
  safetyMargin: number = 15,
): CollisionResult[] {
  return trajectories.map(t => checkTrajectoryCollision(t, terrain, safetyMargin));
}

/**
 * Generate interpolated trajectory points between sparse waypoints
 * for finer collision detection resolution.
 */
export function interpolateTrajectory(
  waypoints: TrajectoryPoint[],
  segmentsPerLeg: number = 10,
): TrajectoryPoint[] {
  if (waypoints.length < 2) return [...waypoints];

  const result: TrajectoryPoint[] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];

    for (let s = 0; s <= segmentsPerLeg; s++) {
      const t = s / segmentsPerLeg;
      result.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
        time: a.time !== undefined && b.time !== undefined
          ? a.time + (b.time - a.time) * t
          : undefined,
      });
    }
  }

  return result;
}
