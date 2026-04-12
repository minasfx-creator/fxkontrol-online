/**
 * ─── Hardware Integration Layer — Core Types ────────────────────────
 * Canonical interfaces for all hardware adapters, telemetry,
 * and device state management. STRICTLY NON-OPERATIONAL.
 * No firing logic, no ignition commands, no field execution.
 */

// ── Device Foundation ──────────────────────────────────────────────

export type DeviceConnectionState = 'connected' | 'disconnected' | 'degraded' | 'error';

export type HardwareDeviceCategory =
  | 'controller'       // Arduino Nano
  | 'shift-register'   // 74HC595
  | 'multiplexer'      // CD4051
  | 'relay-bank'       // 32-channel relay board
  | 'battery'          // 12V battery / power supply
  | 'artnet-node'      // Art-Net interface
  | 'dmx-interface'    // USB-DMX
  | 'fireone-profile'  // FireOne export profile (logical)
  | 'timecode-reader'  // LTC/SMPTE
  | 'drone-bridge';    // Drone telemetry bridge

export interface HardwareCapabilities {
  canRead: boolean;
  canWrite: boolean;         // false for all safety-locked adapters
  canDiagnose: boolean;
  canSimulate: boolean;
  canExport: boolean;
  supportsTelemetry: boolean;
  supportsContinuity: boolean;
  maxChannels: number;
  protocols: string[];
}

export interface HardwareDevice {
  id: string;
  type: HardwareDeviceCategory;
  label: string;
  connection_state: DeviceConnectionState;
  capabilities: HardwareCapabilities;
  firmware?: string;
  serialPort?: string;
  lastSeen: number;
  metadata: Record<string, string | number | boolean>;
}

// ── Status & Telemetry ─────────────────────────────────────────────

export interface HardwareStatusSnapshot {
  device_id: string;
  timestamp: number;
  online: boolean;
  warnings: string[];
  errors: string[];
  metrics: Record<string, number | string>;
}

export interface BatteryState {
  voltage: number;
  source: 'battery' | 'external' | 'usb';
  percentage: number;
  low_battery_alarm: boolean;
  charging: boolean;
}

export interface MultiplexerState {
  mux_id: string;
  selected_channel: number;
  sample_count: number;
  fault_state: boolean;
  channels: MuxChannelReading[];
}

export interface MuxChannelReading {
  channel: number;
  raw_value: number;
  resistance_ohms: number;
  state: 'ok' | 'open' | 'short' | 'unknown';
}

export interface ShiftRegisterState {
  register_id: string;
  output_count: number;
  comm_state: 'ok' | 'fault' | 'timeout';
  outputs: boolean[];  // read-only snapshot of output states
}

export interface RelayBankState {
  bank_id: string;
  channel_count: number;
  healthy_channels: number;
  fault_channels: number[];
  channel_states: RelayChannelState[];
}

export interface RelayChannelState {
  channel: number;
  continuity: 'ok' | 'open' | 'short' | 'unknown';
  resistance_ohms: number;
  last_checked: number;
}

export interface ContinuityState {
  channel_id: number;
  state: 'ok' | 'open' | 'short' | 'unknown';
  resistance_bucket: 'low' | 'normal' | 'high' | 'infinite';
  source_device: string;
  timestamp: number;
}

export interface LinkHealthState {
  protocol: string;
  connected: boolean;
  latency_ms: number;
  packet_loss: number;
  degraded: boolean;
  last_packet: number;
}

// ── Readiness & Operations ─────────────────────────────────────────

export type ReadinessStatus =
  | 'READY_FOR_SIMULATION'
  | 'READY_FOR_EXPORT'
  | 'READY_FOR_HARDWARE_SYNC'
  | 'BLOCKED';

export type AllowedOperation =
  | 'simulate'
  | 'preview'
  | 'validate'
  | 'export'
  | 'diagnostics'
  | 'sync_read_only';

export type OperationalMode =
  | 'preview'
  | 'diagnostics'
  | 'dry-run'
  | 'read-only-sync'
  | 'export'
  | 'blocked';

export interface ReadinessResult {
  status: ReadinessStatus;
  mode: OperationalMode;
  issues: ReadinessIssue[];
  warnings: string[];
  allowed_operations: AllowedOperation[];
  blocked_operations: AllowedOperation[];
}

export interface ReadinessIssue {
  source: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

// ── Export Profiles ────────────────────────────────────────────────

export interface ExportProfile {
  id: string;
  type: 'fireone' | 'artnet' | 'dmx' | 'drone' | 'unreal';
  validation_state: 'valid' | 'invalid' | 'unchecked';
  generated_at: number | null;
  cue_count: number;
  errors: string[];
}

// ── Observability ──────────────────────────────────────────────────

export interface DeviceEvent {
  id: string;
  device_id: string;
  timestamp: number;
  type: 'connected' | 'disconnected' | 'warning' | 'error' | 'state_change' | 'telemetry';
  message: string;
  data?: Record<string, unknown>;
}

export interface HealthTimelineEntry {
  timestamp: number;
  device_id: string;
  health_score: number;   // 0-100
  warnings: number;
  errors: number;
}

// ── Adapter Interface ──────────────────────────────────────────────

import type { ProvenanceInfo } from './provenance';

export interface HardwareAdapter<TState = unknown> {
  readonly deviceId: string;
  readonly deviceType: HardwareDeviceCategory;
  readonly label: string;

  getConnectionState(): DeviceConnectionState;
  getCapabilities(): HardwareCapabilities;
  getSnapshot(): HardwareStatusSnapshot;
  getState(): TState;
  getProvenance(): ProvenanceInfo;
  
  /** Poll telemetry — read-only, no commands */
  pollTelemetry(): void;
  
  /** Run diagnostics — read-only health check */
  runDiagnostics(): { healthy: boolean; issues: string[] };
  
  /** Reset to initial simulated state */
  reset(): void;
}
