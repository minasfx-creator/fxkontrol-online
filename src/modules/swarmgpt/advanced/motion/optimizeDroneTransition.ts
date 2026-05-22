import type { Vec3 } from "../../types";
import { distance3 } from "../../utils/geometry";
import { matchPointsByGreedyCost } from "./hungarianLite";
import { matchPointsByHungarian, shouldUseHungarian } from "./hungarianOptimal";
import { isEnabled } from "@/lib/featureFlags";

export type TransitionAssignment = "greedy" | "hungarian" | "auto";

export type TransitionOptimizationReport = {
  points: Vec3[];
  maxDistance: number;
  avgDistance: number;
  maxSpeed: number;
  valid: boolean;
  /** Which matcher actually ran. Useful for telemetry / tests. */
  assignmentUsed: "greedy" | "hungarian";
};

export function optimizeDroneTransition(
  from: Vec3[],
  to: Vec3[],
  options: {
    duration: number;
    maxDroneSpeed: number;
    /** Default 'greedy' — preserves legacy behavior. 'auto' uses hungarian when feasible. */
    assignment?: TransitionAssignment;
  },
): TransitionOptimizationReport {
  if (!Array.isArray(from) || !Array.isArray(to) || from.length === 0 || to.length === 0) {
    return { points: [], maxDistance: 0, avgDistance: 0, maxSpeed: 0, valid: true, assignmentUsed: "greedy" };
  }

  const requested: TransitionAssignment = options.assignment ?? "greedy";
  const flagOn = isEnabled("swarmgpt_hungarian_optimal");
  const wantHungarian =
    (requested === "hungarian" && flagOn) ||
    (requested === "auto" && flagOn && shouldUseHungarian(from.length, to.length));

  let matched: Vec3[];
  let assignmentUsed: "greedy" | "hungarian";
  if (wantHungarian && shouldUseHungarian(from.length, to.length)) {
    matched = matchPointsByHungarian(from, to);
    assignmentUsed = "hungarian";
  } else {
    matched = matchPointsByGreedyCost(from, to);
    assignmentUsed = "greedy";
  }

  const pairCount = Math.min(from.length, matched.length);
  if (pairCount === 0) {
    return { points: [], maxDistance: 0, avgDistance: 0, maxSpeed: 0, valid: true, assignmentUsed };
  }

  let total = 0;
  let maxDistance = 0;
  for (let i = 0; i < pairCount; i++) {
    const d = distance3(from[i], matched[i]);
    total += d;
    if (d > maxDistance) maxDistance = d;
  }

  const avgDistance = total / pairCount;
  const duration = Number(options.duration);
  const maxSpeed = duration > 0 ? maxDistance / duration : Infinity;
  const maxDroneSpeed = Number(options.maxDroneSpeed);

  return {
    points: matched,
    maxDistance,
    avgDistance,
    maxSpeed,
    valid: Number.isFinite(maxDroneSpeed) ? maxSpeed <= maxDroneSpeed : false,
    assignmentUsed,
  };
}
