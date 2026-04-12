/**
 * ─── CD4051 Multiplexer Reader Adapter ─────────────────────────────
 * Read-only adapter for dual CD4051 8:1 MUX (16 analog channels).
 * Used for continuity reading and battery voltage monitoring.
 * NO control commands — telemetry and diagnostics only.
 */

import type { HardwareAdapter, HardwareCapabilities, HardwareStatusSnapshot, DeviceConnectionState, MultiplexerState, MuxChannelReading } from '../types';

export class MuxReaderAdapterCD4051 implements HardwareAdapter<MultiplexerState[]> {
  readonly deviceId = 'mux-cd4051-dual';
  readonly deviceType = 'multiplexer' as const;
  readonly label = 'CD4051 × 2 — 16ch Analog MUX';

  private _connected: DeviceConnectionState = 'disconnected';
  private _muxStates: MultiplexerState[] = [
    { mux_id: 'mux-a', selected_channel: 0, sample_count: 0, fault_state: false, channels: this._initChannels(0) },
    { mux_id: 'mux-b', selected_channel: 0, sample_count: 0, fault_state: false, channels: this._initChannels(8) },
  ];

  private _initChannels(offset: number): MuxChannelReading[] {
    return Array.from({ length: 8 }, (_, i) => ({
      channel: offset + i,
      raw_value: 0,
      resistance_ohms: 9999,
      state: 'unknown' as const,
    }));
  }

  getConnectionState(): DeviceConnectionState { return this._connected; }

  getCapabilities(): HardwareCapabilities {
    return {
      canRead: true, canWrite: false, canDiagnose: true, canSimulate: true,
      canExport: false, supportsTelemetry: true, supportsContinuity: true,
      maxChannels: 16, protocols: ['analog-mux'],
    };
  }

  getSnapshot(): HardwareStatusSnapshot {
    const warnings: string[] = [];
    const errors: string[] = [];
    const faults = this._muxStates.filter(m => m.fault_state);
    if (faults.length > 0) errors.push(`${faults.length} MUX fault(s)`);
    const openChannels = this.getAllChannels().filter(c => c.state === 'open').length;
    if (openChannels > 0) warnings.push(`${openChannels} open channel(s)`);
    const shortChannels = this.getAllChannels().filter(c => c.state === 'short').length;
    if (shortChannels > 0) errors.push(`${shortChannels} short channel(s)`);

    return {
      device_id: this.deviceId, timestamp: Date.now(),
      online: this._connected === 'connected', warnings, errors,
      metrics: {
        total_channels: 16,
        ok: this.getAllChannels().filter(c => c.state === 'ok').length,
        open: openChannels, short: shortChannels,
        samples: this._muxStates.reduce((s, m) => s + m.sample_count, 0),
      },
    };
  }

  getState(): MultiplexerState[] {
    return this._muxStates.map(m => ({
      ...m, channels: m.channels.map(c => ({ ...c })),
    }));
  }

  getAllChannels(): MuxChannelReading[] {
    return this._muxStates.flatMap(m => m.channels);
  }

  pollTelemetry(): void {
    if (this._connected !== 'connected') return;
    for (const mux of this._muxStates) {
      mux.sample_count++;
      for (const ch of mux.channels) {
        // Simulate ADC noise
        if (ch.state === 'ok') {
          ch.raw_value = 450 + Math.floor(Math.random() * 100);
          ch.resistance_ohms = 1.2 + Math.random() * 0.8;
        } else if (ch.state === 'open') {
          ch.raw_value = 1020 + Math.floor(Math.random() * 4);
          ch.resistance_ohms = 99999;
        } else if (ch.state === 'short') {
          ch.raw_value = Math.floor(Math.random() * 10);
          ch.resistance_ohms = 0.01;
        }
      }
    }
  }

  runDiagnostics(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    if (this._connected !== 'connected') issues.push('MUX not connected');
    const shorts = this.getAllChannels().filter(c => c.state === 'short');
    if (shorts.length > 0) issues.push(`${shorts.length} SHORT circuit(s) detected`);
    const opens = this.getAllChannels().filter(c => c.state === 'open');
    if (opens.length > 4) issues.push(`${opens.length} OPEN channels (>4 threshold)`);
    return { healthy: issues.length === 0, issues };
  }

  reset(): void {
    this._connected = 'disconnected';
    this._muxStates = [
      { mux_id: 'mux-a', selected_channel: 0, sample_count: 0, fault_state: false, channels: this._initChannels(0) },
      { mux_id: 'mux-b', selected_channel: 0, sample_count: 0, fault_state: false, channels: this._initChannels(8) },
    ];
  }

  simulateConnect(): void { this._connected = 'connected'; }
  simulateDisconnect(): void { this._connected = 'disconnected'; }

  /** Set individual channel state for test scenarios */
  simulateChannelState(channel: number, state: MuxChannelReading['state']): void {
    const muxIdx = channel < 8 ? 0 : 1;
    const chIdx = channel < 8 ? channel : channel - 8;
    if (this._muxStates[muxIdx]?.channels[chIdx]) {
      this._muxStates[muxIdx].channels[chIdx].state = state;
    }
  }

  simulateMuxFault(muxId: string): void {
    const mux = this._muxStates.find(m => m.mux_id === muxId);
    if (mux) { mux.fault_state = true; this._connected = 'degraded'; }
  }
}

export const muxReaderAdapter = new MuxReaderAdapterCD4051();
