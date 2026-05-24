/**
 * ─── Device Discovery — Simulated Enumeration ──────────────────────
 * Enumerates available hardware adapters with scan simulation.
 * Provides discovery status per device for UI "Scanning..." states.
 */

import { unifiedHardwareRegistry } from './UnifiedHardwareRegistry';
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

class DeviceDiscovery {
  private _results = new Map<string, DiscoveryResult>();
  private _isScanning = false;
  private _listeners = new Set<() => void>();

  get isScanning(): boolean { return this._isScanning; }

  getResults(): DiscoveryResult[] {
    return Array.from(this._results.values());
  }

  /** Run simulated scan — resolves after staggered "discovery" */
  async scan(): Promise<DiscoveryResult[]> {
    if (this._isScanning) return this.getResults();
    this._isScanning = true;
    this._notify();

    const adapters = unifiedHardwareRegistry.getAllAdapters();

    // Mark all as scanning
    for (const a of adapters) {
      this._results.set(a.deviceId, {
        deviceId: a.deviceId, deviceType: a.deviceType, label: a.label,
        status: 'scanning', discoveredAt: null, scanDuration_ms: 0,
      });
    }
    this._notify();

    // Stagger discovery (simulate bus enumeration)
    for (const a of adapters) {
      const delay = 200 + Math.random() * 800;
      await new Promise(r => setTimeout(r, delay));

      const conn = a.getConnectionState();
      const found = conn !== 'disconnected';
      this._results.set(a.deviceId, {
        deviceId: a.deviceId, deviceType: a.deviceType, label: a.label,
        status: found ? 'found' : 'not_found',
        discoveredAt: found ? Date.now() : null,
        scanDuration_ms: Math.round(delay),
      });
      this._notify();
    }

    this._isScanning = false;
    this._notify();
    return this.getResults();
  }

  onChange(fn: () => void): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  private _notify(): void { for (const fn of this._listeners) fn(); }
}

export const deviceDiscovery = new DeviceDiscovery();
