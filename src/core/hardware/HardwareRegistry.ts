/**
 * ─── Hardware Registry — Device Discovery & Status ──────────────────
 * Central registry of all connected hardware devices.
 * Tracks connection state, serial ports, and firmware versions.
 */

import { blackbox } from '@/core/reliability/blackBoxRecorder';

export type HardwareDeviceType =
  | 'firing-module'     // Arduino Nano + 74HC595 + relay board
  | 'mux-reader'        // CD4051 continuity reader
  | 'dmx-interface'     // USB-DMX (ENTTEC etc.)
  | 'timecode-reader'   // LTC/SMPTE reader
  | 'power-monitor';    // Battery/voltage monitor

export interface HardwareDevice {
  id: string;
  type: HardwareDeviceType;
  label: string;
  serialPort: string | null;
  connected: boolean;
  firmware: string;
  lastSeen: number;
  metrics: Record<string, number | string>;
}

class HardwareRegistry {
  private _devices = new Map<string, HardwareDevice>();
  private _listeners = new Set<() => void>();

  /** Register or update a device. */
  register(device: HardwareDevice): void {
    const existing = this._devices.get(device.id);
    this._devices.set(device.id, { ...device, lastSeen: Date.now() });

    if (!existing) {
      blackbox.record('hw', `HardwareRegistry: registered ${device.type} "${device.label}" (${device.serialPort ?? 'no port'})`);
    }
    this._notify();
  }

  /** Mark a device as disconnected. */
  disconnect(id: string): void {
    const dev = this._devices.get(id);
    if (dev) {
      dev.connected = false;
      blackbox.record('hw', `HardwareRegistry: ${dev.label} DISCONNECTED`);
      this._notify();
    }
  }

  /** Remove a device entirely. */
  unregister(id: string): void {
    const dev = this._devices.get(id);
    if (dev) {
      this._devices.delete(id);
      blackbox.record('hw', `HardwareRegistry: ${dev.label} unregistered`);
      this._notify();
    }
  }

  /** Get all registered devices. */
  getAll(): HardwareDevice[] {
    return Array.from(this._devices.values());
  }

  /** Get devices by type. */
  getByType(type: HardwareDeviceType): HardwareDevice[] {
    return this.getAll().filter(d => d.type === type);
  }

  /** Get connected device count. */
  getConnectedCount(): number {
    return this.getAll().filter(d => d.connected).length;
  }

  /** Check if any firing module is connected. */
  hasFiringModule(): boolean {
    return this.getByType('firing-module').some(d => d.connected);
  }

  /** Subscribe to registry changes. */
  onChange(fn: () => void): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  private _notify(): void {
    for (const fn of this._listeners) fn();
  }
}

export const hardwareRegistry = new HardwareRegistry();
