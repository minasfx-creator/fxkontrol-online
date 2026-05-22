/**
 * SwarmGPT Advanced — Deterministic point cloud pre-reduction.
 * Used before Poisson/FPS sampling to keep candidate sets within the
 * recommended 5k–20k range without changing visual coverage.
 */
import type { Vec3 } from '../../types';

/**
 * Stride downsample: pick `maxPoints` indices evenly spaced across the input.
 * Deterministic, preserves order, never mutates the input.
 */
export function reducePointCloud(points: Vec3[], maxPoints: number): Vec3[] {
  if (!points || points.length === 0) return [];
  const cap = Math.max(0, maxPoints);
  if (cap === 0) return [];
  if (points.length <= cap) return points.slice();

  const result: Vec3[] = new Array(cap);
  for (let i = 0; i < cap; i++) {
    const idx = Math.floor((i / cap) * points.length);
    result[i] = points[idx];
  }
  return result;
}
