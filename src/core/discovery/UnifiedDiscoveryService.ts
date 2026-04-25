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
import { portRegistry, keyFor } from './portRegistry';
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

  /** Re-run only the supplied transports (used by "Retry failed transports"). */
  async scanTransports(transports: DiscoveryTransport[]): Promise<DiscoveredDevice[]> {
    this._bridge();
    this._isScanning = true;
    try {
      const map: Record<DiscoveryTransport, TransportDiscoverer> = {
        webserial: webSerialDiscoverer,
        webusb: webUsbDiscoverer,
        webble: webBleDiscoverer,
        'mdns-artnet': mdnsArtnetDiscoverer,
      };
      await Promise.allSettled(
        transports
          .filter((t, i, a) => a.indexOf(t) === i)
          .map(t => map[t]?.scan().catch(e => { logger.warn('[UnifiedDiscovery] retry failed', t, e); return []; })),
      );
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

  /**
   * Forget a device end-to-end:
   *  1. Revoke browser permission via the transport's native `forget()`
   *     (Web Serial / WebUSB / WebBluetooth where supported).
   *  2. Drop it from the transport-level cache (emits a `lost` event).
   *  3. Delete the persisted `portRegistry` entry so future boot scans
   *     no longer auto-rehydrate it.
   *
   * Returns `{ revoked }` — `revoked: true` means the browser actually
   * dropped permission and a re-pair will require a fresh user gesture.
   */
  async forgetDevice(deviceId: string): Promise<{ revoked: boolean }> {
    const dev = this._devices.get(deviceId);
    let revoked = false;
    try {
      if (deviceId.startsWith('webserial:')) {
        revoked = await webSerialDiscoverer.forgetDevice(deviceId);
      } else if (deviceId.startsWith('webusb:')) {
        revoked = await webUsbDiscoverer.forgetDevice(deviceId);
      } else if (deviceId.startsWith('webble:')) {
        revoked = await webBleDiscoverer.forgetDevice(deviceId);
      } else if (deviceId.startsWith('mdns-artnet:')) {
        revoked = await mdnsArtnetDiscoverer.forgetDevice(deviceId);
      }
    } catch (e) {
      logger.warn('[UnifiedDiscovery] forget failed', deviceId, e);
    }
    // Always drop the persisted registry entry so auto-reopen stops.
    if (dev) {
      const key = keyFor({ vendorId: dev.vendorId, productId: dev.productId, host: dev.host });
      portRegistry.forget(key);
    }
    // Defensive: ensure unified cache is cleared even if no `lost` event fired.
    this._devices.delete(deviceId);
    return { revoked };
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

// ─── Boot-time silent enumeration ─────────────────────────────────
// Runs once when this module is first imported. No prompts (uses only
// `getPorts()` / `getDevices()`), so it just rehydrates persistence and
// readies hot-plug listeners for already-authorized hardware.
if (typeof window !== 'undefined') {
  queueMicrotask(() => {
    unifiedDiscovery.scanLight().catch(e => logger.warn('[UnifiedDiscovery] boot scan failed', e));
  });
}
export type { DiscoveredDevice, DiscoveryEvent, DiscoveryTransport } from './types';
