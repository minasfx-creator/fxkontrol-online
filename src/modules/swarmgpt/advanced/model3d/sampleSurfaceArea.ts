/**
 * SwarmGPT Advanced — Area-weighted surface sampling.
 * For an indexed triangle mesh: build a CDF over triangle areas, sample
 * `count` points by picking a triangle proportional to its area, then a
 * uniform barycentric coordinate within it. Deterministic via mulberry32
 * seeded from vertex count.
 */
import type { Vec3 } from '../../types';
import { mulberry32 } from '../../utils/random';
import type { WeightedPoint } from '../sampling/weightedPoissonSampling';

function triangleArea(a: Vec3, b: Vec3, c: Vec3): number {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
  const cx = aby * acz - abz * acy;
  const cy = abz * acx - abx * acz;
  const cz = abx * acy - aby * acx;
  return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
}

export function sampleTrianglesByArea(
  vertices: Vec3[],
  indices: number[],
  count: number,
): WeightedPoint[] {
  if (!vertices || vertices.length === 0 || !indices || indices.length < 3 || count <= 0) {
    return [];
  }
  const triCount = Math.floor(indices.length / 3);
  if (triCount === 0) return [];

  // Build per-triangle areas + CDF.
  const areas = new Float64Array(triCount);
  let total = 0;
  for (let t = 0; t < triCount; t++) {
    const i0 = indices[t * 3];
    const i1 = indices[t * 3 + 1];
    const i2 = indices[t * 3 + 2];
    const a = vertices[i0], b = vertices[i1], c = vertices[i2];
    if (!a || !b || !c) continue;
    const area = triangleArea(a, b, c);
    areas[t] = area;
    total += area;
  }
  if (total <= 0) return [];

  const cdf = new Float64Array(triCount);
  let acc = 0;
  for (let t = 0; t < triCount; t++) {
    acc += areas[t] / total;
    cdf[t] = acc;
  }

  // Binary search the CDF for the picked triangle.
  const pickTriangle = (u: number): number => {
    let lo = 0, hi = triCount - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (cdf[mid] < u) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  const rand = mulberry32(vertices.length || 1);
  const out: WeightedPoint[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const t = pickTriangle(rand());
    let u = rand();
    let v = rand();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v;
    const a = vertices[indices[t * 3]];
    const b = vertices[indices[t * 3 + 1]];
    const c = vertices[indices[t * 3 + 2]];
    out[i] = {
      point: {
        x: a.x * w + b.x * u + c.x * v,
        y: a.y * w + b.y * u + c.y * v,
        z: a.z * w + b.z * u + c.z * v,
      },
      weight: areas[t],
    };
  }
  return out;
}
