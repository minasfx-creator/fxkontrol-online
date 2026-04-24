/**
 * SwarmGPT Advanced — Orchestrator helpers combining Poisson sampling and
 * greedy point matching. Pure functions, no side effects.
 */
import type { Vec3 } from '../types';
import { poissonSample } from './poissonSampling';
import { matchPointsGreedy, validateSpeed } from './trajectoryOptimizer';

export function generateOptimizedFormation(
  rawPoints: Vec3[],
  droneCount: number,
  minDistance: number,
): Vec3[] {
  return poissonSample(rawPoints, droneCount, minDistance);
}

export function optimizeTransition(
  from: Vec3[],
  to: Vec3[],
  duration: number,
  maxSpeed: number,
): Vec3[] {
  const matched = matchPointsGreedy(from, to);
  // Speed check is informational — caller decides what to do. We always
  // return the matched ordering (it can never be worse than random order).
  validateSpeed(from, matched, duration, maxSpeed);
  return matched;
}

export interface OptimizeTransitionReport {
  points: Vec3[];
  speedOk: boolean;
}

/**
 * Same as `optimizeTransition` but surfaces the speed feasibility flag so
 * callers can warn / re-plan when a transition exceeds max drone speed.
 */
export function optimizeTransitionWithReport(
  from: Vec3[],
  to: Vec3[],
  duration: number,
  maxSpeed: number,
): OptimizeTransitionReport {
  const matched = matchPointsGreedy(from, to);
  const speedOk = validateSpeed(from, matched, duration, maxSpeed);
  return { points: matched, speedOk };
}
