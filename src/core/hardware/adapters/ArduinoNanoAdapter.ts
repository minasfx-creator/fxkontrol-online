/**
 * ─── Arduino Nano Adapter ──────────────────────────────────────────
 * Represents the Arduino Nano controller in diagnostic/telemetry mode.
 * NO firing commands. Read-only state monitoring and simulation.
 */

import type { HardwareAdapter, HardwareCapabilities, HardwareStatusSnapshot, DeviceConnectionState } from '../types';
import { createSimulatedProvenance, type ProvenanceInfo } from '../provenance';

export interface ArduinoNanoState {
  firmware: string;
  uptime_ms: number;
  free_ram_bytes: number;
  loop_frequency_hz: number;
  watchdog_active: boolean;
  serial_baud: number;
  digital_pins: boolean[];   // read-only pin states
  analog_pins: number[];     // read-only ADC values
}

export class ArduinoNanoAdapter implements HardwareAdapter<ArduinoNanoState> {
  readonly deviceId = 'arduino-nano-01';
  readonly deviceType = 'controller' as const;
  readonly label = 'Arduino Nano — FXK Controller';
  private _provenance: ProvenanceInfo = createSimulatedProvenance('serial_usb');

  private _connected: DeviceConnectionState = 'disconnected';
  private _state: ArduinoNanoState = {
    firmware: 'FXK-NANO-v2.4.1',
    uptime_ms: 0,
    free_ram_bytes: 1800,
    loop_frequency_hz: 0,
    watchdog_active: false,
    serial_baud: 115200,
    digital_pins: new Array(14).fill(false),
    analog_pins: new Array(8).fill(0),
  };

  getConnectionState(): DeviceConnectionState { return this._connected; }

  getCapabilities(): HardwareCapabilities {
    return {
      canRead: true,
      canWrite: false,  // NO write commands in safe mode
      canDiagnose: true,
      canSimulate: true,
      canExport: false,
      supportsTelemetry: true,
      supportsContinuity: false,
      maxChannels: 14,
      protocols: ['serial-115200', 'usb-cdc'],
    };
  }

  getSnapshot(): HardwareStatusSnapshot {
    const warnings: string[] = [];
    const errors: string[] = [];
    if (this._state.free_ram_bytes < 512) warnings.push('Low RAM');
    if (this._state.loop_frequency_hz < 50) warnings.push('Loop frequency below 50Hz');
    if (!this._state.watchdog_active) warnings.push('Watchdog inactive');
    if (this._connected === 'error') errors.push('Communication fault');

    return {
      device_id: this.deviceId,
      timestamp: Date.now(),
      online: this._connected === 'connected',
      warnings,
      errors,
      metrics: {
        firmware: this._state.firmware,
        uptime_ms: this._state.uptime_ms,
        free_ram: this._state.free_ram_bytes,
        loop_hz: this._state.loop_frequency_hz,
      },
    };
  }

  getState(): ArduinoNanoState { return { ...this._state }; }
  getProvenance(): ProvenanceInfo { this._provenance.last_seen_at = Date.now(); this._provenance.data_freshness_ms = 0; return { ...this._provenance }; }

  pollTelemetry(): void {
    if (this._connected === 'connected') {
      this._state.uptime_ms += 1000;
      this._state.loop_frequency_hz = 58 + Math.random() * 4;
      this._state.free_ram_bytes = 1600 + Math.floor(Math.random() * 400);
      // Simulate ADC readings (continuity MUX, battery voltage)
      this._state.analog_pins = this._state.analog_pins.map(() => Math.floor(Math.random() * 1024));
    }
  }

  runDiagnostics(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    if (this._connected !== 'connected') issues.push('Device not connected');
    if (this._state.free_ram_bytes < 512) issues.push('Critical: Low RAM');
    if (!this._state.watchdog_active) issues.push('Watchdog not enabled');
    return { healthy: issues.length === 0, issues };
  }

  reset(): void {
    this._state.uptime_ms = 0;
    this._state.free_ram_bytes = 1800;
    this._state.loop_frequency_hz = 0;
    this._connected = 'disconnected';
  }

  /** Simulate connection (for test/diagnostic mode) */
  simulateConnect(): void {
    this._connected = 'connected';
    this._state.watchdog_active = true;
    this._state.loop_frequency_hz = 60;
  }

  simulateDisconnect(): void {
    this._connected = 'disconnected';
    this._state.loop_frequency_hz = 0;
  }

  simulateError(): void {
    this._connected = 'error';
  }
}

export const arduinoNanoAdapter = new ArduinoNanoAdapter();
