/**
 * ─── Unified Discovery Service ─────────────────────────────────────
 * Fan-out across all transport-specific discoverers, deduplicate by
 * canonical id and emit a single normalized event stream.
 *
 * Replaces the simulated `DeviceDiscovery` for real hardware visibility
 * while keeping a backwards-compatible facade in
 * `src/core/hardware/DeviceDiscovery.ts`.
 */

import { logger } from '@/lib/logger';
import { webSerialDiscoverer } from './WebSerialDiscoverer';
import { webUsbDiscoverer } from './WebUsbDiscoverer';
import { webBleDiscoverer } from './WebBleDiscoverer';
import { mdnsArtnetDiscoverer } from './MdnsArtnetDiscoverer';
import type { DiscoveredDevice, DiscoveryEvent, TransportDiscoverer, DiscoveryTransport } from './types';

class UnifiedDiscoveryService {
  private _discoverers: TransportDiscoverer[] = [
    webSerialDiscoverer,
    webUsbDiscoverer,
    webBleDiscoverer,
    mdnsArtnetDiscoverer,
  ];
  private _devices = new Map<string, DiscoveredDevice>();
  private _listeners = new Set<(ev: DiscoveryEvent) => void>();
  private _isScanning = false;
  private _bridged = false;

  get isScanning(): boolean { return this._isScanning; }

  supportMatrix(): Record<DiscoveryTransport, boolean> {
    return {
      webserial: webSerialDiscoverer.isSupported(),
      webusb: webUsbDiscoverer.isSupported(),
      webble: webBleDiscoverer.isSupported(),
      'mdns-artnet': mdnsArtnetDiscoverer.isSupported(),
    };
  }

  getDevices(): DiscoveredDevice[] {
    return Array.from(this._devices.values());
  }

  getByTransport(t: DiscoveryTransport): DiscoveredDevice[] {
    return this.getDevices().filter(d => d.transport === t);
  }

  /** Run a quick scan across the cheap transports (no UDP poll, no prompts). */
  async scanLight(): Promise<DiscoveredDevice[]> {
    this._bridge();
    this._isScanning = true;
    try {
      await Promise.allSettled([
        webSerialDiscoverer.scan(),
        webUsbDiscoverer.scan(),
        webBleDiscoverer.scan(),
      ]);
      return this.getDevices();
    } finally {
      this._isScanning = false;
    }
  }

  /** Full deep scan: includes Art-Net poll over the network bridge. */
  async scanDeep(): Promise<DiscoveredDevice[]> {
    this._bridge();
    this._isScanning = true;
    try {
      await Promise.allSettled([
        webSerialDiscoverer.scan(),
        webUsbDiscoverer.scan(),
        webBleDiscoverer.scan(),
        mdnsArtnetDiscoverer.scan(),
      ]);
      return this.getDevices();
    } finally {
      this._isScanning = false;
    }
  }

  watch(listener: (ev: DiscoveryEvent) => void): () => void {
    this._listeners.add(listener);
    this._bridge();
    return () => { this._listeners.delete(listener); };
  }

  /** Wire each discoverer's events into the unified stream — once. */
  private _bridge(): void {
    if (this._bridged) return;
    for (const d of this._discoverers) {
      try {
        d.watch(ev => this._handle(ev));
      } catch (e) {
        logger.warn('[UnifiedDiscovery] bridge failed', d.id, e);
      }
    }
    this._bridged = true;
  }

  private _handle(ev: DiscoveryEvent): void {
    if (ev.type === 'lost') {
      this._devices.delete(ev.device.id);
    } else {
      this._devices.set(ev.device.id, ev.device);
    }
    for (const fn of this._listeners) {
      try { fn(ev); } catch (e) { logger.warn('[UnifiedDiscovery] listener err', e); }
    }
  }
}

export const unifiedDiscovery = new UnifiedDiscoveryService();
export type { DiscoveredDevice, DiscoveryEvent, DiscoveryTransport } from './types';
