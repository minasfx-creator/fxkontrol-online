/**
 * MAVLink Virtual Protocol Engine
 * Implements core MAVLink 2.0 message types for drone telemetry simulation.
 *
 * Based on the research paper's specification of MAVLink integration:
 * - HEARTBEAT (1 Hz): System ID, Component ID, Autopilot type, Base mode
 * - ATTITUDE (10-50 Hz): Roll, Pitch, Yaw, angular rates
 * - GPS_RAW_INT (1-5 Hz): Lat, Lon, Alt, Velocity, Course over ground
 * - VFR_HUD (1-5 Hz): Airspeed, Groundspeed, Heading, Throttle
 * - SYS_STATUS (1 Hz): Battery voltage, Remaining battery, Sensors
 *
 * This is a virtual implementation for simulation — no actual UDP/serial needed.
 * Messages are Base64-encoded for WebSocket/SSE transport as described in the paper.
 */

// ─── MAVLink Message IDs ────────────────────────────────────────────

export const MAVLINK_MSG = {
  HEARTBEAT: 0,
  SYS_STATUS: 1,
  GPS_RAW_INT: 24,
  ATTITUDE: 30,
  GLOBAL_POSITION_INT: 33,
  VFR_HUD: 74,
  COMMAND_LONG: 76,
  COMMAND_ACK: 77,
  LOCAL_POSITION_NED: 32,
  SET_POSITION_TARGET_LOCAL_NED: 84,
} as const;

// ─── MAVLink Enums ──────────────────────────────────────────────────

export enum MAVAutopilot {
  GENERIC = 0,
  PX4 = 12,
  ARDUPILOT = 3,
}

export enum MAVType {
  QUADROTOR = 2,
  HEXAROTOR = 13,
  OCTOROTOR = 14,
}

export enum MAVState {
  UNINIT = 0,
  BOOT = 1,
  CALIBRATING = 2,
  STANDBY = 3,
  ACTIVE = 4,
  CRITICAL = 5,
  EMERGENCY = 6,
  POWEROFF = 7,
}

export enum MAVMode {
  PREFLIGHT = 0,
  STABILIZE = 80,
  GUIDED = 88,
  AUTO = 92,
  LAND = 93,
  RTL = 100,
}

// ─── Message Interfaces ─────────────────────────────────────────────

export interface MAVLinkHeartbeat {
  msgId: typeof MAVLINK_MSG.HEARTBEAT;
  systemId: number;
  componentId: number;
  type: MAVType;
  autopilot: MAVAutopilot;
  baseMode: MAVMode;
  systemStatus: MAVState;
  mavlinkVersion: number;
}

export interface MAVLinkAttitude {
  msgId: typeof MAVLINK_MSG.ATTITUDE;
  systemId: number;
  timeBootMs: number;
  roll: number;     // radians
  pitch: number;    // radians
  yaw: number;      // radians
  rollSpeed: number;  // rad/s
  pitchSpeed: number; // rad/s
  yawSpeed: number;   // rad/s
}

export interface MAVLinkGPSRawInt {
  msgId: typeof MAVLINK_MSG.GPS_RAW_INT;
  systemId: number;
  timeUsec: number;
  fixType: number;   // 0=no fix, 3=3D fix
  lat: number;       // degE7
  lon: number;       // degE7
  alt: number;       // mm above MSL
  vel: number;       // cm/s
  cog: number;       // cdeg (course over ground)
  satellitesVisible: number;
  hdop: number;      // cm
}

export interface MAVLinkVFRHud {
  msgId: typeof MAVLINK_MSG.VFR_HUD;
  systemId: number;
  airspeed: number;    // m/s
  groundspeed: number; // m/s
  heading: number;     // degrees 0-360
  throttle: number;    // 0-100%
  alt: number;         // meters MSL
  climb: number;       // m/s
}

export interface MAVLinkSysStatus {
  msgId: typeof MAVLINK_MSG.SYS_STATUS;
  systemId: number;
  voltageBattery: number; // mV
  currentBattery: number; // cA (10mA)
  batteryRemaining: number; // 0-100%
  dropRateComm: number;    // 0-10000 (percentage * 100)
  errorsComm: number;
  sensorsPresent: number;
  sensorsEnabled: number;
  sensorsHealth: number;
}

export interface MAVLinkLocalPositionNED {
  msgId: typeof MAVLINK_MSG.LOCAL_POSITION_NED;
  systemId: number;
  timeBootMs: number;
  x: number; y: number; z: number;  // meters NED
  vx: number; vy: number; vz: number; // m/s
}

export interface MAVLinkSetPositionTarget {
  msgId: typeof MAVLINK_MSG.SET_POSITION_TARGET_LOCAL_NED;
  systemId: number;
  targetSystem: number;
  targetComponent: number;
  coordinateFrame: number;
  typeMask: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  yaw: number;
  yawRate: number;
}

