/**
 * ─── DMX Universe Adapter ──────────────────────────────────────────
 * Monitors DMX universe state: channel occupancy, refresh rate,
 * protocol version. Read-only — no DMX data transmission.
 */

import type { HardwareAdapter, HardwareCapabilities, HardwareStatusSnapshot, DeviceConnectionState } from '../types';

export interface DMXUniverseState {
  universe_id: number;
  protocol: 'DMX512' | 'sACN' | 'Art-Net';
  channel_count: number;
  occupied_channels: number;
  refresh_rate_hz: number;
  max_refresh_rate_hz: number;
  link: { connected: boolean; latency_ms: number; errors: number };
}

const DEFAULT_STATE: DMXUniverseState = {
  universe_id: 1,
  protocol: 'DMX512',
  channel_count: 512,
  occupied_channels: 0,
  refresh_rate_hz: 44,
  max_refresh_rate_hz: 44,
  link: { connected: true, latency_ms: 1.2, errors: 0 },
};

class DMXUniverseAdapterImpl implements HardwareAdapter<DMXUniverseState> {
  readonly deviceId = 'dmx-universe-1';
  readonly deviceType = 'dmx-interface' as const;
  readonly label = 'DMX Universe 1';

  private _state: DMXUniverseState = { ...DEFAULT_STATE };
  private _connectionState: DeviceConnectionState = 'connected';

  getConnectionState(): DeviceConnectionState { return this._connectionState; }

  getCapabilities(): HardwareCapabilities {
    return {
      canRead: true, canWrite: false, canDiagnose: true, canSimulate: true,
      canExport: false, supportsTelemetry: true, supportsContinuity: false,
      maxChannels: 512, protocols: ['DMX512', 'sACN', 'Art-Net'],
    };
  }

  getSnapshot(): HardwareStatusSnapshot {
    const warnings: string[] = [];
    const errors: string[] = [];
    if (this._state.refresh_rate_hz < 20) warnings.push(`Low refresh rate: ${this._state.refresh_rate_hz}Hz`);
    if (!this._state.link.connected) errors.push('DMX link disconnected');
    if (this._state.link.errors > 10) warnings.push(`${this._state.link.errors} protocol errors`);
    return {
      device_id: this.deviceId, timestamp: Date.now(), online: this._state.link.connected,
      warnings, errors,
      metrics: {
        universe: this._state.universe_id, protocol: this._state.protocol,
        occupied: this._state.occupied_channels, refresh_hz: this._state.refresh_rate_hz,
        latency_ms: this._state.link.latency_ms,
      },
    };
  }

  getState(): DMXUniverseState { return { ...this._state }; }

  pollTelemetry(): void {
    // Simulate minor jitter
    this._state.refresh_rate_hz = DEFAULT_STATE.refresh_rate_hz + (Math.random() - 0.5) * 4;
    this._state.link.latency_ms = Math.max(0.5, DEFAULT_STATE.link.latency_ms + (Math.random() - 0.5) * 1);
    this._connectionState = this._state.link.connected ? 'connected' : 'disconnected';
  }

  runDiagnostics(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    if (!this._state.link.connected) issues.push('DMX link not connected');
    if (this._state.refresh_rate_hz < 20) issues.push('Refresh rate below minimum');
    if (this._state.occupied_channels === 0) issues.push('No channels occupied');
    return { healthy: issues.length === 0, issues };
  }

  reset(): void {
    this._state = { ...DEFAULT_STATE };
    this._connectionState = 'connected';
  }

  /** Test injection */
  _injectState(partial: Partial<DMXUniverseState>): void {
    Object.assign(this._state, partial);
    if (!this._state.link.connected) this._connectionState = 'disconnected';
    else if (this._state.link.errors > 10) this._connectionState = 'degraded';
    else this._connectionState = 'connected';
  }
}

export const dmxUniverseAdapter = new DMXUniverseAdapterImpl();
