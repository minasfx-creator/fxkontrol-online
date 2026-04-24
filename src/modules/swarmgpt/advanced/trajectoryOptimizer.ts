/**
 * SwarmGPT Advanced — Greedy point matching for formation transitions.
 * Reduces total travel distance by reordering destination points to nearest
 * available source point. NOT to be confused with src/lib/trajectoryOptimizer.ts
 * (Catmull-Rom smoothing) — this file matches endpoints only.
 */
import type { Vec3 } from '../types';
import { distance3 } from '../utils/geometry';

export function matchPointsGreedy(from: Vec3[], to: Vec3[]): Vec3[] {
  const remaining = to.slice();
  const result: Vec3[] = [];

  for (const p of from) {
    if (remaining.length === 0) break;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = distance3(p, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    result.push(remaining.splice(bestIdx, 1)[0]);
  }

  // If `to` was longer than `from`, append leftovers in order.
  result.push(...remaining);
  return result;
}

export function validateSpeed(
  from: Vec3[],
  to: Vec3[],
  duration: number,
  maxSpeed: number,
): boolean {
  if (duration <= 0) return false;
  const n = Math.min(from.length, to.length);
  for (let i = 0; i < n; i++) {
    const speed = distance3(from[i], to[i]) / duration;
    if (speed > maxSpeed) return false;
  }
  return true;
}
