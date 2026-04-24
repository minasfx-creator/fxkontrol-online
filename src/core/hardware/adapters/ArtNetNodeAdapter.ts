/**
 * ─── Art-Net Node Adapter ──────────────────────────────────────────
 * Read-only monitoring of Art-Net network node.
 * Tracks link health, packet rates, and universe mapping.
 */

import type { HardwareAdapter, HardwareCapabilities, HardwareStatusSnapshot, DeviceConnectionState, LinkHealthState } from '../types';
import { createSimulatedProvenance, type ProvenanceInfo } from '../provenance';

export interface ArtNetNodeState {
  node_ip: string;
  universes: number[];
  packets_per_second: number;
  link: LinkHealthState;
  artpoll_responses: number;
}

export class ArtNetNodeAdapter implements HardwareAdapter<ArtNetNodeState> {
  readonly deviceId = 'artnet-node-01';
  readonly deviceType = 'artnet-node' as const;
  readonly label = 'Art-Net Node — DMX Bridge';
  private _provenance: ProvenanceInfo = createSimulatedProvenance('ethernet_udp');

  private _connected: DeviceConnectionState = 'disconnected';
  private _state: ArtNetNodeState = {
    node_ip: '0.0.0.0',
    universes: [],
    packets_per_second: 0,
    link: { protocol: 'Art-Net 4', connected: false, latency_ms: 0, packet_loss: 0, degraded: false, last_packet: 0 },
    artpoll_responses: 0,
  };

  getConnectionState(): DeviceConnectionState { return this._connected; }

  getCapabilities(): HardwareCapabilities {
    return {
      canRead: true, canWrite: false, canDiagnose: true, canSimulate: true,
      canExport: true, supportsTelemetry: true, supportsContinuity: false,
      maxChannels: 512, protocols: ['artnet-4', 'sacn-e131'],
    };
  }

  getSnapshot(): HardwareStatusSnapshot {
    const warnings: string[] = [];
    const errors: string[] = [];
    if (this._state.link.degraded) warnings.push('Link degraded');
    if (this._state.link.packet_loss > 5) warnings.push(`Packet loss: ${this._state.link.packet_loss.toFixed(1)}%`);
    if (this._state.link.latency_ms > 50) warnings.push(`High latency: ${this._state.link.latency_ms}ms`);
    if (this._connected === 'error') errors.push('Art-Net link down');

    return {
      device_id: this.deviceId, timestamp: Date.now(),
      online: this._connected === 'connected' || this._connected === 'degraded',
      warnings, errors,
      metrics: {
        ip: this._state.node_ip,
        universes: this._state.universes.length,
        pps: this._state.packets_per_second,
        latency: this._state.link.latency_ms,
        loss: this._state.link.packet_loss,
      },
    };
  }

  getState(): ArtNetNodeState {
    return { ...this._state, universes: [...this._state.universes], link: { ...this._state.link } };
  }
  getProvenance(): ProvenanceInfo { return { ...this._provenance, last_seen_at: Date.now(), data_freshness_ms: 0 }; }

  pollTelemetry(): void {
    if (this._connected === 'connected' || this._connected === 'degraded') {
      this._state.packets_per_second = 30 + Math.floor(Math.random() * 10);
      this._state.link.latency_ms = this._state.link.degraded ? 35 + Math.random() * 30 : 2 + Math.random() * 5;
      this._state.link.packet_loss = this._state.link.degraded ? 2 + Math.random() * 5 : Math.random() * 0.5;
      this._state.link.last_packet = Date.now();
      this._state.artpoll_responses++;
    }
  }

  runDiagnostics(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    if (this._connected === 'disconnected' || this._connected === 'error') issues.push('Art-Net node offline');
    if (this._state.link.degraded) issues.push('Link quality degraded');
    if (this._state.universes.length === 0) issues.push('No universes mapped');
    return { healthy: issues.length === 0, issues };
  }

  reset(): void {
    this._connected = 'disconnected';
    this._state = {
      node_ip: '0.0.0.0', universes: [], packets_per_second: 0,
      link: { protocol: 'Art-Net 4', connected: false, latency_ms: 0, packet_loss: 0, degraded: false, last_packet: 0 },
      artpoll_responses: 0,
    };
  }
}

export const artNetNodeAdapter = new ArtNetNodeAdapter();
