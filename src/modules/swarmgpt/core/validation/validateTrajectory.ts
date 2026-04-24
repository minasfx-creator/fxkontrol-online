import type { Vec3 } from "../../types";
import type { ValidationReport } from "../types";
import { distance3 } from "../../utils/geometry";

export function validateTrajectory(
  from: Vec3[],
  to: Vec3[],
  options: {
    duration: number;
    maxSpeed: number;
    minDistance: number;
  },
): ValidationReport {
  const violations: string[] = [];
  const duration = Math.max(1e-6, options.duration);
  const maxSpeedLimit = Math.max(0, options.maxSpeed);
  const minDistance = Math.max(0, options.minDistance);

  let maxDistance = 0;
  let maxSpeed = 0;
  const n = Math.min(from.length, to.length);
  for (let i = 0; i < n; i++) {
    const d = distance3(from[i], to[i]);
    maxDistance = Math.max(maxDistance, d);
    maxSpeed = Math.max(maxSpeed, d / duration);
  }

  if (maxSpeed > maxSpeedLimit) {
    violations.push(`maxSpeedExceeded:${maxSpeed.toFixed(2)}>${maxSpeedLimit.toFixed(2)}`);
  }

  for (let i = 0; i < to.length; i++) {
    for (let j = i + 1; j < to.length; j++) {
      if (distance3(to[i], to[j]) < minDistance) {
        violations.push(`minDistanceViolation:${i}-${j}`);
        i = to.length; // early break
        break;
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    maxSpeed,
    maxDistance,
  };
}

