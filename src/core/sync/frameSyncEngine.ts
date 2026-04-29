/**
 * ─── Frame Sync Engine ──────────────────────────────────────────────
 * Aligns the global clock to frame boundaries with smooth correction.
 * Bridges timecode provider → lockstep pipeline.
 *
 * All downstream systems receive frame-locked time:
 *   localTime → globalSync → frameSyncEngine → lockstep
 *
 * Correction is always gradual (lerp) — never jumps.
 */

import { timecodeProvider } from '@/core/time/timecodeProvider';
import { frameTimeService } from '@/core/time/frameTimeService';

export type FrameSyncStatus = 'locked' | 'drifting' | 'freerun';

export interface FrameSyncState {
  fps: number;
  currentFrame: number;
  driftMs: number;
  correctionMs: number;
  status: FrameSyncStatus;
  source: string;
  latencyMs: number;
}

const DRIFT_WARN_MS = 5;
const DRIFT_LOCK_MS = 2;
const CORRECTION_ALPHA = 0.2;   // smooth correction factor
const MAX_CORRECTION_MS = 50;   // never correct more than 50ms per tick

// ── Fatia 8 #5 — drift clamp guards ──────────────────────────────────
// Bound the *raw* error before it enters the lerp accumulator, otherwise a
// single ~1s glitch of the timecode source poisons the integrator for minutes.
const MAX_RAW_DRIFT_MS = 200;
// Bound the running accumulator so multi-hour shows cannot drift the snap
// math beyond what `Math.round` can represent precisely (~5s budget).
const MAX_ACCUMULATED_CORRECTION_MS = 5_000;

class FrameSyncEngine {
  private _accumulatedCorrection = 0;
  private _driftMs = 0;
  private _latencyMs = 0;
  private _status: FrameSyncStatus = 'freerun';
  private _listeners: Array<(state: FrameSyncState) => void> = [];

  /**
   * Core method: takes a time value (already global-sync corrected)
   * and aligns it to the frame grid with smooth drift correction.
   *
   * @param globalTimeMs - time in milliseconds (from multiSiteSync or globalClock)
   * @returns frame-aligned time in milliseconds
   */
  getSyncedTime(globalTimeMs: number): number {
    const frameTimeMs = timecodeProvider.getFrameAlignedTime();
    const rawError = frameTimeMs - globalTimeMs;

    // #5 Clamp the raw error first — a glitchy LTC pulse cannot poison the
    // integrator beyond MAX_RAW_DRIFT_MS in a single tick.
    const error = rawError > MAX_RAW_DRIFT_MS
      ? MAX_RAW_DRIFT_MS
      : rawError < -MAX_RAW_DRIFT_MS
        ? -MAX_RAW_DRIFT_MS
        : rawError;

    this._driftMs = error;

    // Determine status (uses the raw error so the UI still reflects glitches)
    if (Math.abs(rawError) <= DRIFT_LOCK_MS) {
      this._status = 'locked';
    } else if (Math.abs(rawError) <= DRIFT_WARN_MS) {
      this._status = 'locked';
    } else {
      this._status = timecodeProvider.isLocked() ? 'drifting' : 'freerun';
    }

    // Apply smooth correction (never jump) — clamped per tick.
    let correction = error * CORRECTION_ALPHA;
    correction = Math.max(-MAX_CORRECTION_MS, Math.min(MAX_CORRECTION_MS, correction));
    this._accumulatedCorrection += correction;

    // #5 Hard ceiling on the accumulator (multi-hour show safety).
    if (this._accumulatedCorrection > MAX_ACCUMULATED_CORRECTION_MS) {
      this._accumulatedCorrection = MAX_ACCUMULATED_CORRECTION_MS;
    } else if (this._accumulatedCorrection < -MAX_ACCUMULATED_CORRECTION_MS) {
      this._accumulatedCorrection = -MAX_ACCUMULATED_CORRECTION_MS;
    }

    const corrected = globalTimeMs + this._accumulatedCorrection;

    // Snap to frame boundary
    const fd = timecodeProvider.getFrameDuration();
    return Math.round(corrected / fd) * fd;
  }

  /**
   * Convenience: takes time in seconds (timeline format),
   * returns frame-synced time in seconds.
   */
  getSyncedTimeSec(globalTimeSec: number): number {
    return this.getSyncedTime(globalTimeSec * 1000) / 1000;
  }

  /**
   * Set network latency for offset calculations.
   */
  setLatency(ms: number): void {
    this._latencyMs = ms;
  }

  /**
   * Get the frame-locked fire time for a cue, accounting for
   * network latency, hardware delay, and frame alignment.
   *
   * @param cueTimeSec - original cue time in seconds
   * @param networkLatencyMs - one-way network latency
   * @param hardwareDelayMs - hardware-specific delay
   * @returns adjusted time in seconds, snapped to frame boundary
   */
  getFrameLockedFireTime(
    cueTimeSec: number,
    networkLatencyMs: number,
    hardwareDelayMs: number
  ): number {
    const cueMs = cueTimeSec * 1000;
    const totalOffsetMs = networkLatencyMs + hardwareDelayMs;
    const adjustedMs = cueMs - totalOffsetMs;
    const fd = timecodeProvider.getFrameDuration();
    const frameAligned = Math.round(adjustedMs / fd) * fd;
    return Math.max(0, frameAligned) / 1000;
  }

  /**
   * Get current state for Mission Control display.
   */
  getState(): FrameSyncState {
    const tcState = timecodeProvider.getState();
    return {
      fps: tcState.fps,
      currentFrame: tcState.frame,
      driftMs: this._driftMs,
      correctionMs: this._accumulatedCorrection,
      status: this._status,
      source: tcState.source.toUpperCase(),
      latencyMs: this._latencyMs,
    };
  }

  getDriftMs(): number {
    return this._driftMs;
  }

  getStatus(): FrameSyncStatus {
    return this._status;
  }

  /** Reset accumulated corrections (use on timeline seek) */
  reset(): void {
    this._accumulatedCorrection = 0;
    this._driftMs = 0;
    this._status = 'freerun';
  }

  // ── Subscriptions ─────────────────────────────────────────────

  onStateChange(cb: (state: FrameSyncState) => void): () => void {
    this._listeners.push(cb);
    return () => {
      this._listeners = this._listeners.filter(l => l !== cb);
    };
  }
}

export const frameSyncEngine = new FrameSyncEngine();
