/**
 * SwarmGPT Advanced — Farthest Point Sampling (FPS).
 * Deterministic O(N·k) selection that maximizes minimum pairwise distance.
 * Better than Poisson at preserving silhouette when drone count is small.
 *
 * Pads the result with cyclic fallback to guarantee `targetCount` points,
 * mirroring the contract of `poissonSample`.
 */
import type { Vec3 } from '../../types';
import { distance3 } from '../../utils/geometry';
import { seedFromPoints } from '../../utils/random';

export function farthestPointSample(
  points: Vec3[],
  targetCount: number,
  seedIndex?: number,
): Vec3[] {
  if (!points || points.length === 0 || targetCount <= 0) return [];
  if (points.length <= targetCount) {
    const out = points.slice();
    while (out.length < targetCount) {
      out.push(points[out.length % points.length]);
    }
    return out;
  }

  const startIdx =
    typeof seedIndex === 'number'
      ? ((seedIndex % points.length) + points.length) % points.length
      : seedFromPoints(points) % points.length;

  const selected: Vec3[] = [points[startIdx]];
  const minDist = new Array<number>(points.length);
  for (let i = 0; i < points.length; i++) {
    minDist[i] = distance3(points[i], points[startIdx]);
  }
  minDist[startIdx] = -1; // mark used

  while (selected.length < targetCount) {
    let bestIdx = -1;
    let bestDist = -Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = minDist[i];
      if (d > bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) break;
    selected.push(points[bestIdx]);
    minDist[bestIdx] = -1;
    // Update min distances against the newly selected point.
    const newPoint = points[bestIdx];
    for (let i = 0; i < points.length; i++) {
      if (minDist[i] < 0) continue;
      const d = distance3(points[i], newPoint);
      if (d < minDist[i]) minDist[i] = d;
    }
  }

  while (selected.length < targetCount) {
    selected.push(points[selected.length % points.length]);
  }

  return selected;
}
