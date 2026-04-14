/**
 * ─── FXK Domain Types — Operational Contracts ───────────────────────
 * Types that reflect real hardware and protocol structures.
 */

import type { SafetyState } from '@/core/safety/SafetyStateMachine';

// ── Ignition Channel (maps to physical relay on 32-channel board) ──
export interface IgnitionChannel {
  module: number;          // hardware module index
  channel: number;         // 0-31 within module
  pin: number;             // absolute pin (module * 32 + channel)
  armed: boolean;
  fired: boolean;
  firedAt: number | null;  // timestamp
  continuity: ContinuitySample | null;
  relay_state: 'open' | 'closed' | 'unknown';  // physical relay position
}

// ── Continuity Sample (from CD4051 mux reading) ──
export interface ContinuitySample {
  pin: number;
  ohms: number;
  status: 'OK' | 'OPEN' | 'SHORT' | 'UNKNOWN';
  timestamp: number;
  source_mux: 0 | 1;      // CD4051 mux index (0 or 1)
}

// ── Power State (12V battery monitoring) ──
export interface PowerState {
  voltage: number;         // volts (nominal 12V, field bus)
  current: number;         // amps
  soc: number;             // state-of-charge 0-100%
  charging: boolean;
  lowVoltageAlert: boolean;
  logic_voltage: number;   // 5V logic rail
  field_voltage: number;   // 12V field/relay rail
  timestamp: number;
}

// ── Safety Interlock State (aggregated gate) ──
export interface SafetyInterlockState {
  state: SafetyState;
  continuityPassed: boolean;
  linkStable: boolean;
  validationPassed: boolean;
  geofenceOk: boolean;
  keyInserted: boolean;
  deadmanHeld: boolean;
  canArm: boolean;
  canFire: boolean;
  blockedReasons: string[];
  estop: boolean;          // emergency stop active
  arm_key: boolean;        // physical arm key inserted
  manual_mode: boolean;    // manual override active
  software_enable: boolean; // software enable flag
}

// ── Art-Net Universe Map ──
export interface ArtNetUniverseEntry {
  universe: number;        // 0-32767
  subnet: number;
  net: number;
  channelCount: number;    // 512 per universe
  activeChannels: number;  // channels with non-zero values
  source: string;          // IP or 'local'
  lastUpdate: number;
  start_address: number;   // first channel address in universe
  fixture_type: string;    // fixture profile name
}

export interface ArtNetUniverseMap {
  universes: ArtNetUniverseEntry[];
  totalActive: number;
  pollReplyCount: number;
  lastPollAt: number;
}

// ── FireOne Cue (native .fir format cue) ──
export interface FireOneCue {
  cueNumber: number;
  module: number;
  pin: number;
  time: number;            // seconds from show start
  prefire: number;         // ms fuse delay
  description: string;
  effectCode: string;
  caliber: number;         // mm
  elevation: number;       // degrees
  position: string;        // position label
  rack?: number;
  tube?: number;
}
