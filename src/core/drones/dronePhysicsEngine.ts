/**
 * ─── Drone Physics Engine ───────────────────────────────────────────
 * Real-world drone flight physics: inertia, wind drift, acceleration
 * limits, speed caps. 1 unit = 1 meter.
 *
 * Prevents impossible movements. Smooth direction changes only.
 */

export interface DroneModel {
  name: string;
  maxSpeed: number;          // m/s
  maxAcceleration: number;   // m/s²
  maxVerticalSpeed: number;  // m/s
  mass: number;              // kg
  dragCoeff: number;         // aerodynamic drag
  windSensitivity: number;   // 0-1 how much wind affects it
  maxTiltAngle: number;      // degrees
}

export interface DroneState {
  // Position (meters)
  x: number; y: number; z: number;
  // Velocity (m/s)
  vx: number; vy: number; vz: number;
  // Target position
  tx: number; ty: number; tz: number;
  // Heading (radians)
  heading: number;
  // Model reference
  model: DroneModel;
}

// ── Preset Models ───────────────────────────────────────────────────

export const DRONE_MODELS: Record<string, DroneModel> = {
  show_drone_light: {
    name: 'Show Drone (Light)',
    maxSpeed: 12,
    maxAcceleration: 6,
    maxVerticalSpeed: 5,
    mass: 1.2,
    dragCoeff: 0.15,
    windSensitivity: 0.6,
    maxTiltAngle: 25,
  },
  show_drone_heavy: {
    name: 'Show Drone (Heavy/Pyro)',
    maxSpeed: 8,
    maxAcceleration: 4,
    maxVerticalSpeed: 3,
    mass: 3.5,
    dragCoeff: 0.2,
    windSensitivity: 0.4,
    maxTiltAngle: 20,
  },
  racing_drone: {
    name: 'Racing Drone',
    maxSpeed: 30,
    maxAcceleration: 15,
    maxVerticalSpeed: 10,
    mass: 0.6,
    dragCoeff: 0.1,
    windSensitivity: 0.8,
    maxTiltAngle: 45,
  },
  cargo_drone: {
    name: 'Cargo Drone',
    maxSpeed: 6,
    maxAcceleration: 2.5,
    maxVerticalSpeed: 2,
    mass: 8.0,
    dragCoeff: 0.25,
    windSensitivity: 0.3,
    maxTiltAngle: 15,
  },
};

// ── Pre-allocated math vectors (Zero-GC) ────────────────────────────
const _desiredAccel = { x: 0, y: 0, z: 0 };
const _windForce = { x: 0, y: 0, z: 0 };

/**
 * Step drone physics for one frame.
 * @param drone - mutable drone state
 * @param dt - delta time in seconds
 * @param wind - world-space wind vector [x, y, z] in m/s
 * @returns true if drone reached target within 0.5m
 */
