/**
 * SwarmGPT Physics — Kinematic + collision + bounds validators.
 *
 * Three pure validators that operate on `PhysicalTrajectory` and return a
 * (capped) issues array plus aggregate metrics. Designed to be cheap enough
 * for live preview — collision detection uses a uniform spatial hash so
 * cost is ~O(N · k) per sample where k is the avg cell occupancy.
 */
import type { Bounds, Vec3 } from '../types';
import { distance3, isInsideBounds } from '../utils/geometry';
import {
  capIssues,
  type PhysicalTrajectory,
  type PhysicsIssue,
  type PhysicsLimits,
} from './types';

export interface KinematicMetrics {
  maxSpeedUsed: number;
  maxAccelerationUsed: number;
  maxJerkUsed: number;
}

export interface KinematicResult {
  issues: PhysicsIssue[];
  truncated: boolean;
  metrics: KinematicMetrics;
}

export interface CollisionMetrics {
  minDistanceObserved: number;
  collisionCount: number;
}

export interface CollisionResult {
  issues: PhysicsIssue[];
  truncated: boolean;
  metrics: CollisionMetrics;
}

export interface BoundsResult {
  issues: PhysicsIssue[];
  truncated: boolean;
}

// ── Kinematics ───────────────────────────────────────────────────────────
export function validateKinematics(
  traj: PhysicalTrajectory,
  limits: PhysicsLimits,
  maxIssues = 200,
): KinematicResult {
  const issues: PhysicsIssue[] = [];
  let maxSpeed = 0, maxAccel = 0, maxJerk = 0;
  const { dronePaths, times } = traj;

  for (let i = 0; i < dronePaths.length; i++) {
    const path = dronePaths[i];
    let prevSpeed = 0;
    let prevAccel = 0;
    for (let s = 1; s < path.length; s++) {
      const dt = Math.max(1e-6, times[s] - times[s - 1]);
      const speed = distance3(path[s], path[s - 1]) / dt;
      if (speed > maxSpeed) maxSpeed = speed;
      if (speed > limits.maxSpeed) {
        if (issues.length < maxIssues) {
          issues.push({
            kind: 'speed',
            severity: speed > limits.maxSpeed * 1.25 ? 'error' : 'warning',
            message: `drone ${i} exceeds maxSpeed at t=${times[s].toFixed(2)}s`,
            drone: i,
            time: times[s],
            value: speed,
            limit: limits.maxSpeed,
          });
        }
      }

      if (s >= 2) {
        const accel = Math.abs(speed - prevSpeed) / dt;
        if (accel > maxAccel) maxAccel = accel;
        if (limits.maxAcceleration !== undefined && accel > limits.maxAcceleration) {
          if (issues.length < maxIssues) {
            issues.push({
              kind: 'acceleration', severity: 'warning',
              message: `drone ${i} exceeds maxAcceleration at t=${times[s].toFixed(2)}s`,
              drone: i, time: times[s], value: accel, limit: limits.maxAcceleration,
            });
          }
        }
        if (s >= 3) {
          const jerk = Math.abs(accel - prevAccel) / dt;
          if (jerk > maxJerk) maxJerk = jerk;
          if (limits.maxJerk !== undefined && jerk > limits.maxJerk) {
            if (issues.length < maxIssues) {
              issues.push({
                kind: 'jerk', severity: 'warning',
                message: `drone ${i} exceeds maxJerk at t=${times[s].toFixed(2)}s`,
                drone: i, time: times[s], value: jerk, limit: limits.maxJerk,
              });
            }
          }
        }
        prevAccel = accel;
      }
      prevSpeed = speed;
    }
  }

  const cap = capIssues(issues, maxIssues);
  return {
    issues: cap.issues,
    truncated: cap.truncated,
    metrics: { maxSpeedUsed: maxSpeed, maxAccelerationUsed: maxAccel, maxJerkUsed: maxJerk },
  };
}

// ── Collision (full-trajectory, sampled, spatial hash) ───────────────────
function cellKey(p: Vec3, cellSize: number): string {
  return `${Math.floor(p.x / cellSize)}|${Math.floor(p.y / cellSize)}|${Math.floor(p.z / cellSize)}`;
}

export function validateCollisions(
  traj: PhysicalTrajectory,
  minSeparation: number,
  maxIssues = 200,
): CollisionResult {
  const issues: PhysicsIssue[] = [];
  let minDist = Infinity;
  let collisions = 0;
  const { dronePaths, times } = traj;
  const droneCount = dronePaths.length;
  const sampleCount = times.length;
  const cellSize = Math.max(0.001, minSeparation);
  const minSepSq = minSeparation * minSeparation;

  for (let s = 0; s < sampleCount; s++) {
    const grid = new Map<string, number[]>();
    for (let i = 0; i < droneCount; i++) {
      const p = dronePaths[i][s];
      if (!p) continue;
      const k = cellKey(p, cellSize);
      const bucket = grid.get(k);
      if (bucket) bucket.push(i); else grid.set(k, [i]);
    }

    // Compare each drone with neighbors in its 27 cells.
    for (let i = 0; i < droneCount; i++) {
      const p = dronePaths[i][s];
      if (!p) continue;
      const cx = Math.floor(p.x / cellSize);
      const cy = Math.floor(p.y / cellSize);
      const cz = Math.floor(p.z / cellSize);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let oz = -1; oz <= 1; oz++) {
            const bucket = grid.get(`${cx + ox}|${cy + oy}|${cz + oz}`);
            if (!bucket) continue;
            for (const j of bucket) {
              if (j <= i) continue;
              const q = dronePaths[j][s];
              const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z;
              const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 < minSepSq) {
                const d = Math.sqrt(d2);
                if (d < minDist) minDist = d;
                collisions++;
                if (issues.length < maxIssues) {
                  issues.push({
                    kind: 'collision',
                    severity: d < minSeparation * 0.5 ? 'blocker' : 'error',
                    message: `drones ${i}&${j} too close at t=${times[s].toFixed(2)}s`,
                    drone: [i, j],
                    time: times[s],
                    value: d,
                    limit: minSeparation,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  const cap = capIssues(issues, maxIssues);
  return {
    issues: cap.issues,
    truncated: cap.truncated,
    metrics: {
      minDistanceObserved: Number.isFinite(minDist) ? minDist : Infinity,
      collisionCount: collisions,
    },
  };
}

// ── Bounds (every sample) ────────────────────────────────────────────────
export function validateBounds(
  traj: PhysicalTrajectory,
  bounds: Bounds,
  maxIssues = 200,
): BoundsResult {
  const issues: PhysicsIssue[] = [];
  const { dronePaths, times } = traj;
  for (let i = 0; i < dronePaths.length; i++) {
    const path = dronePaths[i];
    for (let s = 0; s < path.length; s++) {
      const p = path[s];
      if (!isInsideBounds(p, bounds)) {
        if (issues.length < maxIssues) {
          issues.push({
            kind: 'bounds',
            severity: 'blocker',
            message: `drone ${i} outside bounds at t=${times[s].toFixed(2)}s`,
            drone: i,
            time: times[s],
          });
        }
      }
    }
  }
  const cap = capIssues(issues, maxIssues);
  return { issues: cap.issues, truncated: cap.truncated };
}
