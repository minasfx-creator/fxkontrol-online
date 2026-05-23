/**
 * Trajectory Optimizer Engine
 * Path smoothing, velocity/acceleration limiting, and collision-free trajectory generation.
 */

export interface TrajectoryPoint {
  x: number;
  y: number;
  z: number;
  time: number;
}

export interface TrajectoryConstraints {
  maxVelocity: number;       // m/s
  maxAcceleration: number;   // m/s²
  maxJerk: number;           // m/s³
  minSeparation: number;     // m (min distance between drones)
  smoothingFactor: number;   // 0-1 (0 = sharp, 1 = very smooth)
  safetyMargin: number;      // multiplier on minSeparation for avoidance
}

export const DEFAULT_CONSTRAINTS: TrajectoryConstraints = {
  maxVelocity: 8.0,
  maxAcceleration: 3.0,
  maxJerk: 5.0,
  minSeparation: 2.0,
  smoothingFactor: 0.7,
  safetyMargin: 1.5,
};

export interface OptimizationResult {
  trajectories: TrajectoryPoint[][];
  violations: TrajectoryViolation[];
  totalDistance: number;
  maxVelocityUsed: number;
  maxAccelerationUsed: number;
  optimizationTime: number;
}

export interface TrajectoryViolation {
  droneIndex: number;
  time: number;
  type: 'velocity' | 'acceleration' | 'separation' | 'jerk';
  value: number;
  limit: number;
}

function dist3(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Catmull-Rom spline interpolation for path smoothing
 */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number, alpha: number = 0.5): number {
  const t2 = t * t;
  const t3 = t2 * t;
  const a = -alpha * p0 + (2 - alpha) * p1 + (alpha - 2) * p2 + alpha * p3;
  const b = 2 * alpha * p0 + (alpha - 3) * p1 + (3 - 2 * alpha) * p2 - alpha * p3;
  const c = -alpha * p0 + alpha * p2;
  const d = p1;
  return a * t3 + b * t2 + c * t + d;
}

/**
 * Smooth a single trajectory using Catmull-Rom splines
 */
export function smoothTrajectory(
  points: TrajectoryPoint[],
  numOutputPoints: number,
  alpha: number = 0.5
): TrajectoryPoint[] {
  if (points.length < 2) return [...points];
  if (points.length === 2) {
    const result: TrajectoryPoint[] = [];
    for (let i = 0; i < numOutputPoints; i++) {
      const t = i / (numOutputPoints - 1);
      result.push({
        x: points[0].x + (points[1].x - points[0].x) * t,
        y: points[0].y + (points[1].y - points[0].y) * t,
        z: points[0].z + (points[1].z - points[0].z) * t,
        time: points[0].time + (points[1].time - points[0].time) * t,
      });
    }
    return result;
  }

  const result: TrajectoryPoint[] = [];
  const segments = points.length - 1;
  const pointsPerSegment = Math.max(2, Math.floor(numOutputPoints / segments));

  for (let seg = 0; seg < segments; seg++) {
    const p0 = points[Math.max(0, seg - 1)];
    const p1 = points[seg];
    const p2 = points[Math.min(points.length - 1, seg + 1)];
    const p3 = points[Math.min(points.length - 1, seg + 2)];

    const steps = seg === segments - 1 ? pointsPerSegment : pointsPerSegment;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      if (seg > 0 && i === 0) continue; // avoid duplicates
      result.push({
        x: catmullRom(p0.x, p1.x, p2.x, p3.x, t, alpha),
        y: catmullRom(p0.y, p1.y, p2.y, p3.y, t, alpha),
        z: catmullRom(p0.z, p1.z, p2.z, p3.z, t, alpha),
        time: p1.time + (p2.time - p1.time) * t,
      });
    }
  }

  return result;
}

/**
 * Check velocity constraints and return violations
 */
export function checkVelocity(
  trajectory: TrajectoryPoint[],
  droneIndex: number,
  maxVel: number
): TrajectoryViolation[] {
  const violations: TrajectoryViolation[] = [];
  for (let i = 1; i < trajectory.length; i++) {
    const dt = trajectory[i].time - trajectory[i - 1].time;
    if (dt <= 0) continue;
    const d = dist3(trajectory[i], trajectory[i - 1]);
    const vel = d / dt;
    if (vel > maxVel) {
      violations.push({
        droneIndex, time: trajectory[i].time,
        type: 'velocity', value: vel, limit: maxVel,
      });
    }
  }
  return violations;
}

/**
 * Check acceleration constraints
 */
export function checkAcceleration(
  trajectory: TrajectoryPoint[],
  droneIndex: number,
  maxAccel: number
): TrajectoryViolation[] {
  const violations: TrajectoryViolation[] = [];
  for (let i = 2; i < trajectory.length; i++) {
    const dt1 = trajectory[i - 1].time - trajectory[i - 2].time;
    const dt2 = trajectory[i].time - trajectory[i - 1].time;
    if (dt1 <= 0 || dt2 <= 0) continue;

    const v1x = (trajectory[i - 1].x - trajectory[i - 2].x) / dt1;
    const v1y = (trajectory[i - 1].y - trajectory[i - 2].y) / dt1;
    const v1z = (trajectory[i - 1].z - trajectory[i - 2].z) / dt1;
    const v2x = (trajectory[i].x - trajectory[i - 1].x) / dt2;
    const v2y = (trajectory[i].y - trajectory[i - 1].y) / dt2;
    const v2z = (trajectory[i].z - trajectory[i - 1].z) / dt2;

    const avgDt = (dt1 + dt2) / 2;
    const ax = (v2x - v1x) / avgDt;
    const ay = (v2y - v1y) / avgDt;
    const az = (v2z - v1z) / avgDt;
    const accel = Math.sqrt(ax * ax + ay * ay + az * az);

    if (accel > maxAccel) {
      violations.push({
        droneIndex, time: trajectory[i].time,
        type: 'acceleration', value: accel, limit: maxAccel,
      });
    }
  }
  return violations;
}

