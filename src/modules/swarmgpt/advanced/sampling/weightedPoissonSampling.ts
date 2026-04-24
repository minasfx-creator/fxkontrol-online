import type { Vec3 } from "../../types";
import { distance3 } from "../../utils/geometry";

export type WeightedPoint = {
  point: Vec3;
  weight?: number;
};

export function weightedPoissonSample(
  candidates: WeightedPoint[],
  targetCount: number,
  minDistance: number,
): Vec3[] {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  const desired = Math.max(0, Math.floor(targetCount));
  if (desired === 0) return [];
  const baseDistance = Math.max(0, minDistance);

  const sorted = [...candidates].sort(
    (a, b) => (b.weight ?? 1) - (a.weight ?? 1),
  );

  const selected: Vec3[] = [];

  for (const candidate of sorted) {
    if (selected.length >= desired) break;
    const valid = selected.every(
      (point) => distance3(point, candidate.point) >= baseDistance,
    );
    if (valid) selected.push(candidate.point);
  }

  let relaxedDistance = baseDistance * 0.85;
  while (selected.length < desired && relaxedDistance > baseDistance * 0.3) {
    for (const candidate of sorted) {
      if (selected.length >= desired) break;
      const valid = selected.every(
        (point) => distance3(point, candidate.point) >= relaxedDistance,
      );
      if (valid) selected.push(candidate.point);
    }
    relaxedDistance *= 0.85;
  }

  return selected.slice(0, desired);
}

