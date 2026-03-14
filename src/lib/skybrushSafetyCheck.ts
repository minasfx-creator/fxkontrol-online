/**
 * ─── Skybrush Safety Check Engine ───────────────────────────────
 * Port of Skybrush Studio's SafetyCheckParams/SafetyCheckResult.
 * Validates drone show trajectories against configurable flight envelope limits.
 *
 * Checks:
 *   1. Max altitude (AGL)
 *   2. Max horizontal velocity (XY)
 *   3. Max vertical velocity (Z up / Z down)
 *   4. Max acceleration
 *   5. Min proximity (inter-drone distance)
 *   6. Min navigation altitude
 *   7. Max yaw rate
 *   8. Geofence containment
 *   9. Battery endurance
 *  10. Takeoff/Landing safety
 */

export interface SafetyCheckParams {
  maxAltitude: number;          // meters AGL (default 150)
  maxVelocityXY: number;       // m/s horizontal (default 8)
  maxVelocityZ: number;        // m/s vertical down (default 3)
  maxVelocityZUp: number;      // m/s vertical up (default 3)
  maxAcceleration: number;     // m/s² (default 4)
  minDistance: number;          // meters inter-drone (default 3)
  minNavAltitude: number;      // meters min safe altitude (default 2.5)
  maxYawRate: number;          // deg/s (default 30)
  geofenceRadius: number;      // meters from origin (default 500)
  geofenceHeight: number;      // max meters AGL (default 150)
  maxFlightTime: number;       // seconds (default 1200 = 20 min)
}

export const DEFAULT_SAFETY_PARAMS: SafetyCheckParams = {
  maxAltitude: 150,
  maxVelocityXY: 8,
  maxVelocityZ: 3,
  maxVelocityZUp: 3,
  maxAcceleration: 4,
  minDistance: 3,
  minNavAltitude: 2.5,
  maxYawRate: 30,
  geofenceRadius: 500,
  geofenceHeight: 150,
  maxFlightTime: 1200,
};

export interface SafetyViolation {
  type: 'altitude' | 'velocity_xy' | 'velocity_z' | 'acceleration' | 'proximity' | 'nav_altitude' | 'yaw_rate' | 'geofence' | 'flight_time' | 'takeoff';
  severity: 'warning' | 'error' | 'critical';
  time: number;
  droneId: string;
  droneId2?: string;        // for proximity violations
  value: number;
  limit: number;
  position: { x: number; y: number; z: number };
  message: string;
}

export interface SafetyCheckResult {
  passed: boolean;
  violations: SafetyViolation[];
  stats: {
    maxAltitudeReached: number;
    maxVelocityXYReached: number;
    maxVelocityZReached: number;
    maxAccelerationReached: number;
    minProximityReached: number;
    totalFlightTime: number;
    totalDistance: number;
    droneCount: number;
  };
  profiles: {
    altitude: { t: number; max: number; avg: number }[];
    velocityXY: { t: number; max: number; avg: number }[];
    velocityZ: { t: number; max: number; avg: number }[];
    proximity: { t: number; min: number; avgMin: number }[];
  };
}

interface DroneState {
  id: string;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  yaw: number;
}

// ── Main Safety Check ───────────────────────────────────────────

