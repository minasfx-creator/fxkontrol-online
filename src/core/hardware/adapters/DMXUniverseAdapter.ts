/**
 * ─── DMX Universe Adapter ──────────────────────────────────────────
 * Monitors DMX universe state: channel occupancy, refresh rate,
 * protocol version. Read-only — no DMX data transmission.
 */

import type { HardwareAdapter, HardwareCapabilities, HardwareStatusSnapshot, DeviceConnectionState } from '../types';
import {
  createSimulatedProvenance,
  markHandshakeOk,
  markHandshakeLost,
  type ProvenanceInfo,
} from '../provenance';
import { isHardwareSimulatorEnabled } from '@/lib/featureFlags';

export interface DMXUniverseState {
  universe_id: number;
  protocol: 'DMX512' | 'sACN' | 'Art-Net';
  channel_count: number;
  occupied_channels: number;
  refresh_rate_hz: number;
  max_refresh_rate_hz: number;
  link: { connected: boolean; latency_ms: number; errors: number };
}

// Honest-hardware default: disconnected, zeroed link, no fake telemetry.
// Tests/UI may inject state via _injectState() to drive synthetic scenarios.
const DEFAULT_STATE: DMXUniverseState = {
  universe_id: 1,
  protocol: 'DMX512',
  channel_count: 512,
  occupied_channels: 0,
  refresh_rate_hz: 0,
  max_refresh_rate_hz: 44,
  link: { connected: false, latency_ms: 0, errors: 0 },
};

class DMXUniverseAdapterImpl implements HardwareAdapter<DMXUniverseState> {
  readonly deviceId = 'dmx-universe-1';
  readonly deviceType = 'dmx-interface' as const;
  readonly label = 'DMX Universe 1';
  private _provenance: ProvenanceInfo = createSimulatedProvenance('ethernet_udp');

  private _state: DMXUniverseState = { ...DEFAULT_STATE, link: { ...DEFAULT_STATE.link } };
  private _connectionState: DeviceConnectionState = 'disconnected';

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
  getProvenance(): ProvenanceInfo { return { ...this._provenance, last_seen_at: Date.now(), data_freshness_ms: 0 }; }

  pollTelemetry(): void {
    // Honest-hardware: only emit jitter when we actually have a link
    // (set via _injectState) AND simulator gate is ON.
    if (!this._state.link.connected) return;
    if (!isHardwareSimulatorEnabled()) return;
    this._state.refresh_rate_hz = Math.max(0, 44 + (Math.random() - 0.5) * 4);
    this._state.link.latency_ms = Math.max(0.5, 1.2 + (Math.random() - 0.5) * 1);
    this._connectionState = 'connected';
  }

  runDiagnostics(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    if (!this._state.link.connected) issues.push('DMX link not connected');
    if (this._state.refresh_rate_hz < 20) issues.push('Refresh rate below minimum');
    if (this._state.occupied_channels === 0) issues.push('No channels occupied');
    return { healthy: issues.length === 0, issues };
  }

  reset(): void {
    this._state = { ...DEFAULT_STATE, link: { ...DEFAULT_STATE.link } };
    this._connectionState = 'disconnected';
  }

  reset(): void {
    this._state = { ...DEFAULT_STATE, link: { ...DEFAULT_STATE.link } };
    this._connectionState = 'disconnected';
    markHandshakeLost(this._provenance);
  }

  /**
   * Promote to LIVE READ-ONLY after a USB-DMX interface (Enttec/USBDMX/uDMX)
   * is authorized via Web Serial. Called by `discoveryRegistryBridge`.
   */
  markHandshakeOk(label?: string): void {
    this._connectionState = 'connected';
    this._state.link.connected = true;
    if (label) this._state.protocol = 'DMX512';
    markHandshakeOk(this._provenance, 'serial_usb');
  }

  /** Demote to NOT_INTEGRATED on disconnect / port revoked. */
  markHandshakeLost(): void {
    this._connectionState = 'disconnected';
    this._state.link.connected = false;
    markHandshakeLost(this._provenance);
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
