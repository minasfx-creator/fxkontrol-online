/**
 * ─── Link Failover Policy ───────────────────────────────────────────
 * Auto-failover between DMX transport protocols:
 * Art-Net → sACN → USB Serial
 */

import { artNetBridge, type ArtNetState } from './ArtNetBridge';
import { blackbox } from '@/core/reliability/blackBoxRecorder';

export type ProtocolLink = 'artnet' | 'sacn' | 'serial';

export interface LinkStatus {
  activeLink: ProtocolLink;
  artnet: ArtNetState;
  sacn: 'connected' | 'disconnected';
  serial: 'connected' | 'disconnected';
  failoverCount: number;
  lastFailover: number;
}

class LinkFailoverPolicy {
  private _activeLink: ProtocolLink = 'artnet';
  private _failoverCount = 0;
  private _lastFailover = 0;
  private _checkInterval: ReturnType<typeof setInterval> | null = null;

  /** Start monitoring link health. */
  startMonitoring(intervalMs = 1000): void {
    if (this._checkInterval) return;
    this._checkInterval = setInterval(() => this._check(), intervalMs);
  }

  stopMonitoring(): void {
    if (this._checkInterval) {
      clearInterval(this._checkInterval);
      this._checkInterval = null;
    }
  }

  private _check(): void {
    const artnetState = artNetBridge.getState();

    if (this._activeLink === 'artnet' && artnetState !== 'connected') {
      // Failover to sACN (stub) or serial
      this._activeLink = 'serial';
      this._failoverCount++;
      this._lastFailover = Date.now();
      blackbox.record('net', `LinkFailover: artnet → ${this._activeLink} (count: ${this._failoverCount})`);
    }

    // Recovery: if Art-Net comes back and we're on fallback
    if (this._activeLink !== 'artnet' && artnetState === 'connected') {
      const prev = this._activeLink;
      this._activeLink = 'artnet';
      blackbox.record('net', `LinkFailover: recovered ${prev} → artnet`);
    }
  }

  getStatus(): LinkStatus {
    return {
      activeLink: this._activeLink,
      artnet: artNetBridge.getState(),
      sacn: 'disconnected', // Stub
      serial: 'disconnected', // Stub — future WebSerial
      failoverCount: this._failoverCount,
      lastFailover: this._lastFailover,
    };
  }

  getActiveLink(): ProtocolLink { return this._activeLink; }
}

export const linkFailoverPolicy = new LinkFailoverPolicy();
