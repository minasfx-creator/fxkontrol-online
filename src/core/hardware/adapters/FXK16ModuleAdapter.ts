/**
 * ─── FXK16 Module Adapter ─────────────────────────────────────────
 * 16-channel relay module driven by an ESP32-S3 v1.3.
 * Channel mapping: C1 → relay 1 … C16 → relay 16 (1:1).
 * Speaks the same ASCII protocol as FireOneHardwareBridge:
 *   FIRE:<pin>:<ms> | BATCH:<mask>:<ms> | STATUS | VERSION | ESTOP
 * Identification line: "MODEL:FXK16;CH:16".
 *
 * STRICTLY READ-ONLY at the registry layer — operational firing
 * still flows through CommandBus → SafetyStateMachine → FieldBus.
 */

import type {
  HardwareAdapter,
  HardwareCapabilities,
  HardwareStatusSnapshot,
  DeviceConnectionState,
  RelayBankState,
} from '../types';
import {
  createSimulatedProvenance,
  markHandshakeOk,
  markHandshakeLost,
  type ProvenanceInfo,
  type TransportType,
} from '../provenance';
import { isHardwareSimulatorEnabled } from '@/lib/featureFlags';

export class FXK16ModuleAdapter implements HardwareAdapter<RelayBankState> {
  readonly deviceId = 'fxk16-esp32s3';
  readonly deviceType = 'relay-bank' as const;
  readonly label = 'FXK16 — 16ch (ESP32-S3)';
  /** Protocol family — mirrors ModuleSpec.protocolFamily / HardwareModuleConfig.protocolFamily. */
  readonly protocolFamily = 'showven-c16-compatible' as const;
  /** Firmware MODEL token reported by the device on handshake. */
  readonly firmwareModel = 'FXK16' as const;
  /** Showven preset this adapter is wire-compatible with. */
  readonly compatibleWith = 'pyroslave_c16' as const;
  private _provenance: ProvenanceInfo = createSimulatedProvenance('serial_usb');

  private _connected: DeviceConnectionState = 'disconnected';
  private _state: RelayBankState;

  constructor() { this._state = this._createDefaultState(); }

  private _createDefaultState(): RelayBankState {
    return {
      bank_id: 'fxk16-esp32s3',
      channel_count: 16,
      healthy_channels: 0,
      fault_channels: [],
      channel_states: Array.from({ length: 16 }, (_, i) => ({
        channel: i,
        continuity: 'unknown' as const,
        resistance_ohms: 9999,
        last_checked: 0,
      })),
    };
  }

  getConnectionState(): DeviceConnectionState { return this._connected; }

  getCapabilities(): HardwareCapabilities {
    return {
      canRead: true,
      canWrite: false,        // safety-locked at registry boundary
      canDiagnose: true,
      canSimulate: true,
      canExport: false,
      supportsTelemetry: true,
      supportsContinuity: true,
      maxChannels: 16,
      protocols: ['serial-115200', 'usb-cdc', 'ble-uart-ffe0'],
    };
  }

  getSnapshot(): HardwareStatusSnapshot {
    const warnings: string[] = [];
    const errors: string[] = [];
    const opens  = this._state.channel_states.filter(c => c.continuity === 'open').length;
    const shorts = this._state.channel_states.filter(c => c.continuity === 'short').length;
    if (opens  > 0) warnings.push(`${opens} open channel(s)`);
    if (shorts > 0) errors.push(`${shorts} SHORT channel(s)`);
    if (this._state.fault_channels.length > 0) {
      errors.push(`${this._state.fault_channels.length} fault(s)`);
    }
    return {
      device_id: this.deviceId,
      timestamp: Date.now(),
      online: this._connected === 'connected',
      warnings, errors,
      metrics: {
        model: this.firmwareModel,
        protocol_family: this.protocolFamily,
        compatible_with: this.compatibleWith,
        total: 16,
        healthy: this._state.healthy_channels,
        faults: this._state.fault_channels.length,
        ok: this._state.channel_states.filter(c => c.continuity === 'ok').length,
        open: opens, short: shorts,
      },
    };
  }

  getState(): RelayBankState {
    return {
      ...this._state,
      fault_channels: [...this._state.fault_channels],
      channel_states: this._state.channel_states.map(c => ({ ...c })),
    };
  }
  getProvenance(): ProvenanceInfo {
    return { ...this._provenance, last_seen_at: Date.now(), data_freshness_ms: 0 };
  }

  pollTelemetry(): void {
    if (this._connected !== 'connected') return;
    if (!isHardwareSimulatorEnabled()) return;
    const now = Date.now();
    for (const ch of this._state.channel_states) {
      ch.last_checked = now;
      if (ch.continuity === 'ok') ch.resistance_ohms = 1.0 + Math.random() * 1.5;
    }
    this._updateCounts();
  }

  runDiagnostics(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    if (this._connected !== 'connected') issues.push('FXK16 module not connected');
    const shorts = this._state.channel_states.filter(c => c.continuity === 'short');
    if (shorts.length > 0) issues.push(`${shorts.length} SHORT circuit(s)`);
    const unknowns = this._state.channel_states.filter(c => c.continuity === 'unknown');
    if (unknowns.length > 0) issues.push(`${unknowns.length} unchecked channel(s)`);
    return { healthy: issues.length === 0, issues };
  }

  reset(): void {
    this._connected = 'disconnected';
    this._state = this._createDefaultState();
  }

  reset(): void {
    this._connected = 'disconnected';
    this._state = this._createDefaultState();
    markHandshakeLost(this._provenance);
  }

  /**
   * Promote this adapter to LIVE READ-ONLY after a verified handshake
   * (`MODEL:FXK16;CH:16` reply on USB-CDC or BLE FFE0/FFE1/FFE2).
   * Called by `discoveryRegistryBridge` — never by UI directly.
   */
  markHandshakeOk(transport: TransportType = 'serial_usb'): void {
    this._connected = 'connected';
    markHandshakeOk(this._provenance, transport);
  }

  /** Demote back to NOT_INTEGRATED on disconnect / heartbeat timeout. */
  markHandshakeLost(): void {
    this._connected = 'disconnected';
    markHandshakeLost(this._provenance);
  }

  private _updateCounts(): void {
    this._state.healthy_channels = this._state.channel_states.filter(c => c.continuity === 'ok').length;
    this._state.fault_channels = this._state.channel_states
      .filter(c => c.continuity === 'short' || c.continuity === 'open')
      .map(c => c.channel);
  }
}

export const fxk16ModuleAdapter = new FXK16ModuleAdapter();
