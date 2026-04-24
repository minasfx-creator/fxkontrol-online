/**
 * SwarmGPT Advanced — Formation fidelity score.
 * Lightweight heuristic combining coverage and distribution.
 */
import type { Vec3 } from '../../types';

export interface FormationFidelityScore {
  score: number;
  coverage: number;
  distribution: number;
  pointCount: number;
}

export function scoreFormationFidelity(
  originalCandidates: Vec3[],
  sampledPoints: Vec3[],
): FormationFidelityScore {
  const pointCount = sampledPoints?.length ?? 0;

  if (!originalCandidates || originalCandidates.length === 0 || pointCount === 0) {
    return { score: 0, coverage: 0, distribution: 0, pointCount };
  }

  const pointRatio = Math.min(1, pointCount / originalCandidates.length);
  const coverage = Math.min(
    1,
    pointCount / Math.max(1, originalCandidates.length * 0.1),
  );
  const distribution = pointRatio;
  const score = coverage * 0.7 + distribution * 0.3;

  return { score, coverage, distribution, pointCount };
}
