/**
 * SwarmGPT Advanced — Greedy nearest-neighbor matching by Euclidean cost.
 * Re-exports the canonical Nível 1 implementation under the Nível 2 name to
 * keep both public surfaces stable while using a single source of truth.
 */
import type { Vec3 } from '../../types';
import { matchPointsGreedy } from '../trajectoryOptimizer';

export function matchPointsByGreedyCost(from: Vec3[], to: Vec3[]): Vec3[] {
  if (!from || from.length === 0) return [];
  if (!to || to.length === 0) return [];
  return matchPointsGreedy(from, to);
}
