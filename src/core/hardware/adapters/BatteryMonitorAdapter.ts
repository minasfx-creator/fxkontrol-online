/**
 * ─── Battery Monitor Adapter ───────────────────────────────────────
 * Read-only monitoring of 12V field battery state.
 * Triggers low-battery alarms that block hardware sync.
 */

import type { HardwareAdapter, HardwareCapabilities, HardwareStatusSnapshot, DeviceConnectionState, BatteryState } from '../types';
import { createSimulatedProvenance, type ProvenanceInfo } from '../provenance';
import { isHardwareSimulatorEnabled } from '@/lib/featureFlags';

export class BatteryMonitorAdapter implements HardwareAdapter<BatteryState> {
  readonly deviceId = 'battery-12v';
  readonly deviceType = 'battery' as const;
  readonly label = '12V Field Battery';
  private _provenance: ProvenanceInfo = createSimulatedProvenance('analog_mux');

  private _connected: DeviceConnectionState = 'disconnected';
  private _state: BatteryState = {
    voltage: 0, source: 'battery', percentage: 0,
    low_battery_alarm: false, charging: false,
  };

  getConnectionState(): DeviceConnectionState { return this._connected; }

  getCapabilities(): HardwareCapabilities {
    return {
      canRead: true, canWrite: false, canDiagnose: true, canSimulate: true,
      canExport: false, supportsTelemetry: true, supportsContinuity: false,
      maxChannels: 1, protocols: ['adc-voltage-divider'],
    };
  }

  getSnapshot(): HardwareStatusSnapshot {
    const warnings: string[] = [];
    const errors: string[] = [];
    if (this._state.low_battery_alarm) errors.push('LOW BATTERY — blocks hardware sync');
    if (this._state.voltage > 0 && this._state.voltage < 11.5) warnings.push(`Voltage dropping: ${this._state.voltage.toFixed(1)}V`);
    return {
      device_id: this.deviceId, timestamp: Date.now(),
      online: this._connected === 'connected', warnings, errors,
      metrics: {
        voltage: this._state.voltage,
        percentage: this._state.percentage,
        source: this._state.source,
        charging: this._state.charging ? 1 : 0,
      },
    };
  }

  getState(): BatteryState { return { ...this._state }; }
  getProvenance(): ProvenanceInfo { return { ...this._provenance, last_seen_at: Date.now(), data_freshness_ms: 0 }; }

  pollTelemetry(): void {
    if (this._connected !== 'connected') return;
    if (!isHardwareSimulatorEnabled()) return;
    // Simulate slow discharge (only when simulator gate is ON)
    if (!this._state.charging && this._state.voltage > 10.5) {
      this._state.voltage -= 0.001 + Math.random() * 0.002;
    }
    this._state.percentage = Math.max(0, Math.min(100,
      ((this._state.voltage - 10.5) / (12.6 - 10.5)) * 100));
    this._state.low_battery_alarm = this._state.voltage < 11.0;
  }

  runDiagnostics(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    if (this._connected !== 'connected') issues.push('Battery monitor not connected');
    if (this._state.low_battery_alarm) issues.push('LOW BATTERY ALARM');
    if (this._state.voltage < 11.5 && this._state.voltage > 0) issues.push('Voltage below nominal');
    return { healthy: issues.length === 0, issues };
  }

  reset(): void {
    this._connected = 'disconnected';
    this._state = { voltage: 0, source: 'battery', percentage: 0, low_battery_alarm: false, charging: false };
  }
}

export const batteryMonitorAdapter = new BatteryMonitorAdapter();
