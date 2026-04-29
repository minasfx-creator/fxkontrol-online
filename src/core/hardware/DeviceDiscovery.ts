/**
 * ─── Device Discovery — Real Hardware Facade ───────────────────────
 * Backwards-compatible facade over `unifiedDiscovery` so existing UI
 * (HardwareOverview) continues to work, while the actual scan now
 * enumerates real authorized ports + USB + BLE + Art-Net nodes.
 */

import { unifiedDiscovery } from '@/core/discovery/UnifiedDiscoveryService';
import type { HardwareDeviceCategory } from './types';

export type DiscoveryStatus = 'idle' | 'scanning' | 'found' | 'not_found' | 'timeout';

export interface DiscoveryResult {
  deviceId: string;
  deviceType: HardwareDeviceCategory;
  label: string;
  status: DiscoveryStatus;
  discoveredAt: number | null;
  scanDuration_ms: number;
}

const TRANSPORT_TO_CATEGORY: Record<string, HardwareDeviceCategory> = {
  webserial: 'controller',
  webusb: 'controller',
  webble: 'controller',
  'mdns-artnet': 'artnet-node',
};

class DeviceDiscovery {
  private _isScanning = false;
  private _listeners = new Set<() => void>();
  private _lastScanStart = 0;

  get isScanning(): boolean { return this._isScanning; }

  getResults(): DiscoveryResult[] {
    const devices = unifiedDiscovery.getDevices();
    return devices.map(d => ({
      deviceId: d.id,
      deviceType: TRANSPORT_TO_CATEGORY[d.transport] ?? 'controller',
      label: d.label,
      status: d.online ? 'found' : 'not_found',
      discoveredAt: d.online ? d.lastSeen : null,
      scanDuration_ms: this._lastScanStart > 0 ? Math.max(0, Date.now() - this._lastScanStart) : 0,
    }));
  }

  /** Real scan — light by default. Pass `{ deep: true }` for Art-Net poll. */
  async scan(opts?: { deep?: boolean }): Promise<DiscoveryResult[]> {
    if (this._isScanning) return this.getResults();
    this._isScanning = true;
    this._lastScanStart = Date.now();
    this._notify();
    try {
      if (opts?.deep) {
        await unifiedDiscovery.scanDeep();
      } else {
        await unifiedDiscovery.scanLight();
      }
      this._notify();
      return this.getResults();
    } finally {
      this._isScanning = false;
      this._notify();
    }
  }

  onChange(fn: () => void): () => void {
    this._listeners.add(fn);
    // Bridge unified discovery events into legacy listeners.
    const off = unifiedDiscovery.watch(() => this._notify());
    return () => {
      this._listeners.delete(fn);
      off();
    };
  }

  private _notify(): void { for (const fn of this._listeners) fn(); }
}

export const deviceDiscovery = new DeviceDiscovery();
