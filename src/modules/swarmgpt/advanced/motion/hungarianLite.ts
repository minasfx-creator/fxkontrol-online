/**
 * SwarmGPT Advanced — Greedy nearest-neighbor matching by Euclidean cost.
 * Distinct from `matchPointsGreedy` in advanced/trajectoryOptimizer.ts to
 * preserve the Nível 1 surface; this variant is the Nível 2 entry point.
 */
import type { Vec3 } from '../../types';
import { distance3 } from '../../utils/geometry';

export function matchPointsByGreedyCost(from: Vec3[], to: Vec3[]): Vec3[] {
  if (!from || from.length === 0) return [];
  if (!to || to.length === 0) return [];

  const remaining = [...to];
  const matched: Vec3[] = [];

  for (const origin of from) {
    if (remaining.length === 0) break;
    let bestIndex = 0;
    let bestCost = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const cost = distance3(origin, remaining[i]);
      if (cost < bestCost) {
        bestCost = cost;
        bestIndex = i;
      }
    }
    matched.push(remaining.splice(bestIndex, 1)[0]);
  }

  return matched;
}
