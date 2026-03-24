/**
 * FX KONTROL · Spatial Culler — AAA Frustum Culling Engine
 * 
 * Provides GPU-free frustum culling for pyrotechnic effects.
 * Skips useFrame computation for off-screen effects without
 * creating/destroying geometry (zero GC pressure).
 */

import * as THREE from 'three';

// Reusable objects to avoid per-frame allocations
const _frustum = new THREE.Frustum();
const _projScreenMatrix = new THREE.Matrix4();
const _sphere = new THREE.Sphere();
const _vec3 = new THREE.Vector3();

/**
 * Test if a world-space sphere is inside the camera frustum.
 * Uses pre-allocated math objects — safe to call 60×/sec.
 */
export function isInFrustum(
  camera: THREE.Camera,
  position: [number, number, number] | { x: number; y: number; z: number },
  radius: number = 50
): boolean {
  _projScreenMatrix.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  _frustum.setFromProjectionMatrix(_projScreenMatrix);

  if (Array.isArray(position)) {
    _vec3.set(position[0], position[1], position[2]);
  } else {
    _vec3.set(position.x, position.y, position.z);
  }

  _sphere.set(_vec3, radius);
  return _frustum.intersectsSphere(_sphere);
}

/**
 * Batch frustum test — returns a boolean array matching input positions.
 * Single frustum extraction for all tests (cheaper than N individual calls).
 */
export function batchFrustumTest(
  camera: THREE.Camera,
  positions: Array<[number, number, number]>,
  radius: number = 50
): boolean[] {
  _projScreenMatrix.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  _frustum.setFromProjectionMatrix(_projScreenMatrix);

  return positions.map(pos => {
    _sphere.set(_vec3.set(pos[0], pos[1], pos[2]), radius);
    return _frustum.intersectsSphere(_sphere);
  });
}

// ═══ Spatial Hash Grid — O(1) neighbor lookup for large scenes ═══
const CELL_SIZE = 500; // meters per cell

export class SpatialHash {
  private cells = new Map<string, Set<string>>();

  private key(x: number, z: number): string {
    const cx = Math.floor(x / CELL_SIZE);
    const cz = Math.floor(z / CELL_SIZE);
    return `${cx},${cz}`;
  }

  insert(id: string, x: number, z: number) {
    const k = this.key(x, z);
    let cell = this.cells.get(k);
    if (!cell) {
      cell = new Set();
      this.cells.set(k, cell);
    }
    cell.add(id);
  }

  remove(id: string, x: number, z: number) {
    const cell = this.cells.get(this.key(x, z));
    if (cell) cell.delete(id);
  }

  query(x: number, z: number, radius: number): string[] {
    const results: string[] = [];
    const cellRadius = Math.ceil(radius / CELL_SIZE);
    const cx = Math.floor(x / CELL_SIZE);
    const cz = Math.floor(z / CELL_SIZE);

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dz = -cellRadius; dz <= cellRadius; dz++) {
        const cell = this.cells.get(`${cx + dx},${cz + dz}`);
        if (cell) {
          cell.forEach(id => results.push(id));
        }
      }
    }
    return results;
  }

  clear() {
    this.cells.clear();
  }
}

// Global singleton for the scene
export const sceneSpatialHash = new SpatialHash();
