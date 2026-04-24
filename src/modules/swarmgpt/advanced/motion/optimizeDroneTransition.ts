import type { Vec3 } from "../../types";
import { distance3 } from "../../utils/geometry";
import { matchPointsByGreedyCost } from "./hungarianLite";

export type TransitionOptimizationReport = {
  points: Vec3[];
  maxDistance: number;
  avgDistance: number;
  maxSpeed: number;
  valid: boolean;
};

export function optimizeDroneTransition(
  from: Vec3[],
  to: Vec3[],
  options: {
    duration: number;
    maxDroneSpeed: number;
  },
): TransitionOptimizationReport {
  if (!Array.isArray(from) || !Array.isArray(to) || from.length === 0 || to.length === 0) {
    return { points: [], maxDistance: 0, avgDistance: 0, maxSpeed: 0, valid: true };
  }

  const matched = matchPointsByGreedyCost(from, to);
  const pairCount = Math.min(from.length, matched.length);
  if (pairCount === 0) return { points: [], maxDistance: 0, avgDistance: 0, maxSpeed: 0, valid: true };

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
  };
}

