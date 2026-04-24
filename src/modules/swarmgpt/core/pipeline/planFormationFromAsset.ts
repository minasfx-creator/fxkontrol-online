import { createFormationFromAdvancedAsset, type AdvancedAssetInput } from "../../advanced/assets/createFormationFromAdvancedAsset";
import { optimizeDroneTransition } from "../../advanced/motion/optimizeDroneTransition";
import { scoreFormationFidelity } from "../../advanced/scoring/scoreFormationFidelity";
import { snapToBeat } from "../audio/snapToBeat";
import type { BeatGrid, DroneFormation, TransitionCostMatrix, ValidationReport } from "../types";
import { validateTrajectory } from "../validation/validateTrajectory";
import {
  pickEasing,
  repairPhysicalTransition,
  type PhysicsLimits,
  type PhysicsReport,
  type MotionStyle,
} from "../../physics";
import { isEnabled } from "@/lib/featureFlags";

export interface FormationPlan {
  formation: DroneFormation;
  transition: TransitionCostMatrix;
  validation: ValidationReport;
  fidelity: ReturnType<typeof scoreFormationFidelity>;
  snappedTime: number;
  /** Present only when `usePhysicsRepair` is enabled and the flag is on. */
  physics?: PhysicsReport;
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
    /** Opt-in physics matching + collision/bounds repair. Requires the
     *  `swarmgpt_physics_repair` flag. Adds `physics` to the result. */
    usePhysicsRepair?: boolean;
    /** Easing style applied during physics simulation. Default 'cinematic'. */
    motionStyle?: MotionStyle;
    /** Extra physics limits (defaults derived from `maxSpeed` + `minDistance`). */
    physicsLimits?: Partial<PhysicsLimits>;
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

  // Optional physics layer — pure, additive. Never blocks formation output.
  let physics: PhysicsReport | undefined;
  if (options.usePhysicsRepair && isEnabled("swarmgpt_physics_repair") && previousPoints.length > 0) {
    const limits: PhysicsLimits = {
      maxSpeed: options.maxSpeed,
      minSeparation: options.minDistance,
      ...options.physicsLimits,
    };
    const repaired = repairPhysicalTransition(previousPoints, optimized.points, {
      duration: options.duration,
      limits,
      ease: pickEasing(options.motionStyle ?? "cinematic"),
    });
    physics = repaired.report;
  }

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
    ...(physics ? { physics } : {}),
  };
}


