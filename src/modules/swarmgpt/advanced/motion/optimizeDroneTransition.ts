/**
 * SwarmGPT Advanced — Drone transition optimization with diagnostics.
 * Wraps greedy matching and reports max/avg distance, max speed, validity.
 */
import type { Vec3 } from '../../types';
import { distance3 } from '../../utils/geometry';
import { matchPointsByGreedyCost } from './hungarianLite';

export interface TransitionOptimizationReport {
  points: Vec3[];
  maxDistance: number;
  avgDistance: number;
  maxSpeed: number;
  valid: boolean;
}

export interface OptimizeDroneTransitionOptions {
  duration: number;
  maxDroneSpeed: number;
}

export function optimizeDroneTransition(
  from: Vec3[],
  to: Vec3[],
  options: OptimizeDroneTransitionOptions,
): TransitionOptimizationReport {
  const matched = matchPointsByGreedyCost(from, to);
  const pairCount = Math.min(from.length, matched.length);

  if (pairCount === 0) {
    return { points: matched, maxDistance: 0, avgDistance: 0, maxSpeed: 0, valid: true };
  }

  let total = 0;
  let maxDistance = 0;
  for (let i = 0; i < pairCount; i++) {
    const d = distance3(from[i], matched[i]);
    total += d;
    if (d > maxDistance) maxDistance = d;
  }

  const avgDistance = total / pairCount;
  const maxSpeed = options.duration > 0 ? maxDistance / options.duration : Infinity;
  const valid = Number.isFinite(maxSpeed) && maxSpeed <= options.maxDroneSpeed;

  return { points: matched, maxDistance, avgDistance, maxSpeed, valid };
}
