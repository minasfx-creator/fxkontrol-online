/**
 * PID Controller — Multi-axis flight control for realistic drone simulation.
 * Based on the research paper's specification of 5 independent PID controllers:
 * X (forward/backward), Y (lateral), Z (altitude), Pitch, Yaw.
 *
 * Each controller uses the classic PID formula:
 *   output = Kp * error + Ki * integral(error) + Kd * derivative(error)
 */

export interface PIDGains {
  kp: number;  // Proportional gain
  ki: number;  // Integral gain
  kd: number;  // Derivative gain
}

export interface PIDState {
  integral: number;
  prevError: number;
}

export interface DronePIDConfig {
  position: PIDGains;    // XYZ position tracking
  altitude: PIDGains;    // Z-axis altitude hold
  yaw: PIDGains;         // Heading control
  maxThrust: number;     // Max thrust N (default: 15)
  mass: number;          // Drone mass kg (default: 1.2)
  dragCoeff: number;     // Aerodynamic drag (default: 0.3)
  maxTiltAngle: number;  // Max tilt degrees (default: 35)
  maxYawRate: number;    // Max yaw rate deg/s (default: 90)
}

export interface DronePhysicsState {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  roll: number;   // degrees
  pitch: number;  // degrees
  yaw: number;    // degrees
  pidX: PIDState;
  pidY: PIDState;
  pidZ: PIDState;
  pidYaw: PIDState;
}

export const DEFAULT_PID_CONFIG: DronePIDConfig = {
  position: { kp: 3.0, ki: 0.05, kd: 2.5 },
  altitude: { kp: 5.0, ki: 0.1, kd: 3.0 },
  yaw:      { kp: 2.0, ki: 0.01, kd: 1.0 },
  maxThrust: 15,
  mass: 1.2,
  dragCoeff: 0.3,
  maxTiltAngle: 35,
  maxYawRate: 90,
};

export const PID_PRESETS: Record<string, DronePIDConfig> = {
  'DJI Matrice 600': {
    ...DEFAULT_PID_CONFIG,
    mass: 9.1,
    maxThrust: 130,
    position: { kp: 2.0, ki: 0.03, kd: 3.0 },
    altitude: { kp: 4.0, ki: 0.08, kd: 3.5 },
    maxTiltAngle: 25,
  },
  'Show Drone (250g)': {
    ...DEFAULT_PID_CONFIG,
    mass: 0.25,
    maxThrust: 5,
    position: { kp: 5.0, ki: 0.1, kd: 2.0 },
    altitude: { kp: 8.0, ki: 0.15, kd: 2.5 },
    maxTiltAngle: 40,
    maxYawRate: 120,
  },
  'Custom': { ...DEFAULT_PID_CONFIG },
};

function createPIDState(): PIDState {
  return { integral: 0, prevError: 0 };
}

export function createDronePhysics(x: number, y: number, z: number, yaw = 0): DronePhysicsState {
  return {
    x, y, z,
    vx: 0, vy: 0, vz: 0,
    roll: 0, pitch: 0, yaw,
    pidX: createPIDState(),
    pidY: createPIDState(),
    pidZ: createPIDState(),
    pidYaw: createPIDState(),
  };
}

function stepPID(gains: PIDGains, state: PIDState, error: number, dt: number, maxOutput: number): { output: number; state: PIDState } {
  const integral = state.integral + error * dt;
  // Anti-windup: clamp integral
  const clampedIntegral = Math.max(-maxOutput / (gains.ki || 1), Math.min(maxOutput / (gains.ki || 1), integral));
  const derivative = dt > 0 ? (error - state.prevError) / dt : 0;

  let output = gains.kp * error + gains.ki * clampedIntegral + gains.kd * derivative;
  output = Math.max(-maxOutput, Math.min(maxOutput, output));

  return {
    output,
    state: { integral: clampedIntegral, prevError: error },
  };
}

const GRAVITY = 9.81;
const DEG2RAD = Math.PI / 180;

/**
 * Step the drone physics forward by dt seconds toward a target waypoint.
 * Returns the updated physics state with realistic tilt, drag, and PID corrections.
 */
