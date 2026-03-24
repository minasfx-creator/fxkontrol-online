/**
 * FX KONTROL · Custom Frustum Culler
 * 
 * Fast frustum check for firework bursts — if the burst center is outside
 * the camera frustum, skip ALL particle processing for that cue.
 * Saves thousands of GPU draw calls for off-screen explosions.
 */

import * as THREE from 'three';

// Pre-allocated to avoid GC
const _frustum = new THREE.Frustum();
const _projScreenMatrix = new THREE.Matrix4();
const _sphere = new THREE.Sphere();
const _vec3 = new THREE.Vector3();

/**
 * Update the frustum planes from camera.
 * Call once per frame before any containsPoint checks.
 */
export function updateFrustum(camera: THREE.Camera): void {
  _projScreenMatrix.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  _frustum.setFromProjectionMatrix(_projScreenMatrix);
}

/**
 * Test if a point is within the camera frustum.
 * Use for burst centers — if false, skip rendering that entire burst.
 */
export function isPointInFrustum(x: number, y: number, z: number): boolean {
  _vec3.set(x, y, z);
  return _frustum.containsPoint(_vec3);
}

/**
 * Test if a sphere (burst radius) intersects the camera frustum.
 * More generous than point test — catches partially visible bursts.
 */
export function isSphereInFrustum(
  x: number, y: number, z: number,
  radius: number
): boolean {
  _sphere.center.set(x, y, z);
  _sphere.radius = radius;
  return _frustum.intersectsSphere(_sphere);
}

/**
 * Batch test multiple burst positions.
 * Returns a boolean array — true if burst at index i is visible.
 * 
 * @param positions Flat array [x0,y0,z0, x1,y1,z1, ...]
 * @param radii Per-burst radius (or single value for all)
 * @param out Pre-allocated boolean results array
 */
export function batchFrustumTest(
  positions: Float32Array | number[],
  radii: number | Float32Array,
  out: Uint8Array
): number {
  let visibleCount = 0;
  const count = out.length;
  const singleRadius = typeof radii === 'number';

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const r = singleRadius ? radii : radii[i];
    _sphere.center.set(positions[i3], positions[i3 + 1], positions[i3 + 2]);
    _sphere.radius = r;
    const visible = _frustum.intersectsSphere(_sphere);
    out[i] = visible ? 1 : 0;
    if (visible) visibleCount++;
  }

  return visibleCount;
}
