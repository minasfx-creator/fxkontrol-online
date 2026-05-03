/**
 * ─── 74HC595 Shift Register Adapter ────────────────────────────────
 * Read-only monitoring of shift register chain state.
 * Maps 8→32 output expansion for relay bank control.
 * NO output commands — diagnostic/telemetry only.
 */

import type { HardwareAdapter, HardwareCapabilities, HardwareStatusSnapshot, DeviceConnectionState, ShiftRegisterState } from '../types';
import {
  createSimulatedProvenance,
  markHandshakeOk as provenanceMarkHandshakeOk,
  markHandshakeLost as provenanceMarkHandshakeLost,
  type ProvenanceInfo,
  type TransportType,
} from '../provenance';

export class ShiftRegisterAdapter74HC595 implements HardwareAdapter<ShiftRegisterState> {
  readonly deviceId = 'sr-74hc595-chain';
  readonly deviceType = 'shift-register' as const;
  readonly label = '74HC595 × 4 — Output Expansion';
  private _provenance: ProvenanceInfo = createSimulatedProvenance('spi');

  private _connected: DeviceConnectionState = 'disconnected';
  private _state: ShiftRegisterState = {
    register_id: 'sr-74hc595-chain',
    output_count: 32,
    comm_state: 'ok',
    outputs: new Array(32).fill(false),
  };

  getConnectionState(): DeviceConnectionState { return this._connected; }

  getCapabilities(): HardwareCapabilities {
    return {
      canRead: true, canWrite: false, canDiagnose: true, canSimulate: true,
      canExport: false, supportsTelemetry: true, supportsContinuity: false,
      maxChannels: 32, protocols: ['spi'],
    };
  }

  getSnapshot(): HardwareStatusSnapshot {
    const warnings: string[] = [];
    const errors: string[] = [];
    if (this._state.comm_state === 'timeout') warnings.push('SPI timeout');
    if (this._state.comm_state === 'fault') errors.push('SPI communication fault');
    return {
      device_id: this.deviceId, timestamp: Date.now(),
      online: this._connected === 'connected', warnings, errors,
      metrics: { outputs: this._state.output_count, comm: this._state.comm_state },
    };
  }

  getState(): ShiftRegisterState { return { ...this._state, outputs: [...this._state.outputs] }; }
  getProvenance(): ProvenanceInfo { return { ...this._provenance, last_seen_at: Date.now(), data_freshness_ms: 0 }; }

  pollTelemetry(): void {
    // In read-only mode, we only observe — no state changes unless simulated
  }

  runDiagnostics(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    if (this._connected !== 'connected') issues.push('Shift register chain not connected');
    if (this._state.comm_state !== 'ok') issues.push(`SPI state: ${this._state.comm_state}`);
    return { healthy: issues.length === 0, issues };
  }

  reset(): void {
    this._connected = 'disconnected';
    this._state.comm_state = 'ok';
    this._state.outputs = new Array(32).fill(false);
    provenanceMarkHandshakeLost(this._provenance);
  }

  /**
   * Promote to LIVE READ-ONLY. 74HC595 chain state is reported by the
   * host controller (FXK16/Arduino) — piggy-back promotion by the bridge.
   * Read-only by construction (canWrite=false).
   */
  markHandshakeOk(transport: TransportType = 'serial_usb'): void {
    this._connected = 'connected';
    provenanceMarkHandshakeOk(this._provenance, transport);
  }

  /** Demote when the host link drops. */
  markHandshakeLost(): void {
    this._connected = 'disconnected';
    provenanceMarkHandshakeLost(this._provenance);
  }
}

export const shiftRegisterAdapter = new ShiftRegisterAdapter74HC595();