export type MAVLinkMessage =
  | MAVLinkHeartbeat
  | MAVLinkAttitude
  | MAVLinkGPSRawInt
  | MAVLinkVFRHud
  | MAVLinkSysStatus
  | MAVLinkLocalPositionNED
  | MAVLinkSetPositionTarget;

// ─── Telemetry State (per drone) ────────────────────────────────────

export interface DroneTelemetry {
  systemId: number;
  armed: boolean;
  mode: MAVMode;
  state: MAVState;
  // Position
  x: number; y: number; z: number;
  lat: number; lon: number; altMSL: number;
  // Velocity
  vx: number; vy: number; vz: number;
  groundSpeed: number;
  // Attitude
  roll: number; pitch: number; yaw: number;
  rollRate: number; pitchRate: number; yawRate: number;
  // Battery
  voltageV: number;
  currentA: number;
  batteryPercent: number;
  // GPS
  gpsFix: number;
  satellites: number;
  hdop: number;
  // Comms
  rssi: number;
  packetsLost: number;
  lastHeartbeat: number;
  // Meta
  uptime: number; // seconds
  throttle: number;
}

export function createDefaultTelemetry(systemId: number): DroneTelemetry {
  return {
    systemId,
    armed: false,
    mode: MAVMode.PREFLIGHT,
    state: MAVState.STANDBY,
    x: 0, y: 0, z: 0,
    lat: -199200000, // ~BH, MG (approx -19.92°)
    lon: -439380000, // ~BH, MG (approx -43.938°)
    altMSL: 850000,  // 850m MSL (BH altitude)
    vx: 0, vy: 0, vz: 0,
    groundSpeed: 0,
    roll: 0, pitch: 0, yaw: 0,
    rollRate: 0, pitchRate: 0, yawRate: 0,
    voltageV: 16.8,
    currentA: 0,
    batteryPercent: 100,
    gpsFix: 3,
    satellites: 14,
    hdop: 120,
    rssi: 95,
    packetsLost: 0,
    lastHeartbeat: Date.now(),
    uptime: 0,
    throttle: 0,
  };
}

// ─── Message Generators ─────────────────────────────────────────────

export function generateHeartbeat(tel: DroneTelemetry): MAVLinkHeartbeat {
  return {
    msgId: MAVLINK_MSG.HEARTBEAT,
    systemId: tel.systemId,
    componentId: 1,
    type: MAVType.QUADROTOR,
    autopilot: MAVAutopilot.PX4,
    baseMode: tel.mode,
    systemStatus: tel.state,
    mavlinkVersion: 2,
  };
}

export function generateAttitude(tel: DroneTelemetry): MAVLinkAttitude {
  return {
    msgId: MAVLINK_MSG.ATTITUDE,
    systemId: tel.systemId,
    timeBootMs: Math.round(tel.uptime * 1000),
    roll: tel.roll * Math.PI / 180,
    pitch: tel.pitch * Math.PI / 180,
    yaw: tel.yaw * Math.PI / 180,
    rollSpeed: tel.rollRate * Math.PI / 180,
    pitchSpeed: tel.pitchRate * Math.PI / 180,
    yawSpeed: tel.yawRate * Math.PI / 180,
  };
}

export function generateGPSRaw(tel: DroneTelemetry): MAVLinkGPSRawInt {
  return {
    msgId: MAVLINK_MSG.GPS_RAW_INT,
    systemId: tel.systemId,
    timeUsec: Math.round(tel.uptime * 1e6),
    fixType: tel.gpsFix,
    lat: tel.lat,
    lon: tel.lon,
    alt: tel.altMSL,
    vel: Math.round(tel.groundSpeed * 100),
    cog: Math.round(tel.yaw * 100),
    satellitesVisible: tel.satellites,
    hdop: tel.hdop,
  };
}

export function generateVFRHud(tel: DroneTelemetry): MAVLinkVFRHud {
  return {
    msgId: MAVLINK_MSG.VFR_HUD,
    systemId: tel.systemId,
    airspeed: tel.groundSpeed,
    groundspeed: tel.groundSpeed,
    heading: ((tel.yaw % 360) + 360) % 360,
    throttle: tel.throttle,
    alt: tel.altMSL / 1000,
    climb: tel.vz,
  };
}

export function generateSysStatus(tel: DroneTelemetry): MAVLinkSysStatus {
  return {
    msgId: MAVLINK_MSG.SYS_STATUS,
    systemId: tel.systemId,
    voltageBattery: Math.round(tel.voltageV * 1000),
    currentBattery: Math.round(tel.currentA * 100),
    batteryRemaining: Math.round(tel.batteryPercent),
    dropRateComm: Math.round((tel.packetsLost / Math.max(1, tel.uptime)) * 100),
    errorsComm: tel.packetsLost,
    sensorsPresent: 0b111111111,
    sensorsEnabled: 0b111111111,
    sensorsHealth: 0b111111111,
  };
}

