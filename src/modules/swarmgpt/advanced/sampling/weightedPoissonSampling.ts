/**
 * SwarmGPT Advanced — Weighted Poisson sampling.
 * Sort by weight desc, greedy keep-if-far-enough, gradual relaxation.
 * Returns at most targetCount (no padding — caller decides).
 */
import type { Vec3 } from '../../types';
import { distance3 } from '../../utils/geometry';

export interface WeightedPoint {
  point: Vec3;
  weight?: number;
}

export function weightedPoissonSample(
  candidates: WeightedPoint[],
  targetCount: number,
  minDistance: number,
): Vec3[] {
  if (!candidates || candidates.length === 0 || targetCount <= 0) return [];

  const sorted = [...candidates].sort(
    (a, b) => (b.weight ?? 1) - (a.weight ?? 1),
  );

  const selected: Vec3[] = [];
  const used = new Set<number>();

  const tryFill = (distance: number) => {
    for (let i = 0; i < sorted.length; i++) {
      if (selected.length >= targetCount) return;
      if (used.has(i)) continue;
      const candidate = sorted[i].point;
      let valid = true;
      for (const s of selected) {
        if (distance3(candidate, s) < distance) {
          valid = false;
          break;
        }
      }
      if (valid) {
        selected.push(candidate);
        used.add(i);
      }
    }
  };

  tryFill(minDistance);

  let relaxed = minDistance * 0.85;
  const floor = minDistance * 0.3;
  while (selected.length < targetCount && relaxed > floor) {
    tryFill(relaxed);
    relaxed *= 0.85;
  }

  return selected.slice(0, targetCount);
}