export function stepDronePhysics(
  drone: DroneState,
  dt: number,
  wind: [number, number, number] = [0, 0, 0],
): boolean {
  const m = drone.model;

  // ── Desired acceleration toward target ────────────────────
  const dx = drone.tx - drone.x;
  const dy = drone.ty - drone.y;
  const dz = drone.tz - drone.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (dist < 0.5) {
    // Arrive — decelerate to stop
    drone.vx *= 0.9;
    drone.vy *= 0.9;
    drone.vz *= 0.9;
    return true;
  }

  // PID-like approach: proportional + damping
  const invDist = 1 / dist;
  const arrivalFactor = Math.min(1, dist / 5); // slow down near target
  const desiredSpeed = m.maxSpeed * arrivalFactor;

  _desiredAccel.x = dx * invDist * desiredSpeed - drone.vx;
  _desiredAccel.y = dy * invDist * desiredSpeed - drone.vy;
  _desiredAccel.z = dz * invDist * desiredSpeed - drone.vz;

  // Clamp acceleration
  const accelMag = Math.sqrt(
    _desiredAccel.x ** 2 + _desiredAccel.y ** 2 + _desiredAccel.z ** 2,
  );
  if (accelMag > m.maxAcceleration) {
    const scale = m.maxAcceleration / accelMag;
    _desiredAccel.x *= scale;
    _desiredAccel.y *= scale;
    _desiredAccel.z *= scale;
  }

  // ── Wind drift ────────────────────────────────────────────
  _windForce.x = wind[0] * m.windSensitivity / m.mass;
  _windForce.y = wind[1] * m.windSensitivity / m.mass;
  _windForce.z = wind[2] * m.windSensitivity / m.mass;

  // ── Integrate velocity ────────────────────────────────────
  drone.vx += (_desiredAccel.x + _windForce.x) * dt;
  drone.vy += (_desiredAccel.y + _windForce.y) * dt;
  drone.vz += (_desiredAccel.z + _windForce.z) * dt;

  // ── Aerodynamic drag ──────────────────────────────────────
  const speed = Math.sqrt(drone.vx ** 2 + drone.vy ** 2 + drone.vz ** 2);
  if (speed > 0.01) {
    const dragDecel = m.dragCoeff * speed * dt;
    const dragFactor = Math.max(0, 1 - dragDecel / speed);
    drone.vx *= dragFactor;
    drone.vy *= dragFactor;
    drone.vz *= dragFactor;
  }

  // ── Speed clamping ────────────────────────────────────────
  const hSpeed = Math.sqrt(drone.vx ** 2 + drone.vz ** 2);
  if (hSpeed > m.maxSpeed) {
    const hScale = m.maxSpeed / hSpeed;
    drone.vx *= hScale;
    drone.vz *= hScale;
  }
  drone.vy = Math.max(-m.maxVerticalSpeed, Math.min(m.maxVerticalSpeed, drone.vy));

  // ── Integrate position ────────────────────────────────────
  drone.x += drone.vx * dt;
  drone.y += drone.vy * dt;
  drone.z += drone.vz * dt;

  // ── Ground clamp ──────────────────────────────────────────
  if (drone.y < 0.1) {
    drone.y = 0.1;
    drone.vy = Math.max(0, drone.vy);
  }

  // ── Heading (smooth rotate toward velocity direction) ─────
  if (hSpeed > 0.5) {
    const targetHeading = Math.atan2(drone.vx, drone.vz);
    let headingDiff = targetHeading - drone.heading;
    while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
    while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
    drone.heading += headingDiff * Math.min(1, 3 * dt); // smooth rotation
  }

  return false;
}

/**
 * Validate a drone waypoint transition — returns clamped target if impossible.
 */
export function validateWaypointTransition(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  timeDelta: number,
  model: DroneModel,
): { x: number; y: number; z: number; valid: boolean; reason?: string } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const requiredSpeed = dist / Math.max(0.01, timeDelta);

  if (requiredSpeed > model.maxSpeed * 1.2) {
    // Clamp to max distance
    const maxDist = model.maxSpeed * timeDelta;
    const scale = maxDist / dist;
    return {
      x: from.x + dx * scale,
      y: from.y + dy * scale,
      z: from.z + dz * scale,
      valid: false,
      reason: `Speed ${requiredSpeed.toFixed(1)}m/s exceeds max ${model.maxSpeed}m/s`,
    };
  }

  // Check vertical speed
  const verticalSpeed = Math.abs(dy) / Math.max(0.01, timeDelta);
  if (verticalSpeed > model.maxVerticalSpeed * 1.2) {
    const maxVDist = model.maxVerticalSpeed * timeDelta * Math.sign(dy);
    return {
      x: to.x,
      y: from.y + maxVDist,
      z: to.z,
      valid: false,
      reason: `Vertical speed ${verticalSpeed.toFixed(1)}m/s exceeds max ${model.maxVerticalSpeed}m/s`,
    };
  }

  return { ...to, valid: true };
}

/**
 * Create a new drone state at position with default model.
 */
export function createDroneState(
  x: number, y: number, z: number,
  modelKey: string = 'show_drone_light',
): DroneState {
  return {
    x, y, z,
    vx: 0, vy: 0, vz: 0,
    tx: x, ty: y, tz: z,
    heading: 0,
    model: DRONE_MODELS[modelKey] ?? DRONE_MODELS.show_drone_light,
  };
}
