import { createFormationFromAdvancedAsset, type AdvancedAssetInput } from "../../advanced/assets/createFormationFromAdvancedAsset";
import { optimizeDroneTransition } from "../../advanced/motion/optimizeDroneTransition";
import { scoreFormationFidelity } from "../../advanced/scoring/scoreFormationFidelity";
import { snapToBeat } from "../audio/snapToBeat";
import type { BeatGrid, DroneFormation, TransitionCostMatrix, ValidationReport } from "../types";
import { validateTrajectory } from "../validation/validateTrajectory";

export interface FormationPlan {
  formation: DroneFormation;
  transition: TransitionCostMatrix;
  validation: ValidationReport;
  fidelity: ReturnType<typeof scoreFormationFidelity>;
  snappedTime: number;
}

export function planFormationFromAsset(
  asset: AdvancedAssetInput,
  previousPoints: DroneFormation["points"],
  options: {
    droneCount: number;
    minDistance: number;
    maxSpeed: number;
    duration: number;
    beatGrid?: BeatGrid;
    cueTime: number;
    /** Reduction strategy. Default 'weighted'. 'poisson+fps' guarantees exact droneCount. */
    samplingStrategy?: "weighted" | "poisson+fps";
  },
): FormationPlan {
  const nextPoints = createFormationFromAdvancedAsset(asset, {
    droneCount: options.droneCount,
    minDistance: options.minDistance,
    samplingStrategy: options.samplingStrategy,
  });

  const optimized = optimizeDroneTransition(previousPoints, nextPoints, {
    duration: options.duration,
    maxDroneSpeed: options.maxSpeed,
  });
  const validation = validateTrajectory(previousPoints, optimized.points, {
    duration: options.duration,
    maxSpeed: options.maxSpeed,
    minDistance: options.minDistance,
  });

  // Surface spacing-induced under-population: if Poisson sampling could not
  // honor droneCount because the source asset's points are closer than
  // minDistance, report it as a minDistanceViolation so callers can react.
  if (optimized.points.length < options.droneCount) {
    const deficit = options.droneCount - optimized.points.length;
    validation.violations.push(
      `minDistanceViolation:underPopulated:${optimized.points.length}/${options.droneCount}:deficit=${deficit}`,
    );
    validation.valid = false;
  }

  const fidelity = scoreFormationFidelity(nextPoints, optimized.points);
  const snappedTime = options.beatGrid
    ? snapToBeat(options.cueTime, options.beatGrid.offsets)
    : options.cueTime;

  return {
    formation: { points: optimized.points },
    transition: {
      fromCount: previousPoints.length,
      toCount: optimized.points.length,
      maxDistance: optimized.maxDistance,
      avgDistance: optimized.avgDistance,
    },
    validation,
    fidelity,
    snappedTime,
  };
}