export function generateLocalPosition(tel: DroneTelemetry): MAVLinkLocalPositionNED {
  return {
    msgId: MAVLINK_MSG.LOCAL_POSITION_NED,
    systemId: tel.systemId,
    timeBootMs: Math.round(tel.uptime * 1000),
    x: tel.x, y: -tel.z, z: -tel.y, // Convert Y-up to NED (North-East-Down)
    vx: tel.vx, vy: -tel.vz, vz: -tel.vy,
  };
}

// ─── Message Serialization (Base64 for transport) ───────────────────

export function encodeMessage(msg: MAVLinkMessage): string {
  const json = JSON.stringify(msg);
  return btoa(json);
}

export function decodeMessage(encoded: string): MAVLinkMessage {
  const json = atob(encoded);
  return JSON.parse(json);
}

// ─── Telemetry Updater ──────────────────────────────────────────────

/**
 * Update telemetry state from simulation physics.
 * Maps sim coordinates (Y-up) to MAVLink conventions.
 */
export function updateTelemetryFromSim(
  tel: DroneTelemetry,
  simState: {
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    roll?: number; pitch?: number; yaw?: number;
  },
  dt: number,
  batteryPercent?: number,
  batteryVoltage?: number,
): DroneTelemetry {
  const groundSpeed = Math.sqrt(simState.vx ** 2 + simState.vz ** 2);

  return {
    ...tel,
    x: simState.x,
    y: simState.y,
    z: simState.z,
    vx: simState.vx,
    vy: simState.vy,
    vz: simState.vz,
    groundSpeed,
    roll: simState.roll ?? tel.roll,
    pitch: simState.pitch ?? tel.pitch,
    yaw: simState.yaw ?? tel.yaw,
    throttle: Math.min(100, Math.max(0, (simState.vy + 5) * 10)),
    voltageV: batteryVoltage ?? tel.voltageV,
    batteryPercent: batteryPercent ?? tel.batteryPercent,
    uptime: tel.uptime + dt,
    lastHeartbeat: Date.now(),
    state: MAVState.ACTIVE,
    armed: true,
    mode: MAVMode.GUIDED,
  };
}

// ─── Full Telemetry Packet (all messages for one drone) ─────────────

export interface TelemetryPacket {
  systemId: number;
  timestamp: number;
  heartbeat: MAVLinkHeartbeat;
  attitude: MAVLinkAttitude;
  gps: MAVLinkGPSRawInt;
  vfrHud: MAVLinkVFRHud;
  sysStatus: MAVLinkSysStatus;
  localPosition: MAVLinkLocalPositionNED;
}

export function generateFullPacket(tel: DroneTelemetry): TelemetryPacket {
  return {
    systemId: tel.systemId,
    timestamp: Date.now(),
    heartbeat: generateHeartbeat(tel),
    attitude: generateAttitude(tel),
    gps: generateGPSRaw(tel),
    vfrHud: generateVFRHud(tel),
    sysStatus: generateSysStatus(tel),
    localPosition: generateLocalPosition(tel),
  };
}

/**
 * Encode a full telemetry packet as a compact Base64 string for transport.
 */
export function encodePacket(packet: TelemetryPacket): string {
  return btoa(JSON.stringify(packet));
}

export function decodePacket(encoded: string): TelemetryPacket {
  return JSON.parse(atob(encoded));
}

// ─── Message Rate Configuration ─────────────────────────────────────

export interface MAVLinkRateConfig {
  heartbeatHz: number;    // Default: 1
  attitudeHz: number;     // Default: 20
  gpsHz: number;          // Default: 5
  vfrHudHz: number;       // Default: 5
  sysStatusHz: number;    // Default: 1
  localPosHz: number;     // Default: 10
}

export const DEFAULT_RATE_CONFIG: MAVLinkRateConfig = {
  heartbeatHz: 1,
  attitudeHz: 20,
  gpsHz: 5,
  vfrHudHz: 5,
  sysStatusHz: 1,
  localPosHz: 10,
};

/**
 * Format a MAVLink message for human-readable display.
 */
export function formatMessageLog(msg: MAVLinkMessage): string {
  const names: Record<number, string> = {
    [MAVLINK_MSG.HEARTBEAT]: 'HEARTBEAT',
    [MAVLINK_MSG.SYS_STATUS]: 'SYS_STATUS',
    [MAVLINK_MSG.GPS_RAW_INT]: 'GPS_RAW_INT',
    [MAVLINK_MSG.ATTITUDE]: 'ATTITUDE',
    [MAVLINK_MSG.VFR_HUD]: 'VFR_HUD',
    [MAVLINK_MSG.LOCAL_POSITION_NED]: 'LOCAL_POS_NED',
    [MAVLINK_MSG.SET_POSITION_TARGET_LOCAL_NED]: 'SET_POS_TARGET',
    [MAVLINK_MSG.COMMAND_LONG]: 'CMD_LONG',
    [MAVLINK_MSG.COMMAND_ACK]: 'CMD_ACK',
  };
  return `[SYS ${msg.systemId}] ${names[msg.msgId] ?? `MSG_${msg.msgId}`}`;
}
