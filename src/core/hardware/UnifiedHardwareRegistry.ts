/**
 * ─── Unified Hardware Registry v2 ──────────────────────────────────
 * Central registry managing all hardware adapters.
 * Provides unified device discovery, telemetry polling, and health monitoring.
 * STRICTLY read-only — no control commands cross this boundary.
 */

import type { HardwareAdapter, HardwareDevice, HardwareStatusSnapshot, DeviceEvent } from './types';
import { arduinoNanoAdapter } from './adapters/ArduinoNanoAdapter';
import { shiftRegisterAdapter } from './adapters/ShiftRegisterAdapter74HC595';
import { muxReaderAdapter } from './adapters/MuxReaderAdapterCD4051';
import { relayBankAdapter } from './adapters/RelayBankAdapter32';
import { batteryMonitorAdapter } from './adapters/BatteryMonitorAdapter';
import { artNetNodeAdapter } from './adapters/ArtNetNodeAdapter';
import { fireOneProfileAdapter } from './adapters/FireOneProfileAdapter';
import { dmxUniverseAdapter } from './adapters/DMXUniverseAdapter';

class UnifiedHardwareRegistry {
  private _adapters = new Map<string, HardwareAdapter<unknown>>();
  private _eventLog: DeviceEvent[] = [];
  private _listeners = new Set<() => void>();
  private _pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Register all built-in adapters
    this.registerAdapter(arduinoNanoAdapter);
    this.registerAdapter(shiftRegisterAdapter);
    this.registerAdapter(muxReaderAdapter);
    this.registerAdapter(relayBankAdapter);
    this.registerAdapter(batteryMonitorAdapter);
    this.registerAdapter(artNetNodeAdapter);
    this.registerAdapter(fireOneProfileAdapter);
  }

  registerAdapter(adapter: HardwareAdapter<unknown>): void {
    this._adapters.set(adapter.deviceId, adapter);
    this._logEvent(adapter.deviceId, 'state_change', `Adapter registered: ${adapter.label}`);
  }

  getAdapter<T>(id: string): HardwareAdapter<T> | undefined {
    return this._adapters.get(id) as HardwareAdapter<T> | undefined;
  }

  getAllAdapters(): HardwareAdapter<unknown>[] {
    return Array.from(this._adapters.values());
  }

  /** Get unified device list for UI consumption */
  getDevices(): HardwareDevice[] {
    return this.getAllAdapters().map(a => ({
      id: a.deviceId,
      type: a.deviceType,
      label: a.label,
      connection_state: a.getConnectionState(),
      capabilities: a.getCapabilities(),
      lastSeen: Date.now(),
      metadata: {},
    }));
  }

  /** Get all snapshots */
  getSnapshots(): HardwareStatusSnapshot[] {
    return this.getAllAdapters().map(a => a.getSnapshot());
  }

  /** Get aggregated health */
  getSystemHealth(): { online: number; total: number; warnings: number; errors: number; score: number } {
    const snapshots = this.getSnapshots();
    const online = snapshots.filter(s => s.online).length;
    const total = snapshots.length;
    const warnings = snapshots.reduce((s, sn) => s + sn.warnings.length, 0);
    const errors = snapshots.reduce((s, sn) => s + sn.errors.length, 0);
    const score = total > 0 ? Math.round(((online * 100) / total) - (errors * 15) - (warnings * 5)) : 0;
    return { online, total, warnings, errors, score: Math.max(0, Math.min(100, score)) };
  }

  /** Poll all adapters for telemetry */
  pollAll(): void {
    for (const adapter of this._adapters.values()) {
      adapter.pollTelemetry();
    }
    this._notify();
  }

  /** Run diagnostics on all adapters */
  runAllDiagnostics(): Map<string, { healthy: boolean; issues: string[] }> {
    const results = new Map<string, { healthy: boolean; issues: string[] }>();
    for (const [id, adapter] of this._adapters) {
      results.set(id, adapter.runDiagnostics());
    }
    return results;
  }

  /** Start automatic polling (read-only telemetry) */
  startPolling(intervalMs: number = 1000): void {
    this.stopPolling();
    this._pollInterval = setInterval(() => this.pollAll(), intervalMs);
  }

  stopPolling(): void {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  /** Event log access */
  getEventLog(): DeviceEvent[] { return [...this._eventLog]; }
  getRecentEvents(count: number = 50): DeviceEvent[] {
    return this._eventLog.slice(-count);
  }

  /** Subscribe to changes */
  onChange(fn: () => void): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  private _logEvent(device_id: string, type: DeviceEvent['type'], message: string): void {
    this._eventLog.push({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      device_id, timestamp: Date.now(), type, message,
    });
    if (this._eventLog.length > 500) this._eventLog = this._eventLog.slice(-300);
  }

  private _notify(): void {
    for (const fn of this._listeners) fn();
  }
}

export const unifiedHardwareRegistry = new UnifiedHardwareRegistry();
