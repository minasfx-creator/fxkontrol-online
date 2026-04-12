/**
 * ─── Device Event Log — Observability ──────────────────────────────
 * Centralized event log for all hardware state changes, warnings,
 * and diagnostics. Supports filtering and history queries.
 */

import type { DeviceEvent, HealthTimelineEntry } from './types';

class DeviceEventLog {
  private _events: DeviceEvent[] = [];
  private _healthTimeline: HealthTimelineEntry[] = [];
  private _listeners = new Set<() => void>();

  log(device_id: string, type: DeviceEvent['type'], message: string, data?: Record<string, unknown>): void {
    this._events.push({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      device_id, timestamp: Date.now(), type, message, data,
    });
    if (this._events.length > 1000) this._events = this._events.slice(-500);
    this._notify();
  }

  recordHealth(device_id: string, health_score: number, warnings: number, errors: number): void {
    this._healthTimeline.push({ timestamp: Date.now(), device_id, health_score, warnings, errors });
    if (this._healthTimeline.length > 2000) this._healthTimeline = this._healthTimeline.slice(-1000);
  }

  getAll(): DeviceEvent[] { return [...this._events]; }
  getByDevice(device_id: string): DeviceEvent[] { return this._events.filter(e => e.device_id === device_id); }
  getByType(type: DeviceEvent['type']): DeviceEvent[] { return this._events.filter(e => e.type === type); }
  getRecent(count: number = 50): DeviceEvent[] { return this._events.slice(-count); }
  getHealthTimeline(device_id?: string): HealthTimelineEntry[] {
    if (device_id) return this._healthTimeline.filter(h => h.device_id === device_id);
    return [...this._healthTimeline];
  }

  clear(): void { this._events = []; this._healthTimeline = []; this._notify(); }

  onChange(fn: () => void): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  private _notify(): void { for (const fn of this._listeners) fn(); }
}

export const deviceEventLog = new DeviceEventLog();
