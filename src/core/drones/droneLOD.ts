/**
 * ─── Drone LOD Manager ──────────────────────────────────────────────
 * Distance-based Level of Detail for rendering 300+ drones:
 *   < 150m  → Full mesh (PBR carbon fiber)
 *   150-400m → Instanced simplified mesh
 *   > 400m  → Glow point sprite
 * 
 * Uses a single InstancedMesh per LOD tier for minimal draw calls.
 */

import * as THREE from 'three';

export type DroneLODTier = 'full' | 'instanced' | 'point';

export interface DroneLODConfig {
  fullMeshDistance: number;       // < this → full detail (default 150)
  instancedDistance: number;      // < this → instanced (default 400)
  // > instancedDistance → point sprite
}

export const DEFAULT_LOD_CONFIG: DroneLODConfig = {
  fullMeshDistance: 150,
  instancedDistance: 400,
};

/**
 * Classify a drone's LOD tier based on camera distance.
 */
export function classifyDroneLOD(
  droneWorldPos: THREE.Vector3,
  cameraWorldPos: THREE.Vector3,
  config: DroneLODConfig = DEFAULT_LOD_CONFIG,
): DroneLODTier {
  const dist = droneWorldPos.distanceTo(cameraWorldPos);
  if (dist < config.fullMeshDistance) return 'full';
  if (dist < config.instancedDistance) return 'instanced';
  return 'point';
}

// ── Pre-allocated for batch operations ─────────────────────────────
const _dronePos = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();

export interface DroneLODBuckets {
  full: number[];       // indices of drones in full LOD
  instanced: number[];  // indices of drones in instanced LOD
  point: number[];      // indices of drones in point LOD
}

/**
 * Batch-classify all drones into LOD buckets.
 * Designed for zero-allocation in hot path (reuses output arrays).
 * 
 * @param positions - Flat Float32Array [x,y,z, x,y,z, ...]
 * @param count - Number of drones
 * @param camera - Active camera
 * @param config - LOD distance thresholds
 * @param output - Reusable bucket arrays (allocated once)
 */
export function batchClassifyLOD(
  positions: Float32Array,
  count: number,
  camera: THREE.Camera,
  config: DroneLODConfig = DEFAULT_LOD_CONFIG,
  output?: DroneLODBuckets,
): DroneLODBuckets {
  const buckets: DroneLODBuckets = output ?? { full: [], instanced: [], point: [] };
  buckets.full.length = 0;
  buckets.instanced.length = 0;
  buckets.point.length = 0;

  _camPos.copy(camera.position);

  const fullDist2 = config.fullMeshDistance * config.fullMeshDistance;
  const instDist2 = config.instancedDistance * config.instancedDistance;

  for (let i = 0; i < count; i++) {
    const offset = i * 3;
    _dronePos.set(positions[offset], positions[offset + 1], positions[offset + 2]);
    const dist2 = _dronePos.distanceToSquared(_camPos);

    if (dist2 < fullDist2) {
      buckets.full.push(i);
    } else if (dist2 < instDist2) {
      buckets.instanced.push(i);
    } else {
      buckets.point.push(i);
    }
  }

  return buckets;
}

/**
 * Update an InstancedMesh with positions from a LOD bucket.
 * 
 * @param mesh - InstancedMesh to update
 * @param positions - Flat position array
 * @param indices - Drone indices in this LOD tier
 * @param ledColors - Optional per-drone LED color array (hex strings)
 */
export function updateInstancedMeshFromBucket(
  mesh: THREE.InstancedMesh,
  positions: Float32Array,
  indices: number[],
  ledColors?: string[],
): void {
  mesh.count = indices.length;

  for (let i = 0; i < indices.length; i++) {
    const droneIdx = indices[i];
    const offset = droneIdx * 3;
    _matrix.makeTranslation(
      positions[offset],
      positions[offset + 1],
      positions[offset + 2],
    );
    mesh.setMatrixAt(i, _matrix);

    if (ledColors && ledColors[droneIdx]) {
      _color.set(ledColors[droneIdx]);
      mesh.setColorAt(i, _color);
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

// ── Point Sprite Helpers ───────────────────────────────────────────

/**
 * Update a Points geometry with positions from a LOD bucket.
 */
export function updatePointsFromBucket(
  geometry: THREE.BufferGeometry,
  positions: Float32Array,
  indices: number[],
  ledColors?: string[],
): void {
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
  const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute;

  for (let i = 0; i < indices.length; i++) {
    const droneIdx = indices[i];
    const offset = droneIdx * 3;
    posAttr.setXYZ(i, positions[offset], positions[offset + 1], positions[offset + 2]);

    if (colorAttr && ledColors && ledColors[droneIdx]) {
      _color.set(ledColors[droneIdx]);
      colorAttr.setXYZ(i, _color.r, _color.g, _color.b);
    }
  }

  posAttr.needsUpdate = true;
  if (colorAttr) colorAttr.needsUpdate = true;
  geometry.setDrawRange(0, indices.length);
}
