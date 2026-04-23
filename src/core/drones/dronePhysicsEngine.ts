export interface DroneModel {
  name: string;
  maxSpeed: number;
  maxVerticalSpeed: number;
  acceleration: number;
  verticalAcceleration: number;
  mass: number;
  windSensitivity: number;
}

export interface DroneState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  tx: number;
  ty: number;
  tz: number;
  heading: number;
  model: DroneModel;
}

export interface Waypoint {
  x: number;
  y: number;
  z: number;
}

export interface WaypointValidationResult extends Waypoint {
  valid: boolean;
  reason?: string;
}

export const DRONE_MODELS: Record<string, DroneModel> = {
  show_drone_light: {
    name: 'Show Drone Light',
    maxSpeed: 12,
    maxVerticalSpeed: 5,
    acceleration: 8,
    verticalAcceleration: 4,
    mass: 1.2,
    windSensitivity: 0.6,
  },
  show_drone_heavy: {
    name: 'Show Drone Heavy',
    maxSpeed: 9,
    maxVerticalSpeed: 4,
    acceleration: 5,
    verticalAcceleration: 3,
    mass: 3.5,
    windSensitivity: 0.4,
  },
  racing_drone: {
    name: 'Racing Drone',
    maxSpeed: 28,
    maxVerticalSpeed: 10,
    acceleration: 18,
    verticalAcceleration: 8,
    mass: 0.9,
    windSensitivity: 0.8,
  },
  cargo_drone: {
    name: 'Cargo Drone',
    maxSpeed: 6,
    maxVerticalSpeed: 2.5,
    acceleration: 3,
    verticalAcceleration: 1.5,
    mass: 8,
    windSensitivity: 0.3,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampMagnitude(x: number, z: number, max: number): [number, number] {
  const speed = Math.hypot(x, z);
  if (speed <= max || speed === 0) return [x, z];
  const scale = max / speed;
  return [x * scale, z * scale];
}

export function createDroneState(
  x: number,
  y: number,
  z: number,
  modelKey = 'show_drone_light',
): DroneState {
  const model = DRONE_MODELS[modelKey] ?? DRONE_MODELS.show_drone_light;
  return {
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    tx: x,
    ty: y,
    tz: z,
    heading: 0,
    model,
  };
}

export function stepDronePhysics(
  drone: DroneState,
  dt: number,
  wind: [number, number, number] = [0, 0, 0],
): boolean {
  const dx = drone.tx - drone.x;
  const dy = drone.ty - drone.y;
  const dz = drone.tz - drone.z;
  const distance = Math.hypot(dx, dy, dz);
  const arrived = distance <= 0.5;

  if (arrived) {
    drone.vx *= 0.5;
    drone.vy *= 0.5;
    drone.vz *= 0.5;
  } else {
    const horizontalDistance = Math.hypot(dx, dz);
    if (horizontalDistance > 0) {
      drone.vx += (dx / horizontalDistance) * drone.model.acceleration * dt;
      drone.vz += (dz / horizontalDistance) * drone.model.acceleration * dt;
    }

    if (dy !== 0) {
      drone.vy += Math.sign(dy) * drone.model.verticalAcceleration * dt;
    }
  }

  drone.vx += (wind[0] * drone.model.windSensitivity / drone.model.mass) * dt;
  drone.vy += (wind[1] * drone.model.windSensitivity / drone.model.mass) * dt;
  drone.vz += (wind[2] * drone.model.windSensitivity / drone.model.mass) * dt;

  [drone.vx, drone.vz] = clampMagnitude(drone.vx, drone.vz, drone.model.maxSpeed);
  drone.vy = clamp(drone.vy, -drone.model.maxVerticalSpeed, drone.model.maxVerticalSpeed);

  drone.x += drone.vx * dt;
  drone.y = Math.max(0.1, drone.y + drone.vy * dt);
  drone.z += drone.vz * dt;

  const horizontalSpeed = Math.hypot(drone.vx, drone.vz);
  if (horizontalSpeed > 0.1) {
    drone.heading = Math.atan2(drone.vx, drone.vz);
  }

  return arrived;
}

export function validateWaypointTransition(
  from: Waypoint,
  to: Waypoint,
  timeDelta: number,
  model: DroneModel,
): WaypointValidationResult {
  if (timeDelta <= 0) {
    return { ...from, valid: false, reason: 'Invalid time delta' };
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const horizontalDistance = Math.hypot(dx, dz);
  const horizontalSpeed = horizontalDistance / timeDelta;
  const verticalSpeed = Math.abs(dy) / timeDelta;

  let x = to.x;
  let y = to.y;
  let z = to.z;
  let valid = true;
  let reason: string | undefined;

  if (horizontalSpeed > model.maxSpeed) {
    const maxDistance = model.maxSpeed * timeDelta;
    const scale = horizontalDistance === 0 ? 0 : maxDistance / horizontalDistance;
    x = from.x + dx * scale;
    z = from.z + dz * scale;
    valid = false;
    reason = 'Speed exceeds model maxSpeed';
  }

  if (verticalSpeed > model.maxVerticalSpeed) {
    y = from.y + Math.sign(dy) * model.maxVerticalSpeed * timeDelta;
    valid = false;
    reason = reason ?? 'Vertical speed exceeds model maxVerticalSpeed';
  }

  return { valid, reason, x, y, z };
}
