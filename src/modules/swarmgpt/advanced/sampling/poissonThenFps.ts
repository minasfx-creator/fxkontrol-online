/**
 * SwarmGPT Advanced — Hierarchical Poisson → FPS.
 *
 * Two-stage sampling:
 *   1. Poisson disk produces a dense, well-spaced candidate set (no two
 *      points closer than `minDistance`).
 *   2. Farthest Point Sampling reduces that set down to exactly `droneCount`.
 *
 * This matches the literature pattern cited in the RealityScan brief
 * (Poisson + FPS) and gives more uniform coverage than either alone when
 * `droneCount` is much smaller than the candidate cloud.
 */
import type { Vec3 } from '../../types';
import { poissonSample } from '../poissonSampling';
import { farthestPointSample } from './farthestPointSampling';

export interface PoissonThenFpsOptions {
  droneCount: number;
  minDistance: number;
  /**
   * Multiplier for the intermediate Poisson set size.
   * Default 4 → produces ~4× droneCount candidates before FPS reduction.
   */
  oversample?: number;
}

export function poissonThenFps(points: Vec3[], options: PoissonThenFpsOptions): Vec3[] {
  const { droneCount, minDistance } = options;
  const oversample = Math.max(1, options.oversample ?? 4);
  if (points.length === 0 || droneCount <= 0) return [];

  const intermediate = Math.min(points.length, Math.max(droneCount, droneCount * oversample));
  const dense = poissonSample(points, intermediate, minDistance);
  if (dense.length <= droneCount) return dense.slice(0, droneCount);
  return farthestPointSample(dense, droneCount);
}