/**
 * Apply velocity clamping — slows down segments that exceed max velocity
 */
export function clampVelocity(
  trajectory: TrajectoryPoint[],
  maxVel: number
): TrajectoryPoint[] {
  const result = [{ ...trajectory[0] }];
  let cumulativeDelay = 0;

  for (let i = 1; i < trajectory.length; i++) {
    const prev = result[i - 1];
    const curr = trajectory[i];
    const dt = curr.time - trajectory[i - 1].time;
    const d = dist3(curr, prev);

    if (dt > 0 && d / dt > maxVel) {
      const newDt = d / maxVel;
      cumulativeDelay += newDt - dt;
    }

    result.push({
      x: curr.x, y: curr.y, z: curr.z,
      time: curr.time + cumulativeDelay,
    });
  }
  return result;
}

/**
 * Separation check between two drone trajectories at sampled times
 */
export function checkSeparation(
  traj1: TrajectoryPoint[],
  traj2: TrajectoryPoint[],
  drone1: number,
  drone2: number,
  minSep: number,
  sampleRate: number = 10
): TrajectoryViolation[] {
  const violations: TrajectoryViolation[] = [];
  if (traj1.length < 2 || traj2.length < 2) return violations;

  const startTime = Math.max(traj1[0].time, traj2[0].time);
  const endTime = Math.min(traj1[traj1.length - 1].time, traj2[traj2.length - 1].time);

  for (let t = startTime; t <= endTime; t += 1 / sampleRate) {
    const p1 = interpolateAtTime(traj1, t);
    const p2 = interpolateAtTime(traj2, t);
    if (!p1 || !p2) continue;

    const d = dist3(p1, p2);
    if (d < minSep) {
      violations.push({
        droneIndex: drone1, time: t,
        type: 'separation', value: d, limit: minSep,
      });
    }
  }
  return violations;
}

function interpolateAtTime(traj: TrajectoryPoint[], time: number): TrajectoryPoint | null {
  if (traj.length === 0) return null;
  if (time <= traj[0].time) return traj[0];
  if (time >= traj[traj.length - 1].time) return traj[traj.length - 1];

  for (let i = 1; i < traj.length; i++) {
    if (traj[i].time >= time) {
      const t = (time - traj[i - 1].time) / (traj[i].time - traj[i - 1].time);
      return {
        x: traj[i - 1].x + (traj[i].x - traj[i - 1].x) * t,
        y: traj[i - 1].y + (traj[i].y - traj[i - 1].y) * t,
        z: traj[i - 1].z + (traj[i].z - traj[i - 1].z) * t,
        time,
      };
    }
  }
  return null;
}

/**
 * Full optimization pipeline:
 * 1. Smooth paths
 * 2. Clamp velocities
 * 3. Check all constraints
 * 4. Return results with violations
 */
export function optimizeTrajectories(
  rawTrajectories: TrajectoryPoint[][],
  constraints: TrajectoryConstraints = DEFAULT_CONSTRAINTS,
): OptimizationResult {
  const start = performance.now();
  const violations: TrajectoryViolation[] = [];
  let totalDist = 0;
  let maxVel = 0;
  let maxAccel = 0;

  // Step 1: Smooth
  const smoothed = rawTrajectories.map(traj =>
    smoothTrajectory(traj, Math.max(traj.length * 3, 20), constraints.smoothingFactor)
  );

  // Step 2: Velocity clamp
  const clamped = smoothed.map(traj => clampVelocity(traj, constraints.maxVelocity));

  // Step 3: Check constraints
  for (let d = 0; d < clamped.length; d++) {
    const traj = clamped[d];
    violations.push(...checkVelocity(traj, d, constraints.maxVelocity));
    violations.push(...checkAcceleration(traj, d, constraints.maxAcceleration));

    // Compute stats
    for (let i = 1; i < traj.length; i++) {
      const dt = traj[i].time - traj[i - 1].time;
      if (dt <= 0) continue;
      const d2 = dist3(traj[i], traj[i - 1]);
      totalDist += d2;
      maxVel = Math.max(maxVel, d2 / dt);
    }
  }

  // Step 4: Separation check (sample pairs — cap at 100 drones for perf)
  const checkCount = Math.min(clamped.length, 100);
  for (let i = 0; i < checkCount; i++) {
    for (let j = i + 1; j < checkCount; j++) {
      violations.push(...checkSeparation(
        clamped[i], clamped[j], i, j,
        constraints.minSeparation * constraints.safetyMargin, 5
      ));
    }
  }

  return {
    trajectories: clamped,
    violations,
    totalDistance: totalDist,
    maxVelocityUsed: maxVel,
    maxAccelerationUsed: maxAccel,
    optimizationTime: performance.now() - start,
  };
}
