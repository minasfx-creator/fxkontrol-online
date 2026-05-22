/**
 * ─── FireOne XL4+ Adapter ─────────────────────────────────────────
 *
 * Logical representation of a FireOne XLII+ / XL4-3 / XL4+ master
 * controller (32 igniters per module, addressed RS-485 / USB-FTDI).
 *
 * Mirrors the structure of `FXK16ModuleAdapter` and `FXK32QModuleAdapter`
 * — same `RelayBankState` shape, same lifecycle (handshake-ok / lost),
 * same registry contract — and adds three XL4-specific fields published
 * by the pairing wizard handshake: `firmware`, `moduleAddress`, `baudRate`.
 *
 * Speaks the FireOne binary protocol (STX/ETX framing, IDENTIFY/STATUS):
 *   • Cable: RS-485 @ 9600 8N1 over USB-FTDI
 *   • Radio: TNC dock @ 38400 8N1 over USB-FTDI
 *
 * STRICTLY READ-ONLY at the registry boundary — every operational
 * FIRE / ARM still flows through `uiCommandGateway → CommandBus →
 * SafetyStateMachine`. `canWrite` is `false`; `pollTelemetry` only
 * mutates state when the dev simulator flag is on (honest-hardware).
 *
 * Promotion to `live_read_only` is performed by `discoveryRegistryBridge`
 * once `useFireOneXL4Bridge.notifyHandshakeOk(...)` is called by the
 * `/pairing/xl4` wizard with a verified IDENTIFY frame + firmware ≥ 5.0.
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

const XL4_CHANNELS = 32;

export interface FireOneXL4HandshakeArgs {
  transport?: TransportType;
  firmware?: string;
  moduleAddress?: number;
  baudRate?: number;
}

export class FireOneXL4Adapter implements HardwareAdapter<RelayBankState> {
  readonly deviceId = 'fireone-xl4';
  readonly deviceType = 'relay-bank' as const;
  readonly label = 'FireOne XL4+ — 32ch master';
  /** Protocol family — STX/ETX binary frames, IDENTIFY/STATUS handshake. */
  readonly protocolFamily = 'fireone-binary' as const;
  /** Firmware MODEL token reported by the device on handshake. */
  readonly firmwareModel = 'XL4+' as const;
  /** FireOne hardware family this adapter is wire-compatible with. */
  readonly compatibleWith = 'fireone_xlii_plus' as const;

  private _provenance: ProvenanceInfo = createSimulatedProvenance('serial_usb');
  private _connected: DeviceConnectionState = 'disconnected';
  private _state: RelayBankState;

  // XL4-specific live metadata (populated on handshake-ok).
  private _firmware: string | null = null;
  private _moduleAddress: number | null = null;
  private _baudRate: number | null = null;

  constructor() { this._state = this._createDefaultState(); }

  private _createDefaultState(): RelayBankState {
    return {
      bank_id: 'fireone-xl4',
      channel_count: XL4_CHANNELS,
      healthy_channels: 0,
      fault_channels: [],
      channel_states: Array.from({ length: XL4_CHANNELS }, (_, i) => ({
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
      canWrite: false,         // safety-locked at registry boundary
      canDiagnose: true,
      canSimulate: true,       // gated at runtime via isHardwareSimulatorEnabled()
      canExport: false,
      supportsTelemetry: true,
      supportsContinuity: true,
      maxChannels: XL4_CHANNELS,
      protocols: [
        'serial-9600',
        'serial-19200',
        'serial-38400',
        'rs485-fireone-xlii+',
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
    if (this._connected !== 'connected') warnings.push('XL4+ master not connected');
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
        module_address: this._moduleAddress ?? -1,
        baud: this._baudRate ?? 0,
        total: XL4_CHANNELS,
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
    if (this._connected !== 'connected') issues.push('XL4+ master not connected');
    if (this._firmware == null) issues.push('Firmware version unknown');
    const shorts = this._state.channel_states.filter((c) => c.continuity === 'short');
    if (shorts.length > 0) issues.push(`${shorts.length} SHORT circuit(s)`);
    const unknowns = this._state.channel_states.filter((c) => c.continuity === 'unknown');
    if (unknowns.length > 0) issues.push(`${unknowns.length} unchecked channel(s)`);
    return { healthy: issues.length === 0, issues };
  }

  reset(): void {
    this._connected = 'disconnected';
    this._firmware = null;
    this._moduleAddress = null;
    this._baudRate = null;
    this._state = this._createDefaultState();
    markHandshakeLost(this._provenance);
  }

  /**
   * Promote to LIVE READ-ONLY after a wizard-validated handshake
   * (`IDENTIFY` reply + firmware ≥ 5.00). Called by
   * `discoveryRegistryBridge` only — UI never calls direct.
   */
  markHandshakeOk(args: FireOneXL4HandshakeArgs = {}): void {
    this._connected = 'connected';
    if (args.firmware !== undefined) this._firmware = args.firmware;
    if (args.moduleAddress !== undefined) this._moduleAddress = args.moduleAddress;
    if (args.baudRate !== undefined) this._baudRate = args.baudRate;
    markHandshakeOk(this._provenance, args.transport ?? 'serial_usb');
  }

  markHandshakeLost(): void {
    this._connected = 'disconnected';
    markHandshakeLost(this._provenance);
  }

  /** Diagnostic-only getters used by the presence hook + UI. */
  getFirmware(): string | null { return this._firmware; }
  getModuleAddress(): number | null { return this._moduleAddress; }
  getBaudRate(): number | null { return this._baudRate; }

  private _updateCounts(): void {
    this._state.healthy_channels = this._state.channel_states
      .filter((c) => c.continuity === 'ok').length;
    this._state.fault_channels = this._state.channel_states
      .filter((c) => c.continuity === 'short' || c.continuity === 'open')
      .map((c) => c.channel);
  }
}

export const fireOneXL4Adapter = new FireOneXL4Adapter();
