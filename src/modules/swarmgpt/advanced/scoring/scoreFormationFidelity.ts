import type { Vec3 } from "../../types";

export type FormationFidelityScore = {
  score: number;
  coverage: number;
  distribution: number;
  pointCount: number;
};

export function scoreFormationFidelity(
  originalCandidates: Vec3[],
  sampledPoints: Vec3[],
): FormationFidelityScore {
  if (!Array.isArray(originalCandidates) || !Array.isArray(sampledPoints) || originalCandidates.length === 0 || sampledPoints.length === 0) {
    return { score: 0, coverage: 0, distribution: 0, pointCount: sampledPoints?.length ?? 0 };
  }

  const pointRatio = Math.min(1, sampledPoints.length / originalCandidates.length);
  const coverage = Math.min(1, sampledPoints.length / Math.max(1, originalCandidates.length * 0.1));
  const distribution = pointRatio;

  return {
    score: coverage * 0.7 + distribution * 0.3,
    coverage,
    distribution,
    pointCount: sampledPoints.length,
  };
}

