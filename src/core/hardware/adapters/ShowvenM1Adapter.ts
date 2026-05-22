/**
 * ─── Showven M1 Adapter ────────────────────────────────────────────
 *
 * Logical representation of the **Showven M1 / FXcommander Pro** master
 * controller (128 cues × 4 scenes, dual-band 433M/868M, V1.5 firmware).
 *
 * Mirrors `FireOneXL4Adapter` and `FXK32QModuleAdapter` exactly:
 *   • Same `RelayBankState` shape (128 channels here).
 *   • Same lifecycle (`markHandshakeOk` / `markHandshakeLost` / `reset`).
 *   • Same canWrite=false at the registry boundary — operational
 *     FIRE/ARM continues flowing through `uiCommandGateway → CommandBus
 *     → SafetyStateMachine`.
 *
 * Promotion to `live_read_only` happens via `discoveryRegistryBridge`
 * after `useShowvenM1Bridge.notifyHandshakeOk(...)` is called by the
 * pairing wizard with a verified PBus STATUS reply + firmware ≥ V1.5.
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

const M1_CHANNELS = 128;

export interface ShowvenM1HandshakeArgs {
  transport?: TransportType;
  firmware?: string;
  masterAddress?: number;
  slavesOnline?: number;
  baudRate?: number;
}

export class ShowvenM1Adapter implements HardwareAdapter<RelayBankState> {
  readonly deviceId = 'showven-m1';
  readonly deviceType = 'relay-bank' as const;
  readonly label = 'Showven M1 / FXcommander Pro — 128 cues';
  readonly protocolFamily = 'showven-pbus-dualband' as const;
  readonly firmwareModel = 'M1' as const;
  readonly compatibleWith = 'showven_fxcommander_pro' as const;

  private _provenance: ProvenanceInfo = createSimulatedProvenance('serial_usb');
  private _connected: DeviceConnectionState = 'disconnected';
  private _state: RelayBankState;

  private _firmware: string | null = null;
  private _masterAddress: number | null = null;
  private _baudRate: number | null = null;
  private _slavesOnline: number = 0;

  constructor() { this._state = this._createDefaultState(); }

  private _createDefaultState(): RelayBankState {
    return {
      bank_id: 'showven-m1',
      channel_count: M1_CHANNELS,
      healthy_channels: 0,
      fault_channels: [],
      channel_states: Array.from({ length: M1_CHANNELS }, (_, i) => ({
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
      canWrite: false,
      canDiagnose: true,
      canSimulate: true, // gated at runtime via isHardwareSimulatorEnabled()
      canExport: false,
      supportsTelemetry: true,
      supportsContinuity: true,
      maxChannels: M1_CHANNELS,
      protocols: [
        'pbus-19200',
        'pbus-dualband-433',
        'pbus-dualband-868',
        'usb-ftdi',
      ],
    };
  }

  getSnapshot(): HardwareStatusSnapshot {
    const warnings: string[] = [];
    const errors: string[] = [];
    const opens  = this._state.channel_states.filter((c) => c.continuity === 'open').length;
    const shorts = this._state.channel_states.filter((c) => c.continuity === 'short').length;
    if (opens  > 0) warnings.push(`${opens} open channel(s)`);
    if (shorts > 0) errors.push(`${shorts} SHORT channel(s)`);
    if (this._state.fault_channels.length > 0) {
      errors.push(`${this._state.fault_channels.length} fault(s)`);
    }
    if (this._connected !== 'connected') warnings.push('M1 master not connected');
    return {
      device_id: this.deviceId,
      timestamp: Date.now(),
      online: this._connected === 'connected',
      warnings,
      errors,
      metrics: {
        model: this.firmwareModel,
        protocol_family: this.protocolFamily,
        compatible_with: this.compatibleWith,
        firmware: this._firmware ?? 'unknown',
        master_address: this._masterAddress ?? -1,
        slaves_online: this._slavesOnline,
        baud: this._baudRate ?? 0,
        total: M1_CHANNELS,
        healthy: this._state.healthy_channels,
        faults: this._state.fault_channels.length,
        ok: this._state.channel_states.filter((c) => c.continuity === 'ok').length,
        open: opens,
        short: shorts,
      },
    };
  }

  getState(): RelayBankState {
    return {
      ...this._state,
      fault_channels: [...this._state.fault_channels],
      channel_states: this._state.channel_states.map((c) => ({ ...c })),
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
    if (this._connected !== 'connected') issues.push('M1 master not connected');
    if (this._firmware == null) issues.push('Firmware version unknown');
    const shorts = this._state.channel_states.filter((c) => c.continuity === 'short');
    if (shorts.length > 0) issues.push(`${shorts.length} SHORT circuit(s)`);
    return { healthy: issues.length === 0, issues };
  }

  reset(): void {
    this._connected = 'disconnected';
    this._firmware = null;
    this._masterAddress = null;
    this._baudRate = null;
    this._slavesOnline = 0;
    this._state = this._createDefaultState();
    markHandshakeLost(this._provenance);
  }

  markHandshakeOk(args: ShowvenM1HandshakeArgs = {}): void {
    this._connected = 'connected';
    if (args.firmware !== undefined) this._firmware = args.firmware;
    if (args.masterAddress !== undefined) this._masterAddress = args.masterAddress;
    if (args.baudRate !== undefined) this._baudRate = args.baudRate;
    if (args.slavesOnline !== undefined) this._slavesOnline = Math.max(0, args.slavesOnline);
    markHandshakeOk(this._provenance, args.transport ?? 'serial_usb');
  }

  markHandshakeLost(): void {
    this._connected = 'disconnected';
    markHandshakeLost(this._provenance);
  }

  /** Diagnostic-only getters used by the presence hook + UI. */
  getFirmware(): string | null { return this._firmware; }
  getMasterAddress(): number | null { return this._masterAddress; }
  getBaudRate(): number | null { return this._baudRate; }
  getSlavesOnline(): number { return this._slavesOnline; }

  private _updateCounts(): void {
    this._state.healthy_channels = this._state.channel_states
      .filter((c) => c.continuity === 'ok').length;
    this._state.fault_channels = this._state.channel_states
      .filter((c) => c.continuity === 'short' || c.continuity === 'open')
      .map((c) => c.channel);
  }
}

export const showvenM1Adapter = new ShowvenM1Adapter();
