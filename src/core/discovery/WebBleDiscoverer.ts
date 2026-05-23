/**
 * ─── WebBluetooth Discoverer ───────────────────────────────────────
 * Lists BLE devices already paired via `navigator.bluetooth.getDevices()`
 * (Chrome flag: enabled by default since 113). Used for PyroMote BLE,
 * Tuya BLE Mesh, Nordic UART firing modules.
 *
 * `requestDevice()` is NOT called from here — that requires a user gesture
 * and is exposed through the UI panel separately.
 */

import { logger } from '@/lib/logger';
import type { DiscoveredDevice, DiscoveryEvent, TransportDiscoverer } from './types';

interface BluetoothDeviceLike {
  id: string;
  name?: string;
  gatt?: { connected?: boolean };
  addEventListener?: (type: string, fn: () => void) => void;
  removeEventListener?: (type: string, fn: () => void) => void;
  forget?: () => Promise<void>;
}

function isWebBleSupported(): boolean {
  return typeof navigator !== 'undefined'
    && 'bluetooth' in navigator
    && typeof (navigator as unknown as { bluetooth: { getDevices?: unknown } }).bluetooth.getDevices === 'function';
}

function bleToDiscovered(d: BluetoothDeviceLike): DiscoveredDevice {
  const name = d.name?.trim() || `BLE ${d.id.slice(0, 6)}`;
  const family = /pyromote|pyro\s*slave/i.test(d.name ?? '') ? 'showven-pyromote'
    : /tuya/i.test(d.name ?? '') ? 'tuya-mesh'
    : /nordic|uart|nrf/i.test(d.name ?? '') ? 'nordic-uart'
    : 'unknown';
  return {
    id: `webble:${d.id}`,
    transport: 'webble',
    label: name,
    recognized: family !== 'unknown',
    authorized: true,
    online: !!d.gatt?.connected,
    family,
    lastSeen: Date.now(),
    metadata: { bleId: d.id, gattConnected: !!d.gatt?.connected },
  };
}

class WebBleDiscoverer implements TransportDiscoverer {
  readonly id = 'webble' as const;
  private _devices = new Map<string, DiscoveredDevice>();
  private _rawByDeviceId = new Map<string, BluetoothDeviceLike>();
  private _listeners = new Set<(ev: DiscoveryEvent) => void>();
  /** Disconnect handler refs by deviceId — needed for clean removeEventListener. */
  private _gattHandlers = new Map<string, () => void>();

  isSupported(): boolean { return isWebBleSupported(); }

  /** Revoke BLE pairing (Chrome `BluetoothDevice.forget()`) and drop from cache. */
  async forgetDevice(deviceId: string): Promise<boolean> {
    const raw = this._rawByDeviceId.get(deviceId);
    let revoked = false;
    if (raw?.forget) {
      try { await raw.forget(); revoked = true; }
      catch (e) { logger.warn('[WebBleDiscoverer] device.forget failed', e); }
    }
    const dev = this._devices.get(deviceId);
    this._detachGattWatcher(deviceId);
    this._rawByDeviceId.delete(deviceId);
    this._devices.delete(deviceId);
    if (dev) this._emit({ type: 'lost', device: { ...dev, online: false } });
    return revoked;
  }

  async scan(): Promise<DiscoveredDevice[]> {
    if (!this.isSupported()) return [];
    try {
      const nav = navigator as unknown as { bluetooth: { getDevices(): Promise<BluetoothDeviceLike[]> } };
      const devs = await nav.bluetooth.getDevices();
      const seen = new Set<string>();
      for (const d of devs) {
        const dev = bleToDiscovered(d);
        seen.add(dev.id);
        this._rawByDeviceId.set(dev.id, d);
        const prev = this._devices.get(dev.id);
        this._devices.set(dev.id, dev);
        this._emit({ type: prev ? 'updated' : 'discovered', device: dev });
        this._attachGattWatcher(d, dev.id);
      }
      for (const [id, dev] of this._devices) {
        if (!seen.has(id)) {
          this._detachGattWatcher(id);
          this._devices.delete(id);
          this._rawByDeviceId.delete(id);
          this._emit({ type: 'lost', device: { ...dev, online: false } });
        }
      }
      return this.getDevices();
    } catch (e) {
      logger.warn('[WebBleDiscoverer] scan failed', e);
      return this.getDevices();
    }
  }

  watch(listener: (ev: DiscoveryEvent) => void): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  getDevices(): DiscoveredDevice[] {
    return Array.from(this._devices.values());
  }

  private _attachGattWatcher(d: BluetoothDeviceLike, id: string): void {
    if (this._gattHandlers.has(id) || typeof d.addEventListener !== 'function') return;
    const handler = () => {
      const prev = this._devices.get(id);
      if (prev) {
        const updated = { ...prev, online: false, lastSeen: Date.now() };
        this._devices.set(id, updated);
        this._emit({ type: 'updated', device: updated });
      }
    };
    try {
      d.addEventListener('gattserverdisconnected', handler);
      this._gattHandlers.set(id, handler);
    } catch { /* ignore */ }
  }

  private _detachGattWatcher(id: string): void {
    const handler = this._gattHandlers.get(id);
    if (!handler) return;
    const raw = this._rawByDeviceId.get(id);
    try {
      raw?.removeEventListener?.('gattserverdisconnected', handler);
    } catch { /* ignore */ }
    this._gattHandlers.delete(id);
  }

  private _emit(ev: DiscoveryEvent): void {
    for (const fn of this._listeners) {
      try { fn(ev); } catch (e) { logger.warn('[WebBleDiscoverer] listener err', e); }
    }
  }
}

export const webBleDiscoverer = new WebBleDiscoverer();