export function stepDronePhysics(
  drone: DronePhysicsState,
  target: { x: number; y: number; z: number; yaw?: number },
  config: DronePIDConfig,
  dt: number,
  wind?: { x: number; y: number; z: number },
): DronePhysicsState {
  if (dt <= 0) return drone;
  dt = Math.min(dt, 0.05); // clamp

  // Position errors
  const errX = target.x - drone.x;
  const errY = target.y - drone.y;
  const errZ = target.z - drone.z;
  const errYaw = ((target.yaw ?? drone.yaw) - drone.yaw + 540) % 360 - 180; // shortest path

  // PID computations
  const maxForce = config.maxThrust / config.mass;

  const pidXResult = stepPID(config.position, drone.pidX, errX, dt, maxForce);
  const pidYResult = stepPID(config.altitude, drone.pidY, errY, dt, maxForce);
  const pidZResult = stepPID(config.position, drone.pidZ, errZ, dt, maxForce);
  const pidYawResult = stepPID(config.yaw, drone.pidYaw, errYaw, dt, config.maxYawRate);

  // Desired accelerations
  let ax = pidXResult.output;
  let ay = pidYResult.output - GRAVITY; // gravity compensation
  let az = pidZResult.output;

  // Add thrust to overcome gravity
  ay += GRAVITY; // hover compensation
  ay = pidYResult.output;

  // Aerodynamic drag
  const speed = Math.sqrt(drone.vx ** 2 + drone.vy ** 2 + drone.vz ** 2);
  if (speed > 0.01) {
    const dragForce = config.dragCoeff * speed * speed;
    ax -= (drone.vx / speed) * dragForce / config.mass;
    ay -= (drone.vy / speed) * dragForce / config.mass;
    az -= (drone.vz / speed) * dragForce / config.mass;
  }

  // Wind forces
  if (wind) {
    ax += wind.x / config.mass;
    ay += wind.y / config.mass;
    az += wind.z / config.mass;
  }

  // Gravity
  ay -= GRAVITY;

  // Hover thrust (compensate gravity at rest)
  ay += GRAVITY;

  // Integrate velocity
  let nvx = drone.vx + ax * dt;
  let nvy = drone.vy + ay * dt;
  let nvz = drone.vz + az * dt;

  // Clamp velocity to realistic maximum
  const maxSpeed = Math.sqrt(maxForce) * 2;
  const currentSpeed = Math.sqrt(nvx ** 2 + nvy ** 2 + nvz ** 2);
  if (currentSpeed > maxSpeed) {
    const scale = maxSpeed / currentSpeed;
    nvx *= scale;
    nvy *= scale;
    nvz *= scale;
  }

  // Integrate position
  const nx = drone.x + nvx * dt;
  const ny = Math.max(0, drone.y + nvy * dt);
  const nz = drone.z + nvz * dt;

  // Compute visual tilt from horizontal acceleration
  const horizontalAccel = Math.sqrt(ax ** 2 + az ** 2);
  const tiltMagnitude = Math.min(Math.atan2(horizontalAccel, GRAVITY) / DEG2RAD, config.maxTiltAngle);
  const tiltAngle = horizontalAccel > 0.01 ? Math.atan2(az, ax) : 0;

  const pitch = -tiltMagnitude * Math.cos(tiltAngle); // forward tilt
  const roll = tiltMagnitude * Math.sin(tiltAngle);   // lateral tilt
  const yaw = drone.yaw + pidYawResult.output * dt;

  return {
    x: nx, y: ny, z: nz,
    vx: nvx, vy: nvy, vz: nvz,
    roll: roll * 0.3 + drone.roll * 0.7,   // smooth
    pitch: pitch * 0.3 + drone.pitch * 0.7,
    yaw,
    pidX: pidXResult.state,
    pidY: pidYResult.state,
    pidZ: pidZResult.state,
    pidYaw: pidYawResult.state,
  };
}

/**
 * Compute total power consumption in Watts based on thrust and velocity.
 */
export function computePowerDraw(velocity: number, mass: number, thrustFactor = 1.0): number {
  const hoverPower = mass * GRAVITY * 4.5; // ~watts to hover (empirical for multirotor)
  const motionPower = 0.5 * mass * velocity * velocity * 2; // kinetic overhead
  return (hoverPower + motionPower) * thrustFactor;
}