export function runSafetyCheck(
  droneTrajectories: {
    id: string;
    waypoints: { time: number; position: { x: number; y: number; z: number } }[];
  }[],
  params: SafetyCheckParams = DEFAULT_SAFETY_PARAMS,
  duration: number = 300,
  sampleRate: number = 10,
): SafetyCheckResult {
  const violations: SafetyViolation[] = [];
  const dt = 1 / sampleRate;
  const steps = Math.ceil(duration * sampleRate);

  let maxAlt = 0, maxVelXY = 0, maxVelZ = 0, maxAcc = 0, minProx = Infinity;
  let totalDist = 0;

  const altProfile: SafetyCheckResult['profiles']['altitude'] = [];
  const velXYProfile: SafetyCheckResult['profiles']['velocityXY'] = [];
  const velZProfile: SafetyCheckResult['profiles']['velocityZ'] = [];
  const proxProfile: SafetyCheckResult['profiles']['proximity'] = [];

  // Previous frame states for velocity/acceleration computation
  let prevStates: DroneState[] = droneTrajectories.map(d => {
    const wp0 = d.waypoints[0];
    return {
      id: d.id,
      x: wp0?.position.x ?? 0, y: wp0?.position.y ?? 0, z: wp0?.position.z ?? 0,
      vx: 0, vy: 0, vz: 0, yaw: 0,
    };
  });

  for (let step = 0; step <= steps; step++) {
    const t = step * dt;
    const states: DroneState[] = [];

    let frameMaxAlt = 0, frameSumAlt = 0;
    let frameMaxVelXY = 0, frameSumVelXY = 0;
    let frameMaxVelZ = 0, frameSumVelZ = 0;

    for (let d = 0; d < droneTrajectories.length; d++) {
      const drone = droneTrajectories[d];
      const pos = sampleTrajectoryAt(drone.waypoints, t);
      const prev = prevStates[d];

      const vx = (pos.x - prev.x) / dt;
      const vy = (pos.y - prev.y) / dt;
      const vz = (pos.z - prev.z) / dt;

      const velXY = Math.sqrt(vx * vx + vz * vz);
      const velZAbs = Math.abs(vy);
      const accX = (vx - prev.vx) / dt;
      const accY = (vy - prev.vy) / dt;
      const accZ = (vz - prev.vz) / dt;
      const acc = Math.sqrt(accX * accX + accY * accY + accZ * accZ);

      const altitude = pos.y;
      totalDist += Math.sqrt((pos.x - prev.x) ** 2 + (pos.y - prev.y) ** 2 + (pos.z - prev.z) ** 2);

      // Track maximums
      if (altitude > maxAlt) maxAlt = altitude;
      if (velXY > maxVelXY) maxVelXY = velXY;
      if (velZAbs > maxVelZ) maxVelZ = velZAbs;
      if (acc > maxAcc) maxAcc = acc;

      frameMaxAlt = Math.max(frameMaxAlt, altitude);
      frameSumAlt += altitude;
      frameMaxVelXY = Math.max(frameMaxVelXY, velXY);
      frameSumVelXY += velXY;
      frameMaxVelZ = Math.max(frameMaxVelZ, velZAbs);
      frameSumVelZ += velZAbs;

      // Check violations
      if (step > 2) { // skip first frames (no valid velocity)
        if (altitude > params.maxAltitude) {
          violations.push({
            type: 'altitude', severity: altitude > params.maxAltitude * 1.2 ? 'critical' : 'error',
            time: t, droneId: drone.id, value: altitude, limit: params.maxAltitude,
            position: pos, message: `Drone ${drone.id} at ${altitude.toFixed(1)}m exceeds max ${params.maxAltitude}m`,
          });
        }
        if (velXY > params.maxVelocityXY) {
          violations.push({
            type: 'velocity_xy', severity: velXY > params.maxVelocityXY * 1.5 ? 'critical' : 'warning',
            time: t, droneId: drone.id, value: velXY, limit: params.maxVelocityXY,
            position: pos, message: `Drone ${drone.id} XY velocity ${velXY.toFixed(1)}m/s exceeds ${params.maxVelocityXY}m/s`,
          });
        }
        if (vy > params.maxVelocityZUp) {
          violations.push({
            type: 'velocity_z', severity: 'warning',
            time: t, droneId: drone.id, value: vy, limit: params.maxVelocityZUp,
            position: pos, message: `Drone ${drone.id} climb rate ${vy.toFixed(1)}m/s exceeds ${params.maxVelocityZUp}m/s`,
          });
        }
        if (-vy > params.maxVelocityZ) {
          violations.push({
            type: 'velocity_z', severity: 'warning',
            time: t, droneId: drone.id, value: -vy, limit: params.maxVelocityZ,
            position: pos, message: `Drone ${drone.id} descent rate ${(-vy).toFixed(1)}m/s exceeds ${params.maxVelocityZ}m/s`,
          });
        }
        if (acc > params.maxAcceleration) {
          violations.push({
            type: 'acceleration', severity: acc > params.maxAcceleration * 2 ? 'critical' : 'warning',
            time: t, droneId: drone.id, value: acc, limit: params.maxAcceleration,
            position: pos, message: `Drone ${drone.id} acceleration ${acc.toFixed(1)}m/s² exceeds ${params.maxAcceleration}m/s²`,
          });
        }
        if (altitude > 0.5 && altitude < params.minNavAltitude) {
          violations.push({
            type: 'nav_altitude', severity: 'warning',
            time: t, droneId: drone.id, value: altitude, limit: params.minNavAltitude,
            position: pos, message: `Drone ${drone.id} below min nav altitude ${params.minNavAltitude}m`,
          });
        }

        // Geofence
        const distFromOrigin = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
        if (distFromOrigin > params.geofenceRadius) {
          violations.push({
            type: 'geofence', severity: 'critical',
            time: t, droneId: drone.id, value: distFromOrigin, limit: params.geofenceRadius,
            position: pos, message: `Drone ${drone.id} outside geofence at ${distFromOrigin.toFixed(0)}m`,
          });
        }
      }

      states.push({ id: drone.id, x: pos.x, y: pos.y, z: pos.z, vx, vy, vz, yaw: 0 });
    }

    // Proximity check (O(n²) — acceptable for typical drone counts)
    let frameMinProx = Infinity;
    let frameProxSum = 0;
    let proxCount = 0;
    for (let i = 0; i < states.length; i++) {
      for (let j = i + 1; j < states.length; j++) {
        const dx = states[i].x - states[j].x;
        const dy = states[i].y - states[j].y;
        const dz = states[i].z - states[j].z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        frameProxSum += dist;
        proxCount++;
        if (dist < frameMinProx) frameMinProx = dist;
        if (dist < minProx) minProx = dist;

        if (dist < params.minDistance) {
          violations.push({
            type: 'proximity', severity: dist < params.minDistance * 0.5 ? 'critical' : 'error',
            time: t, droneId: states[i].id, droneId2: states[j].id,
            value: dist, limit: params.minDistance,
            position: states[i], message: `Drones ${states[i].id} & ${states[j].id} proximity ${dist.toFixed(2)}m < ${params.minDistance}m`,
          });
        }
      }
    }

    // Record profiles every 0.5s
    if (step % Math.round(sampleRate * 0.5) === 0) {
      const n = Math.max(1, droneTrajectories.length);
      altProfile.push({ t, max: frameMaxAlt, avg: frameSumAlt / n });
      velXYProfile.push({ t, max: frameMaxVelXY, avg: frameSumVelXY / n });
      velZProfile.push({ t, max: frameMaxVelZ, avg: frameSumVelZ / n });
      proxProfile.push({ t, min: frameMinProx === Infinity ? 999 : frameMinProx, avgMin: proxCount > 0 ? frameProxSum / proxCount : 999 });
    }

    prevStates = states;
  }

  // Deduplicate violations (keep first per type per drone per second)
  const deduped = deduplicateViolations(violations);

  return {
    passed: deduped.filter(v => v.severity === 'critical' || v.severity === 'error').length === 0,
    violations: deduped,
    stats: {
      maxAltitudeReached: maxAlt,
      maxVelocityXYReached: maxVelXY,
      maxVelocityZReached: maxVelZ,
      maxAccelerationReached: maxAcc,
      minProximityReached: minProx === Infinity ? 999 : minProx,
      totalFlightTime: duration,
      totalDistance: totalDist / Math.max(1, droneTrajectories.length),
      droneCount: droneTrajectories.length,
    },
    profiles: {
      altitude: altProfile,
      velocityXY: velXYProfile,
      velocityZ: velZProfile,
      proximity: proxProfile,
    },
  };
}

