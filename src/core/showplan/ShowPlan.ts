/**
 * ─── ShowPlan — Canonical Source of Truth ────────────────────────────
 * Single data structure that represents the ENTIRE show.
 * All subsystems (import, export, simulation, execution, safety)
 * converge on this contract.
 *
 * Hardware context: Arduino Nano + 74HC595 + CD4051 + 32-relay board + 12V battery
 */

// ── Metadata ────────────────────────────────────────────────────────

export interface ShowMetadata {
  id: string;
  name: string;
  venue: string;
  gps: { lat: number; lng: number; alt: number } | null;
  duration: number;          // seconds
  version: number;
  createdAt: number;
  updatedAt: number;
  author: string;
  notes: string;
}

// ── Pyro Cues ───────────────────────────────────────────────────────

export interface PyroCue {
  id: string;
  time: number;              // seconds from show start
  positionId: string;
  module: number;            // hardware module index (0-based)
  channel: number;           // channel within module (0-31)
  effectId: string;
  fuseDelay: number;         // ms
  caliber: number;           // mm
  elevation: number;         // degrees
  heading: number;           // degrees
  position: { x: number; y: number; z: number };
  notes?: string;
  rack?: number;
  tube?: number;
  section?: string;
}

// ── DMX Cues ────────────────────────────────────────────────────────

export type DMXCurve = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'step';

export interface DMXCue {
  id: string;
  time: number;
  universe: number;
  channel: number;
  value: number;
  duration: number;          // fade duration in seconds
  curve: DMXCurve;
  fixtureId?: string;
}

// ── Drone Paths ─────────────────────────────────────────────────────

export interface DroneWaypoint {
  id: string;
  time: number;
  position: { x: number; y: number; z: number };
  speed: number;             // m/s
  controlIn?: { x: number; y: number; z: number };
  controlOut?: { x: number; y: number; z: number };
}

export interface DronePath {
  id: string;
  droneId: string;
  padPositionId: string;
  waypoints: DroneWaypoint[];
  color: string;
  formationId?: string;
}

// ── Safety Constraints ──────────────────────────────────────────────

export interface GeofenceZone {
  id: string;
  type: 'exclusion' | 'audience' | 'airspace';
  points: { x: number; z: number }[];
  minAlt: number;
  maxAlt: number;
  label: string;
}

export interface SafetyConstraints {
  geofenceZones: GeofenceZone[];
  nfpaMinDistance: number;   // meters (NFPA 1123 table)
  maxWindSpeed: number;      // m/s
  maxCaliper: number;        // mm
  requireContinuityCheck: boolean;
  requireDualKey: boolean;
}

// ── Hardware Configuration ──────────────────────────────────────────

/**
 * Protocol family used by the bridge to dispatch frames.
 * Mirrors `ModuleProtocolFamily` in useAddressingStore (kept duplicated
 * here to keep ShowPlan independent from the UI layer).
 */
export type HardwareProtocolFamily =
  | 'showven-c16-compatible'
  | 'fireone-ascii'
  | 'pbus'
  | 'generic';

export interface HardwareModuleConfig {
  id: string;
  label: string;
  /**
   * Module hardware family.
   *  - 'nano-relay-32'   : Arduino Nano + 74HC595 + 32-relay board
   *  - 'fxk16-esp32s3'   : ESP32-S3 v1.3 + 16-relay board (channelCount: 16,
   *                        wire-compatible with Showven PyroSlave C16)
   */
  type: 'nano-relay-32' | 'fxk16-esp32s3';
  channelCount: number;      // 32 (nano-relay-32) or 16 (fxk16-esp32s3)
  address: number;           // bus address
  serialPort?: string;       // e.g. COM3, /dev/ttyUSB0
  batteryVoltage?: number;   // nominal 12V
  /** Protocol family the bridge should dispatch through. */
  protocolFamily?: HardwareProtocolFamily;
  /** Firmware MODEL token reported by the device on handshake (e.g. 'FXK16'). */
  firmwareModel?: string;
  /** Showven preset id this module is wire-compatible with (e.g. 'pyroslave_c16'). */
  compatibleWith?: string;
}

export interface HardwareConfig {
  modules: HardwareModuleConfig[];
  muxChannels: number;       // CD4051 = 8 channels per mux
  shiftRegisterBits: number; // 74HC595 = 8 bits per chip, daisy-chained
  totalRelays: number;       // 32 per board
}

// ── Export Profiles ─────────────────────────────────────────────────

export type ExportFormat = 'fireone' | 'finale-csv' | 'artnet-patch' | 'json' | 'drone-csv';

export interface ExportProfile {
  id: string;
  format: ExportFormat;
  label: string;
  options: Record<string, unknown>;
}

// ── ShowPlan Root ───────────────────────────────────────────────────

export interface ShowPlan {
  metadata: ShowMetadata;
  pyroCues: PyroCue[];
  dmxCues: DMXCue[];
  dronePaths: DronePath[];
  safetyConstraints: SafetyConstraints;
  hardwareConfig: HardwareConfig;
  exportProfiles: ExportProfile[];
  positions: ShowPosition[];
}

export interface ShowPosition {
  id: string;
  name: string;
  type: 'pyro' | 'drone-pad' | 'light';
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  section?: string;
  moduleId?: string;
  channelStart?: number;
}

// ── Verification Status ─────────────────────────────────────────────

export type VerificationLevel =
  | 'READY_FOR_SIMULATION'
  | 'READY_FOR_EXPORT'
  | 'READY_FOR_FIELD'
  | 'BLOCKED';

export interface VerificationCheckResult {
  id: string;
  label: string;
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  detail: string;
}

export interface VerificationResult {
  level: VerificationLevel;
  checks: VerificationCheckResult[];
  timestamp: number;
}

// ── Factory ─────────────────────────────────────────────────────────

export function createEmptyShowPlan(): ShowPlan {
  return {
    metadata: {
      id: crypto.randomUUID(),
      name: 'Untitled Show',
      venue: '',
      gps: null,
      duration: 0,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      author: '',
      notes: '',
    },
    pyroCues: [],
    dmxCues: [],
    dronePaths: [],
    safetyConstraints: {
      geofenceZones: [],
      nfpaMinDistance: 70,
      maxWindSpeed: 15,
      maxCaliper: 300,
      requireContinuityCheck: true,
      requireDualKey: false,
    },
    hardwareConfig: {
      modules: [],
      muxChannels: 8,
      shiftRegisterBits: 8,
      totalRelays: 32,
    },
    exportProfiles: [
      { id: 'default-fireone', format: 'fireone', label: 'FireOne Script', options: {} },
      { id: 'default-finale', format: 'finale-csv', label: 'Finale 3D CSV', options: {} },
    ],
    positions: [],
  };
}
