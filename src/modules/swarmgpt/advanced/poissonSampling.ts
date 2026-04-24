/**
 * SwarmGPT Advanced — Poisson Disk Sampling.
 * Greedy keep-if-far-enough selection from a candidate point cloud.
 * Pads the result with cyclic fallback to guarantee `targetCount` points.
 */
import type { Vec3 } from '../types';
import { distance3 } from '../utils/geometry';

export function poissonSample(
  points: Vec3[],
  targetCount: number,
  minDistance: number,
): Vec3[] {
  if (points.length === 0 || targetCount <= 0) return [];
  if (points.length <= targetCount) {
    const out = points.slice();
    while (out.length < targetCount) {
      out.push(points[out.length % points.length]);
    }
    return out;
  }

  const shuffled = points.slice().sort(() => Math.random() - 0.5);
  const selected: Vec3[] = [];

  for (const p of shuffled) {
    if (selected.length >= targetCount) break;
    let valid = true;
    for (const s of selected) {
      if (distance3(p, s) < minDistance) {
        valid = false;
        break;
      }
    }
    if (valid) selected.push(p);
  }

  // Fallback — relax min distance to guarantee count.
  let i = 0;
  while (selected.length < targetCount && i < shuffled.length) {
    const p = shuffled[i++];
    if (!selected.includes(p)) selected.push(p);
  }
  while (selected.length < targetCount) {
    selected.push(points[selected.length % points.length]);
  }

  return selected;
}