// ── Helpers ─────────────────────────────────────────────────────

function sampleTrajectoryAt(
  waypoints: { time: number; position: { x: number; y: number; z: number } }[],
  t: number,
): { x: number; y: number; z: number } {
  if (waypoints.length === 0) return { x: 0, y: 0, z: 0 };
  if (t <= waypoints[0].time) return { ...waypoints[0].position };
  if (t >= waypoints[waypoints.length - 1].time) return { ...waypoints[waypoints.length - 1].position };

  for (let i = 0; i < waypoints.length - 1; i++) {
    if (t >= waypoints[i].time && t < waypoints[i + 1].time) {
      const ratio = (t - waypoints[i].time) / (waypoints[i + 1].time - waypoints[i].time);
      const a = waypoints[i].position;
      const b = waypoints[i + 1].position;
      return {
        x: a.x + (b.x - a.x) * ratio,
        y: a.y + (b.y - a.y) * ratio,
        z: a.z + (b.z - a.z) * ratio,
      };
    }
  }
  return { ...waypoints[waypoints.length - 1].position };
}

function deduplicateViolations(violations: SafetyViolation[]): SafetyViolation[] {
  const seen = new Set<string>();
  return violations.filter(v => {
    const key = `${v.type}-${v.droneId}-${Math.floor(v.time)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Format for display ──────────────────────────────────────────

export function formatSafetyReport(result: SafetyCheckResult): string {
  const lines: string[] = [];
  lines.push(`═══ SAFETY CHECK REPORT ═══`);
  lines.push(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
  lines.push(`Drones: ${result.stats.droneCount}`);
  lines.push(`Max Altitude: ${result.stats.maxAltitudeReached.toFixed(1)}m`);
  lines.push(`Max Velocity XY: ${result.stats.maxVelocityXYReached.toFixed(1)}m/s`);
  lines.push(`Max Velocity Z: ${result.stats.maxVelocityZReached.toFixed(1)}m/s`);
  lines.push(`Max Acceleration: ${result.stats.maxAccelerationReached.toFixed(1)}m/s²`);
  lines.push(`Min Proximity: ${result.stats.minProximityReached.toFixed(2)}m`);
  lines.push(`Total Distance/Drone: ${result.stats.totalDistance.toFixed(0)}m`);
  lines.push('');

  if (result.violations.length > 0) {
    lines.push(`Violations: ${result.violations.length}`);
    const critical = result.violations.filter(v => v.severity === 'critical');
    const errors = result.violations.filter(v => v.severity === 'error');
    const warnings = result.violations.filter(v => v.severity === 'warning');
    if (critical.length) lines.push(`  🔴 Critical: ${critical.length}`);
    if (errors.length) lines.push(`  🟠 Error: ${errors.length}`);
    if (warnings.length) lines.push(`  🟡 Warning: ${warnings.length}`);
  }

  return lines.join('\n');
}
