/**
 * ─── Telemetry Poller — Adaptive Frequency ─────────────────────────
 * Centralized polling orchestrator. 500ms during active diagnostics,
 * 5s backoff when healthy. Records health snapshots each cycle.
 */

import { unifiedHardwareRegistry } from './UnifiedHardwareRegistry';
import { deviceEventLog } from './DeviceEventLog';

export type PollerMode = 'active' | 'idle';

class TelemetryPoller {
  private _interval: ReturnType<typeof setInterval> | null = null;
  private _mode: PollerMode = 'idle';
  private _listeners = new Set<(mode: PollerMode) => void>();
  private _cycleCount = 0;

  get mode(): PollerMode { return this._mode; }
  get isRunning(): boolean { return this._interval !== null; }
  get cycleCount(): number { return this._cycleCount; }
  get frequencyMs(): number { return this._mode === 'active' ? 500 : 5000; }

  start(): void {
    this.stop();
    this._schedule();
  }

  stop(): void {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  setMode(mode: PollerMode): void {
    if (mode === this._mode) return;
    this._mode = mode;
    for (const fn of this._listeners) fn(mode);
    // Reschedule at new frequency
    if (this._interval) {
      this.stop();
      this._schedule();
    }
  }

  onChange(fn: (mode: PollerMode) => void): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  private _schedule(): void {
    this._interval = setInterval(() => this._tick(), this.frequencyMs);
  }

  private _tick(): void {
    this._cycleCount++;
    unifiedHardwareRegistry.pollAll();

    // Record health snapshot for each device
    const snapshots = unifiedHardwareRegistry.getSnapshots();
    for (const snap of snapshots) {
      const score = snap.online ? Math.max(0, 100 - snap.errors.length * 20 - snap.warnings.length * 10) : 0;
      deviceEventLog.recordHealth(snap.device_id, score, snap.warnings.length, snap.errors.length);
    }

    // Auto-switch to active if errors detected
    const health = unifiedHardwareRegistry.getSystemHealth();
    if (health.errors > 0 && this._mode === 'idle') {
      this.setMode('active');
    } else if (health.errors === 0 && health.score > 80 && this._mode === 'active') {
      this.setMode('idle');
    }
  }
}

export const telemetryPoller = new TelemetryPoller();
