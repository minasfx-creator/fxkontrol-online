/**
 * ─── Hardware Registry — Device Discovery & Status ──────────────────
 * Central registry of legacy hardware devices (firing modules, mux
 * readers, DMX interfaces, timecode readers, power monitors).
 *
 * Honest connection state machine + lastSeen expiration.
 * NOTE: For unified adapter-based hardware, prefer UnifiedHardwareRegistry.
 */

import { blackbox } from '@/core/reliability/blackBoxRecorder';

export type HardwareDeviceType =
  | 'firing-module'     // Arduino Nano + 74HC595 + relay board
  | 'mux-reader'        // CD4051 continuity reader
  | 'dmx-interface'     // USB-DMX (ENTTEC etc.)
  | 'timecode-reader'   // LTC/SMPTE reader
  | 'power-monitor';    // Battery/voltage monitor

/**
 * Honest device connection state — replaces the simplistic boolean.
 *  - unknown:      registered but never confirmed alive
 *  - connecting:   handshake in progress
 *  - connected:    healthy, recent activity
 *  - degraded:     connected but heartbeat stale or partial errors
 *  - reconnecting: attempting recovery
 *  - disconnected: explicitly disconnected
 *  - failed:       gave up; manual recovery required
 */
export type DeviceConnectionState =
  | 'unknown'
  | 'connecting'
  | 'connected'
  | 'degraded'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

export interface HardwareDevice {
  id: string;
  type: HardwareDeviceType;
  label: string;
  serialPort: string | null;
  /**
   * @deprecated Read `state` instead. Kept for back-compat with UI
   * checks. `connected === true` iff state ∈ { connected, degraded }.
   */
  connected: boolean;
  state: DeviceConnectionState;
  firmware: string;
  lastSeen: number;
  firstSeenAt: number;
  consecutiveFailures: number;
  metrics: Record<string, number | string>;
}

/** Default heartbeat tolerance — devices stale beyond this are auto-degraded. */
const DEFAULT_STALE_TIMEOUT_MS = 5_000;
/** After this much staleness, device is moved to disconnected. */
const DEFAULT_DEAD_TIMEOUT_MS = 15_000;

