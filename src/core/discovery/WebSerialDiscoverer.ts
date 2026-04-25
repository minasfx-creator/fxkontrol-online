/**
 * ─── WebSerial Discoverer ──────────────────────────────────────────
 * Real Web Serial enumeration:
 *  - `navigator.serial.getPorts()` → ports already authorized for this
 *    origin (no prompt needed). Survives reload.
 *  - `navigator.serial.addEventListener('connect'|'disconnect')` →
 *    real hot-plug detection.
 *  - VID/PID is matched against `DEVICE_PROFILES` so every authorized
 *    port is classified into a known family (or `generic`).
 *
 * No frame is sent here — discovery only opens metadata.
 */

import { DEVICE_PROFILES, isWebSerialSupported } from '@/lib/usbEngine';
import { logger } from '@/lib/logger';
import { portRegistry, keyFor } from './portRegistry';
import type { DiscoveredDevice, DiscoveryEvent, TransportDiscoverer } from './types';

interface SerialPortInfo { usbVendorId?: number; usbProductId?: number }
interface SerialPortLike {
  getInfo(): SerialPortInfo;
}
interface SerialEvt { port?: SerialPortLike; target?: unknown }

const KNOWN_CHIP_FAMILIES: Record<string, string> = {
  '0403:6001': 'ftdi-ft232',
  '0403:6010': 'ftdi-ft2232',
  '0403:6011': 'ftdi-ft4232',
  '0403:6014': 'ftdi-ft232h',
  '0403:6015': 'ftdi-ft-x',
  '1a86:7523': 'wch-ch340',
  '1a86:5523': 'wch-ch341',
  '10c4:ea60': 'silabs-cp210x',
  '067b:2303': 'prolific-pl2303',
  '04d8:000a': 'microchip-mcp2200',
};

function chipFamily(vid?: number, pid?: number): string | undefined {
  if (vid == null || pid == null) return undefined;
  const k = `${vid.toString(16).padStart(4, '0')}:${pid.toString(16).padStart(4, '0')}`;
  return KNOWN_CHIP_FAMILIES[k];
}

function profileFor(vid?: number, pid?: number) {
  if (vid == null) return undefined;
  return DEVICE_PROFILES.find(p =>
    p.vendorId === vid && (p.productId == null || p.productId === pid),
  );
}

function portToDevice(port: SerialPortLike): DiscoveredDevice {
  const info = port.getInfo();
  const vid = info.usbVendorId;
  const pid = info.usbProductId;
  const profile = profileFor(vid, pid);
  const chip = chipFamily(vid, pid);
  const key = keyFor({ vendorId: vid, productId: pid });
  const persisted = portRegistry.get(key);
  const label = profile?.label
    ?? persisted?.lastLabel
    ?? (chip ? `Serial (${chip.toUpperCase()})` : 'Porta serial USB');

  // Port is in `getPorts()` ⇒ already authorized. Persist so silent
  // re-open works on the next session even before the discoverer runs.
  portRegistry.recordSuccess({
    vendorId: vid,
    productId: pid,
    label,
    profileId: profile?.label,
  });

  return {
    id: `webserial:${key}`,
    transport: 'webserial',
    label,
    vendorId: vid,
    productId: pid,
    recognized: !!profile,
    authorized: true, // present in getPorts() ⇒ already authorized
    online: true,
    family: profile?.type ?? chip ?? 'unknown',
    lastSeen: Date.now(),
    metadata: {
      profileLabel: profile?.label,
      chip,
      operatorConfirmedGeneric: persisted?.operatorConfirmedGeneric === true,
    },
  };
}

class WebSerialDiscoverer implements TransportDiscoverer {
  readonly id = 'webserial' as const;
  private _devices = new Map<string, DiscoveredDevice>();
  private _portByDeviceId = new Map<string, SerialPortLike>();
  private _listeners = new Set<(ev: DiscoveryEvent) => void>();
  private _attached = false;

  isSupported(): boolean { return isWebSerialSupported(); }

  /** Underlying SerialPort for a discovered device — needed to open it. */
  getPortFor(deviceId: string): SerialPortLike | undefined {
    return this._portByDeviceId.get(deviceId);
  }

  async scan(): Promise<DiscoveredDevice[]> {
    if (!this.isSupported()) return [];
    this._ensureHotPlug();
    try {
      const nav = navigator as unknown as { serial: { getPorts(): Promise<SerialPortLike[]> } };
      const ports = await nav.serial.getPorts();
      const seen = new Set<string>();
      for (const port of ports) {
        const dev = portToDevice(port);
        seen.add(dev.id);
        this._portByDeviceId.set(dev.id, port);
        const prev = this._devices.get(dev.id);
        this._devices.set(dev.id, dev);
        this._emit({ type: prev ? 'updated' : 'discovered', device: dev });
      }
      // Anything cached but not in the latest snapshot is gone.
      for (const [id, dev] of this._devices) {
        if (!seen.has(id)) {
          this._devices.delete(id);
          this._portByDeviceId.delete(id);
          this._emit({ type: 'lost', device: { ...dev, online: false } });
        }
      }
      return this.getDevices();
    } catch (e) {
      logger.warn('[WebSerialDiscoverer] scan failed', e);
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
    const nav = navigator as unknown as {
      serial: EventTarget & { getPorts(): Promise<SerialPortLike[]> };
    };
    const onConnect = (ev: Event) => {
      const port = (ev as SerialEvt).port ?? ((ev.target as unknown) as SerialPortLike | undefined);
      if (!port) return;
      const dev = portToDevice(port);
      this._portByDeviceId.set(dev.id, port);
      this._devices.set(dev.id, dev);
      this._emit({ type: 'discovered', device: dev });
      logger.info('[WebSerialDiscoverer] hot-plug connect', dev.id);
    };
    const onDisconnect = (ev: Event) => {
      const port = (ev as SerialEvt).port ?? ((ev.target as unknown) as SerialPortLike | undefined);
      if (!port) return;
      const info = port.getInfo();
      const id = `webserial:${keyFor({ vendorId: info.usbVendorId, productId: info.usbProductId })}`;
      const dev = this._devices.get(id);
      if (dev) {
        this._devices.delete(id);
        this._portByDeviceId.delete(id);
        this._emit({ type: 'lost', device: { ...dev, online: false } });
        logger.info('[WebSerialDiscoverer] hot-plug disconnect', id);
      }
    };
    try {
      nav.serial.addEventListener('connect', onConnect);
      nav.serial.addEventListener('disconnect', onDisconnect);
      this._attached = true;
    } catch (e) {
      logger.warn('[WebSerialDiscoverer] hot-plug attach failed', e);
    }
  }

  private _emit(ev: DiscoveryEvent): void {
    for (const fn of this._listeners) {
      try { fn(ev); } catch (e) { logger.warn('[WebSerialDiscoverer] listener err', e); }
    }
  }
}

export const webSerialDiscoverer = new WebSerialDiscoverer();
