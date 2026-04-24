/**
 * SwarmGPT Advanced — Poisson Disk Sampling (deterministic).
 * Greedy keep-if-far-enough selection from a candidate point cloud.
 * Pads the result with cyclic fallback to guarantee `targetCount` points.
 */
import type { Vec3 } from '../types';
import { distance3 } from '../utils/geometry';
import { seededShuffle, seedFromPoints } from '../utils/random';

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

  const seed = seedFromPoints(points);
  const shuffled = seededShuffle(points, seed);
  const selected: Vec3[] = [];
  const usedIdx = new Set<number>();

  for (let i = 0; i < shuffled.length; i++) {
    if (selected.length >= targetCount) break;
    const p = shuffled[i];
    let valid = true;
    for (const s of selected) {
      if (distance3(p, s) < minDistance) {
        valid = false;
        break;
      }
    }
    if (valid) {
      selected.push(p);
      usedIdx.add(i);
    }
  }

  // Fallback — relax min distance to guarantee count. O(1) used-index lookup.
  for (let i = 0; i < shuffled.length && selected.length < targetCount; i++) {
    if (usedIdx.has(i)) continue;
    selected.push(shuffled[i]);
    usedIdx.add(i);
  }
  while (selected.length < targetCount) {
    selected.push(points[selected.length % points.length]);
  }

  return selected;
}
