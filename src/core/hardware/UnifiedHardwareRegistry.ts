/**
 * ─── Unified Hardware Registry v2 ──────────────────────────────────
 * Central registry managing all hardware adapters.
 * Provides unified device discovery, telemetry polling, and health monitoring.
 * STRICTLY read-only — no control commands cross this boundary.
 */

import type { HardwareAdapter, HardwareDevice, HardwareStatusSnapshot, DeviceEvent } from './types';
import type { ProvenanceInfo } from './provenance';
import { isProvenanceVerified } from './provenance';
import { isHardwareSimulatorEnabled, isRealOnlyMode } from '@/lib/featureFlags';
import { realOnlyGate } from './realOnlyGate';
import { arduinoNanoAdapter } from './adapters/ArduinoNanoAdapter';
import { shiftRegisterAdapter } from './adapters/ShiftRegisterAdapter74HC595';
import { muxReaderAdapter } from './adapters/MuxReaderAdapterCD4051';
import { relayBankAdapter } from './adapters/RelayBankAdapter32';
import { fxk16ModuleAdapter } from './adapters/FXK16ModuleAdapter';
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
    this.registerAdapter(fxk16ModuleAdapter);
    this.registerAdapter(batteryMonitorAdapter);
    this.registerAdapter(artNetNodeAdapter);
    this.registerAdapter(fireOneProfileAdapter);
    this.registerAdapter(dmxUniverseAdapter);

    // Wire the real-only gate so it can resolve provenance for events.
    realOnlyGate.registerProvenanceLookup((id) => this._adapters.get(id)?.getProvenance());

    // ── Honesty banner ─────────────────────────────────────────
    if (typeof console !== 'undefined') {
      const total = this._adapters.size;
      const realOnly = isRealOnlyMode();
      console.info(
        `%c[FXK Hardware] ${total} adapter(s) registered as NOT_INTEGRATED.\n` +
        `Hardware simulator: OFF (dev_hardware_simulator flag).\n` +
        `Real-only mode: ${realOnly ? 'ON' : 'OFF'} (real_only_mode flag).\n` +
        `Pure real-hardware discovery via Web Serial / WebUSB / WebBLE / Art-Net.\n` +
        `Adapters stay frozen until they receive a real handshake reply.`,
        'color: #06b6d4; font-weight: bold;',
      );
    }
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
    return this.getAllAdapters().map(a => {
      const prov = a.getProvenance();
      return {
        id: a.deviceId,
        type: a.deviceType,
        label: a.label,
        connection_state: a.getConnectionState(),
        capabilities: a.getCapabilities(),
        lastSeen: prov.last_seen_at,
        metadata: {
          integration_mode: prov.integration_mode,
          evidence_level: prov.evidence_level,
          transport: prov.transport_type,
        },
      };
    });
  }

  /** Get provenance for a specific device */
  getProvenance(deviceId: string): ProvenanceInfo | undefined {
    return this._adapters.get(deviceId)?.getProvenance();
  }

  /** Get all provenances */
  getAllProvenances(): Map<string, ProvenanceInfo> {
    const map = new Map<string, ProvenanceInfo>();
    for (const [id, a] of this._adapters) map.set(id, a.getProvenance());
    return map;
  }

  /** Count simulated adapters */
  getSimulatedCount(): number {
    let count = 0;
    for (const a of this._adapters.values()) {
      if (a.getProvenance().integration_mode === 'simulated') count++;
    }
    return count;
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

  /**
   * Poll all adapters for telemetry.
   *
   * Honest-hardware policy: when `dev_hardware_simulator` is OFF (default),
   * we only invoke `pollTelemetry()` on adapters that are actually
   * `connected` to a real device. This means a registry tick on an empty
   * fleet is a complete no-op — zero `Math.random()` calls anywhere.
   */
  pollAll(): void {
    const simOn = isHardwareSimulatorEnabled();
    const realOnly = isRealOnlyMode();
    let touched = 0;
    for (const adapter of this._adapters.values()) {
      const connected = adapter.getConnectionState() === 'connected';
      if (!simOn && !connected) continue;
      // Real-only defense: even if connected, don't poll until the
      // adapter has marked a verified handshake (live_read_only).
      if (realOnly && !isProvenanceVerified(adapter.getProvenance())) continue;
      adapter.pollTelemetry();
      touched++;
    }
    if (touched > 0) this._notify();
  }

  /** Run diagnostics on all adapters */
  runAllDiagnostics(): Map<string, { healthy: boolean; issues: string[] }> {
    const results = new Map<string, { healthy: boolean; issues: string[] }>();
    for (const [id, adapter] of this._adapters) {
      results.set(id, adapter.runDiagnostics());
    }
    return results;
  }

  /**
   * Start automatic polling (read-only telemetry).
   *
   * Skipped entirely when the simulator gate is OFF AND no adapter is
   * `connected`. Re-evaluated lazily inside `pollAll()` so adapters that
   * become connected later still get polled without restarting the timer.
   */
  startPolling(intervalMs: number = 1000): void {
    this.stopPolling();
    const anyConnected = Array.from(this._adapters.values()).some(
      a => a.getConnectionState() === 'connected',
    );
    if (!isHardwareSimulatorEnabled() && !anyConnected) {
      // No real hardware AND simulator off → don't burn a timer.
      // Caller can re-invoke startPolling() once a device connects.
      return;
    }
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
