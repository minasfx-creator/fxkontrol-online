/**
 * Attractors — post-processing transforms applied to sampled point lists.
 * These are not Fields; they reshape an existing point set toward a target
 * (cluster center, line, mesh surface…).
 */
import type { Vec3 } from './vec3';
import { add, scale, sub, length, normalize } from './vec3';

/** Pull every point toward `center` by `strength` in [0,1]. 1 = collapse. */
export function attractToCenter(points: Vec3[], center: Vec3, strength: number): Vec3[] {
  const k = strength < 0 ? 0 : strength > 1 ? 1 : strength;
  const out = new Array<Vec3>(points.length);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    out[i] = {
      x: p.x + (center.x - p.x) * k,
      y: p.y + (center.y - p.y) * k,
      z: p.z + (center.z - p.z) * k,
    };
  }
  return out;
}

/** Pull each point toward the closest point on segment [a,b]. */
export function attractToLine(points: Vec3[], a: Vec3, b: Vec3, strength: number): Vec3[] {
  const ab = sub(b, a);
  const ab2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
  const k = strength < 0 ? 0 : strength > 1 ? 1 : strength;
  const out = new Array<Vec3>(points.length);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const ap = sub(p, a);
    let t = (ap.x * ab.x + ap.y * ab.y + ap.z * ab.z) / (ab2 || 1);
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const proj = add(a, scale(ab, t));
    out[i] = {
      x: p.x + (proj.x - p.x) * k,
      y: p.y + (proj.y - p.y) * k,
      z: p.z + (proj.z - p.z) * k,
    };
  }
  return out;
}

/** Repel points from `center` if within `radius`. Useful for collision avoidance. */
export function repelFromCenter(points: Vec3[], center: Vec3, radius: number, strength: number): Vec3[] {
  const r2 = radius * radius;
  const out = new Array<Vec3>(points.length);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const d = sub(p, center);
    const dist2 = d.x * d.x + d.y * d.y + d.z * d.z;
    if (dist2 >= r2 || dist2 < 1e-9) { out[i] = p; continue; }
    const dist = Math.sqrt(dist2);
    const push = (radius - dist) * strength;
    const n = normalize(d);
    out[i] = { x: p.x + n.x * push, y: p.y + n.y * push, z: p.z + n.z * push };
  }
  return out;
}
