/**
 * ─── 32-Channel Relay Bank Adapter ─────────────────────────────────
 * Read-only monitoring of the relay bank state.
 * Tracks continuity per channel, health status, and fault detection.
 * NO relay control commands — diagnostic/readiness only.
 */

import type { HardwareAdapter, HardwareCapabilities, HardwareStatusSnapshot, DeviceConnectionState, RelayBankState, RelayChannelState } from '../types';

export class RelayBankAdapter32 implements HardwareAdapter<RelayBankState> {
  readonly deviceId = 'relay-bank-32ch';
  readonly deviceType = 'relay-bank' as const;
  readonly label = '32ch Relay Bank — Field Output';

  private _connected: DeviceConnectionState = 'disconnected';
  private _state: RelayBankState;

  constructor() {
    this._state = this._createDefaultState();
  }

  private _createDefaultState(): RelayBankState {
    return {
      bank_id: 'relay-bank-32ch',
      channel_count: 32,
      healthy_channels: 0,
      fault_channels: [],
      channel_states: Array.from({ length: 32 }, (_, i) => ({
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
      canRead: true, canWrite: false, canDiagnose: true, canSimulate: true,
      canExport: false, supportsTelemetry: true, supportsContinuity: true,
      maxChannels: 32, protocols: ['shift-register-spi'],
    };
  }

  getSnapshot(): HardwareStatusSnapshot {
    const warnings: string[] = [];
    const errors: string[] = [];
    const opens = this._state.channel_states.filter(c => c.continuity === 'open').length;
    const shorts = this._state.channel_states.filter(c => c.continuity === 'short').length;
    if (opens > 0) warnings.push(`${opens} open channel(s)`);
    if (shorts > 0) errors.push(`${shorts} SHORT channel(s)`);
    if (this._state.fault_channels.length > 0) errors.push(`${this._state.fault_channels.length} fault(s)`);

    return {
      device_id: this.deviceId, timestamp: Date.now(),
      online: this._connected === 'connected', warnings, errors,
      metrics: {
        total: 32,
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

  pollTelemetry(): void {
    if (this._connected !== 'connected') return;
    const now = Date.now();
    for (const ch of this._state.channel_states) {
      ch.last_checked = now;
      if (ch.continuity === 'ok') {
        ch.resistance_ohms = 1.0 + Math.random() * 1.5;
      }
    }
    this._updateCounts();
  }

  runDiagnostics(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    if (this._connected !== 'connected') issues.push('Relay bank not connected');
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

  simulateConnect(): void { this._connected = 'connected'; }
  simulateDisconnect(): void { this._connected = 'disconnected'; }

  /** Set specific channel continuity for test scenarios */
  simulateChannel(channel: number, continuity: RelayChannelState['continuity'], resistance: number = 1.5): void {
    if (channel >= 0 && channel < 32) {
      this._state.channel_states[channel].continuity = continuity;
      this._state.channel_states[channel].resistance_ohms = resistance;
      this._state.channel_states[channel].last_checked = Date.now();
      this._updateCounts();
    }
  }

  private _updateCounts(): void {
    this._state.healthy_channels = this._state.channel_states.filter(c => c.continuity === 'ok').length;
    this._state.fault_channels = this._state.channel_states
      .filter(c => c.continuity === 'short' || c.continuity === 'open')
      .map(c => c.channel);
  }
}

export const relayBankAdapter = new RelayBankAdapter32();
