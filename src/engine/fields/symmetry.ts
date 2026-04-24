/**
 * Symmetry — post-sampling helpers that mirror or rotate a point set.
 * Cheaper than mirroring the field itself when you've already sampled.
 */
import type { Vec3 } from './vec3';

/** Mirror the points across the plane perpendicular to `axis`. Returns original ∪ mirror. */
export function applySymmetry(points: Vec3[], axis: 'x' | 'y' | 'z' = 'x'): Vec3[] {
  const mirrored = new Array<Vec3>(points.length);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (axis === 'x') mirrored[i] = { x: -p.x, y: p.y, z: p.z };
    else if (axis === 'y') mirrored[i] = { x: p.x, y: -p.y, z: p.z };
    else mirrored[i] = { x: p.x, y: p.y, z: -p.z };
  }
  return points.concat(mirrored);
}

/**
 * applyRotationalSymmetry — Repeat the point set `n` times around the Y axis.
 * Useful for radially-symmetric formations (rings, mandalas).
 */
export function applyRotationalSymmetry(points: Vec3[], n: number, axis: 'x' | 'y' | 'z' = 'y'): Vec3[] {
  if (n < 2) return points.slice();
  const out: Vec3[] = [];
  out.length = points.length * n;
  let w = 0;
  for (let k = 0; k < n; k++) {
    const angle = (Math.PI * 2 * k) / n;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (axis === 'y') {
        out[w++] = { x: p.x * c - p.z * s, y: p.y, z: p.x * s + p.z * c };
      } else if (axis === 'x') {
        out[w++] = { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
      } else {
        out[w++] = { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
      }
    }
  }
  return out;
}
