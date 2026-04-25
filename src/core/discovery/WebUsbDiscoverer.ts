/**
 * ─── WebUSB Discoverer ─────────────────────────────────────────────
 * Enumerates USB devices granted via WebUSB (`navigator.usb.getDevices()`)
 * for raw bulk endpoints (e.g. ENTTEC DMX USB Pro Mk2 in vendor mode,
 * custom firing controllers without CDC-ACM).
 *
 * Hot-plug via `navigator.usb` `connect`/`disconnect` events.
 * Read-only: never sends data.
 */

import { logger } from '@/lib/logger';
import type { DiscoveredDevice, DiscoveryEvent, TransportDiscoverer } from './types';
import { keyFor, portRegistry } from './portRegistry';

interface USBDeviceLike {
  vendorId: number;
  productId: number;
  serialNumber?: string;
  productName?: string;
  manufacturerName?: string;
}
interface USBConnectionEvent extends Event { device: USBDeviceLike }

const KNOWN_USB_FAMILIES: Record<string, { label: string; family: string }> = {
  '0403:6001': { label: 'FTDI FT232 (USB)', family: 'ftdi' },
  '0403:6014': { label: 'FTDI FT232H (USB)', family: 'ftdi' },
  '0403:6015': { label: 'FTDI FT-X (USB)', family: 'ftdi' },
  '1a86:7523': { label: 'WCH CH340 (USB)', family: 'wch' },
  '10c4:ea60': { label: 'Silicon Labs CP210x (USB)', family: 'silabs' },
};

function isWebUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

function deviceToDiscovered(d: USBDeviceLike): DiscoveredDevice {
  const k = `${d.vendorId.toString(16).padStart(4, '0')}:${d.productId.toString(16).padStart(4, '0')}`;
  const known = KNOWN_USB_FAMILIES[k];
  const id = `webusb:${keyFor({ vendorId: d.vendorId, productId: d.productId })}${d.serialNumber ? ':' + d.serialNumber : ''}`;
  const persisted = portRegistry.get(keyFor({ vendorId: d.vendorId, productId: d.productId }));
  const label = d.productName?.trim()
    || known?.label
    || persisted?.lastLabel
    || `USB ${k}`;

  // The mere presence in `navigator.usb.getDevices()` means the user has
  // already authorized this device for our origin. Persist it so the next
  // session can immediately recognize it without prompting again.
  portRegistry.recordSuccess({
    vendorId: d.vendorId,
    productId: d.productId,
    label,
  });

  return {
    id,
    transport: 'webusb',
    label,
    vendorId: d.vendorId,
    productId: d.productId,
    recognized: !!known,
    authorized: true,
    online: true,
    family: known?.family ?? 'unknown',
    lastSeen: Date.now(),
    metadata: {
      manufacturer: d.manufacturerName,
      serialNumber: d.serialNumber,
      operatorConfirmedGeneric: persisted?.operatorConfirmedGeneric === true,
    },
  };
}

class WebUsbDiscoverer implements TransportDiscoverer {
  readonly id = 'webusb' as const;
  private _devices = new Map<string, DiscoveredDevice>();
  private _listeners = new Set<(ev: DiscoveryEvent) => void>();
  private _attached = false;

  isSupported(): boolean { return isWebUsbSupported(); }

  async scan(): Promise<DiscoveredDevice[]> {
    if (!this.isSupported()) return [];
    this._ensureHotPlug();
    try {
      const nav = navigator as unknown as { usb: { getDevices(): Promise<USBDeviceLike[]> } };
      const devs = await nav.usb.getDevices();
      const seen = new Set<string>();
      for (const d of devs) {
        const dev = deviceToDiscovered(d);
        seen.add(dev.id);
        const prev = this._devices.get(dev.id);
        this._devices.set(dev.id, dev);
        this._emit({ type: prev ? 'updated' : 'discovered', device: dev });
      }
      for (const [id, dev] of this._devices) {
        if (!seen.has(id)) {
          this._devices.delete(id);
          this._emit({ type: 'lost', device: { ...dev, online: false } });
        }
      }
      return this.getDevices();
    } catch (e) {
      logger.warn('[WebUsbDiscoverer] scan failed', e);
      return this.getDevices();
    }
  }

  watch(listener: (ev: DiscoveryEvent) => void): () => void {
    this._listeners.add(listener);
    this._ensureHotPlug();
    return () => { this._listeners.delete(listener); };
  }

  getDevices(): DiscoveredDevice[] {
    return Array.from(this._devices.values());
  }

  private _ensureHotPlug(): void {
    if (this._attached || !this.isSupported()) return;
    const nav = navigator as unknown as { usb: EventTarget };
    const onConnect = (ev: Event) => {
      const d = (ev as USBConnectionEvent).device;
      if (!d) return;
      const dev = deviceToDiscovered(d);
      this._devices.set(dev.id, dev);
      this._emit({ type: 'discovered', device: dev });
    };
    const onDisconnect = (ev: Event) => {
      const d = (ev as USBConnectionEvent).device;
      if (!d) return;
      const id = `webusb:${keyFor({ vendorId: d.vendorId, productId: d.productId })}${d.serialNumber ? ':' + d.serialNumber : ''}`;
      const dev = this._devices.get(id);
      if (dev) {
        this._devices.delete(id);
        this._emit({ type: 'lost', device: { ...dev, online: false } });
      }
    };
    try {
      nav.usb.addEventListener('connect', onConnect);
      nav.usb.addEventListener('disconnect', onDisconnect);
      this._attached = true;
    } catch (e) {
      logger.warn('[WebUsbDiscoverer] hot-plug attach failed', e);
    }
  }

  private _emit(ev: DiscoveryEvent): void {
    for (const fn of this._listeners) {
      try { fn(ev); } catch (e) { logger.warn('[WebUsbDiscoverer] listener err', e); }
    }
  }
}

export const webUsbDiscoverer = new WebUsbDiscoverer();