class HardwareRegistry {
  private _devices = new Map<string, HardwareDevice>();
  private _listeners = new Set<() => void>();
  private _staleTimerId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this._startStaleMonitor();
  }

  /** Register or update a device. Always creates a new object — never mutates. */
  register(device: Omit<HardwareDevice, 'state' | 'firstSeenAt' | 'consecutiveFailures'> & {
    state?: DeviceConnectionState;
  }): void {
    const existing = this._devices.get(device.id);
    const now = Date.now();
    const state: DeviceConnectionState = device.state
      ?? (device.connected ? 'connected' : 'disconnected');

    const next: HardwareDevice = {
      ...device,
      state,
      connected: state === 'connected' || state === 'degraded',
      lastSeen: now,
      firstSeenAt: existing?.firstSeenAt ?? now,
      consecutiveFailures: existing?.consecutiveFailures ?? 0,
    };

    this._devices.set(device.id, next);

    if (!existing) {
      blackbox.record('hw',
        `HardwareRegistry: registered ${device.type} "${device.label}" (${device.serialPort ?? 'no port'}) state=${state}`);
    } else if (existing.state !== state) {
      blackbox.record('hw',
        `HardwareRegistry: ${device.label} state ${existing.state} -> ${state}`);
    }
    this._notify();
  }

  /** Update only the state of an existing device, preserving other fields. */
  setState(id: string, state: DeviceConnectionState): void {
    const dev = this._devices.get(id);
    if (!dev || dev.state === state) return;
    const now = Date.now();
    const next: HardwareDevice = {
      ...dev,
      state,
      connected: state === 'connected' || state === 'degraded',
      lastSeen: state === 'connected' || state === 'degraded' ? now : dev.lastSeen,
      consecutiveFailures: state === 'connected' ? 0 : dev.consecutiveFailures,
    };
    this._devices.set(id, next);
    blackbox.record('hw', `HardwareRegistry: ${dev.label} state ${dev.state} -> ${state}`);
    this._notify();
  }

  /** Record an activity ping — refreshes lastSeen and recovers from degraded. */
  touch(id: string): void {
    const dev = this._devices.get(id);
    if (!dev) return;
    const next: HardwareDevice = {
      ...dev,
      lastSeen: Date.now(),
      // auto-recover from degraded only — never from disconnected/failed (requires explicit reconnect)
      state: dev.state === 'degraded' ? 'connected' : dev.state,
      connected: dev.state === 'degraded' ? true : dev.connected,
      consecutiveFailures: 0,
    };
    this._devices.set(id, next);
    if (dev.state === 'degraded') {
      blackbox.record('hw', `HardwareRegistry: ${dev.label} recovered (degraded -> connected)`);
      this._notify();
    }
  }

  /** Mark a device as disconnected. Always creates new object. */
  disconnect(id: string): void {
    const dev = this._devices.get(id);
    if (!dev) return;
    if (dev.state === 'disconnected') return;
    const next: HardwareDevice = {
      ...dev,
      state: 'disconnected',
      connected: false,
    };
    this._devices.set(id, next);
    blackbox.record('hw', `HardwareRegistry: ${dev.label} DISCONNECTED`);
    this._notify();
  }

  /** Increment failure counter; transitions to failed after threshold. */
  reportFailure(id: string, threshold = 3): void {
    const dev = this._devices.get(id);
    if (!dev) return;
    const failures = dev.consecutiveFailures + 1;
    const next: HardwareDevice = {
      ...dev,
      consecutiveFailures: failures,
      state: failures >= threshold ? 'failed' : 'degraded',
      connected: failures < threshold,
    };
    this._devices.set(id, next);
    blackbox.record('hw',
      `HardwareRegistry: ${dev.label} failure ${failures}/${threshold} (state=${next.state})`);
    this._notify();
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

  getAll(): HardwareDevice[] { return Array.from(this._devices.values()); }
  getById(id: string): HardwareDevice | undefined { return this._devices.get(id); }
  getByType(type: HardwareDeviceType): HardwareDevice[] {
    return this.getAll().filter(d => d.type === type);
  }
  getConnectedCount(): number {
    return this.getAll().filter(d => d.state === 'connected' || d.state === 'degraded').length;
  }
  hasFiringModule(): boolean {
    return this.getByType('firing-module').some(d => d.state === 'connected');
  }

  /** Subscribe to registry changes. Listener exceptions are isolated. */
  onChange(fn: () => void): () => void {
    this._listeners.add(fn);
    return () => { this._listeners.delete(fn); };
  }

  /** Stop the stale monitor — call only on full teardown (test cleanup). */
  dispose(): void {
    if (this._staleTimerId !== null) {
      clearInterval(this._staleTimerId);
      this._staleTimerId = null;
    }
  }

  private _notify(): void {
    for (const fn of this._listeners) {
      try { fn(); } catch { /* listener safety: never let one kill the rest */ }
    }
  }

  /** Periodic sweep: connected -> degraded -> disconnected based on lastSeen. */
  private _startStaleMonitor(): void {
    if (typeof setInterval === 'undefined') return; // SSR guard
    this._staleTimerId = setInterval(() => this._sweepStale(), 1_000);
  }

  private _sweepStale(): void {
    const now = Date.now();
    let changed = false;
    for (const [id, dev] of this._devices) {
      if (dev.state !== 'connected' && dev.state !== 'degraded') continue;
      const stale = now - dev.lastSeen;
      if (stale > DEFAULT_DEAD_TIMEOUT_MS) {
        this._devices.set(id, { ...dev, state: 'disconnected', connected: false });
        blackbox.record('hw', `HardwareRegistry: ${dev.label} timed out (stale=${stale}ms)`);
        changed = true;
      } else if (stale > DEFAULT_STALE_TIMEOUT_MS && dev.state === 'connected') {
        this._devices.set(id, { ...dev, state: 'degraded', connected: true });
        blackbox.record('hw', `HardwareRegistry: ${dev.label} degraded (stale=${stale}ms)`);
        changed = true;
      }
    }
    if (changed) this._notify();
  }
}

export const hardwareRegistry = new HardwareRegistry();
