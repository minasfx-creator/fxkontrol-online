/**
 * ─── FireOne XL4+ Adapter ─────────────────────────────────────────
 *
 * Logical representation of a FireOne XLII+ / XL4-3 / XL4+ master
 * controller (32 igniters per slat, addressed RS-485 / USB-FTDI).
 *
 * The adapter is **strictly read-only**: every operational FIRE / ARM
 * still flows through `uiCommandGateway → CommandBus → SafetyStateMachine`.
 * Promotion to `live_read_only` happens once the pairing wizard validates
 * baud + IDENTIFY frame + firmware ≥ 5.0 (see `fireoneXL4Handshake.ts`),
 * via `useFireOneXL4Bridge` → `discoveryRegistryBridge`.
 *
 * Honest-Hardware compliance:
 *   - Default provenance is `not_integrated` (no synthetic data ever).
 *   - `pollTelemetry` is a no-op unless the dev simulator flag is on.
 *   - `markHandshakeLost()` immediately demotes on disconnect.
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

const XL4_CHANNELS = 32;

export class FireOneXL4Adapter implements HardwareAdapter<RelayBankState> {
  readonly deviceId = 'fireone-xl4';
  readonly deviceType = 'relay-bank' as const;
  readonly label = 'FireOne XL4+ — 32ch master';
  readonly protocolFamily = 'fireone-binary' as const;
  readonly firmwareModel = 'XL4+' as const;
  readonly compatibleWith = 'fireone_xlii_plus' as const;

  private _provenance: ProvenanceInfo = createSimulatedProvenance('serial_usb');
  private _connected: DeviceConnectionState = 'disconnected';
  private _firmware: string | null = null;
  private _moduleAddress: number | null = null;
  private _baudRate: number | null = null;
  private _state: RelayBankState;

  constructor() {
    this._state = this._createDefaultState();
  }

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
      canWrite: false,             // safety-locked at registry boundary
      canDiagnose: true,
      canSimulate: false,          // no fake data in honest mode
      canExport: false,
      supportsTelemetry: true,
      supportsContinuity: true,
      maxChannels: XL4_CHANNELS,
      protocols: ['serial-9600', 'serial-19200', 'serial-38400', 'rs485-fireone'],
    };
  }

  getSnapshot(): HardwareStatusSnapshot {
    const warnings: string[] = [];
    const errors: string[] = [];
    if (this._connected !== 'connected') {
      warnings.push('XL4+ master not connected');
    }
    return {
      device_id: this.deviceId,
      timestamp: Date.now(),
      online: this._connected === 'connected',
      warnings,
      errors,
      metrics: {
        model: this.firmwareModel,
        protocol_family: this.protocolFamily,
        firmware: this._firmware ?? 'unknown',
        module_address: this._moduleAddress ?? -1,
        baud: this._baudRate ?? 0,
        total: XL4_CHANNELS,
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

  /** No-op: real telemetry comes from useFireOneFleet's STATUS polling. */
  pollTelemetry(): void { /* honest hardware: no synthetic generation */ }

  runDiagnostics(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    if (this._connected !== 'connected') issues.push('XL4+ master not connected');
    if (this._firmware == null) issues.push('Firmware version unknown');
    return { healthy: issues.length === 0, issues };
  }

  reset(): void {
    this._connected = 'disconnected';
    this._firmware = null;
    this._moduleAddress = null;
    this._baudRate = null;
    this._state = this._createDefaultState();
    this._provenance = markHandshakeLost(this._provenance);
  }

  /**
   * Promote to LIVE READ-ONLY after a wizard-validated handshake.
   * Called by `discoveryRegistryBridge` only — UI never calls direct.
   */
  markHandshakeOk(args: {
    transport?: TransportType;
    firmware?: string;
    moduleAddress?: number;
    baudRate?: number;
  } = {}): void {
    this._connected = 'connected';
    this._firmware = args.firmware ?? this._firmware;
    this._moduleAddress = args.moduleAddress ?? this._moduleAddress;
    this._baudRate = args.baudRate ?? this._baudRate;
    this._provenance = markHandshakeOk(this._provenance, args.transport ?? 'serial_usb');
  }

  markHandshakeLost(): void {
    this._connected = 'disconnected';
    this._provenance = markHandshakeLost(this._provenance);
  }

  /** Diagnostic-only getters used by the presence hook + UI. */
  getFirmware(): string | null { return this._firmware; }
  getModuleAddress(): number | null { return this._moduleAddress; }
  getBaudRate(): number | null { return this._baudRate; }
}

export const fireOneXL4Adapter = new FireOneXL4Adapter();
