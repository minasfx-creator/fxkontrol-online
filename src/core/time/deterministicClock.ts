/**
 * ─── Deterministic Clock ────────────────────────────────────────────
 * High-resolution monotonic clock with continuous drift correction.
 * Syncs against external references (AudioContext / SMPTE timecode).
 * Never jumps backward. Zero-GC hot path.
 */

export type TickCallback = (time: number, delta: number) => void;

export interface ClockState {
  running: boolean;
  time: number;
  delta: number;
  drift: number;
  referenceSource: 'performance' | 'audio' | 'smpte';
}

const MAX_DELTA = 0.1;          // Cap at 100ms to avoid spiral
const DRIFT_CORRECTION = 0.01; // Smooth correction factor
const MAX_CALLBACKS = 32;

class DeterministicClock {
  private _time = 0;
  private _delta = 0;
  private _drift = 0;
  private _running = false;
  private _lastPerfTime = 0;
  private _referenceSource: ClockState['referenceSource'] = 'performance';
  private _externalRef: (() => number) | null = null;

  // Pre-allocated callback array
  private _callbacks: (TickCallback | null)[] = new Array(MAX_CALLBACKS).fill(null);
  private _callbackCount = 0;

  /** Start the clock. */
  start(): void {
    this._running = true;
    this._lastPerfTime = performance.now() / 1000;
  }

  /** Pause the clock (time freezes, no callbacks). */
  pause(): void {
    this._running = false;
  }

  /** Reset to zero. */
  reset(): void {
    this._time = 0;
    this._delta = 0;
    this._drift = 0;
    this._lastPerfTime = performance.now() / 1000;
  }

  /** Set external reference for drift correction. */
  setReference(source: ClockState['referenceSource'], refFn: () => number): void {
    this._referenceSource = source;
    this._externalRef = refFn;
  }

  /** Clear external reference (freerun on performance.now). */
  clearReference(): void {
    this._referenceSource = 'performance';
    this._externalRef = null;
  }

  /**
   * Advance the clock. Call once per frame.
   * Applies drift correction if external reference is set.
   */
  tick(): void {
    if (!this._running) return;

    const now = performance.now() / 1000;
    let rawDelta = now - this._lastPerfTime;
    this._lastPerfTime = now;

    // Cap delta to prevent spiral of death
    if (rawDelta > MAX_DELTA) rawDelta = MAX_DELTA;
    if (rawDelta < 0) rawDelta = 0; // Monotonic guard

    // Drift correction against external reference
    if (this._externalRef) {
      const externalTime = this._externalRef();
      this._drift = externalTime - this._time;

      // Smooth correction: nudge delta toward reference
      rawDelta += this._drift * DRIFT_CORRECTION;
      if (rawDelta < 0) rawDelta = 0; // Never go backward
    }

    this._delta = rawDelta;
    this._time += rawDelta;

    // Fire callbacks (no allocation)
    for (let i = 0; i < this._callbackCount; i++) {
      const cb = this._callbacks[i];
      if (cb) cb(this._time, this._delta);
    }
  }

  /** Register a tick callback. Returns an unsubscribe function. */
  onTick(cb: TickCallback): () => void {
    if (this._callbackCount >= MAX_CALLBACKS) {
      console.warn('[DeterministicClock] Max callbacks reached');
      return () => {};
    }
    const idx = this._callbackCount;
    this._callbacks[idx] = cb;
    this._callbackCount++;

    return () => {
      this._callbacks[idx] = null;
      // Compact array
      const arr = this._callbacks;
      let write = 0;
      for (let r = 0; r < this._callbackCount; r++) {
        if (arr[r] !== null) {
          arr[write] = arr[r];
          write++;
        }
      }
      this._callbackCount = write;
      for (let i = write; i < MAX_CALLBACKS; i++) arr[i] = null;
    };
  }

  /** Set simulation time directly (e.g. from timeline scrub). */
  setTime(t: number): void {
    this._time = Math.max(0, t);
    this._delta = 0;
    this._lastPerfTime = performance.now() / 1000;
  }

  // ── Getters (zero alloc) ───────────────────────────────────────
  getTime(): number { return this._time; }
  getDelta(): number { return this._delta; }
  getDrift(): number { return this._drift; }
  isRunning(): boolean { return this._running; }

  getState(): ClockState {
    return {
      running: this._running,
      time: this._time,
      delta: this._delta,
      drift: this._drift,
      referenceSource: this._referenceSource,
    };
  }
}

export const deterministicClock = new DeterministicClock();
