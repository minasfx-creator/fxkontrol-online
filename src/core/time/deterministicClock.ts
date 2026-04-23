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
const MAX_CORRECTION = 0.01;   // Clamp external correction to ±10ms per tick
const MAX_CALLBACKS = 32;
const MIN_DELTA = 0.000001;
const MAX_TIME = 86400;

class DeterministicClock {
  private _time = 0;
  private _delta = 0;
  private _drift = 0;
  private _running = false;
  private _lastPerfTime = 0;
  private _referenceSource: ClockState['referenceSource'] = 'performance';
  private _externalRef: (() => number) | null = null;
  private _ticking = false;
  private _needsCompaction = false;

  // Pre-allocated callback array
  private _callbacks: (TickCallback | null)[] = new Array(MAX_CALLBACKS).fill(null);
  private _callbackCount = 0;

  /** Start the clock. */
  start(): void {
    if (this._running) return;
    this._running = true;
    this._lastPerfTime = performance.now() / 1000;
  }

  /** Pause the clock (time freezes, no callbacks). */
  pause(): void {
    this._running = false;
    this._lastPerfTime = performance.now() / 1000;
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
    if (!this._running || this._ticking) return;

    this._ticking = true;

    try {
      const now = performance.now() / 1000;
      let rawDelta = now - this._lastPerfTime;
      this._lastPerfTime = now;

      // Cap delta to prevent spiral of death
      if (rawDelta > MAX_DELTA) rawDelta = MAX_DELTA;
      if (rawDelta < 0) rawDelta = 0; // Monotonic guard

      // Drift correction against external reference
      if (this._externalRef) {
        const externalTime = this._externalRef();
        if (Number.isFinite(externalTime)) {
          this._drift = externalTime - this._time;

          // Smooth correction: nudge delta toward reference without large jumps
          const correction = Math.max(
            -MAX_CORRECTION,
            Math.min(MAX_CORRECTION, this._drift * DRIFT_CORRECTION),
          );
          rawDelta += correction;
        }
      }

      rawDelta = Math.max(MIN_DELTA, rawDelta);

      this._delta = rawDelta;
      this._time = Math.min(MAX_TIME, Math.round((this._time + rawDelta) * 1e6) / 1e6);

      // Fire callbacks (no allocation)
      const count = this._callbackCount;
      for (let i = 0; i < count; i++) {
        const cb = this._callbacks[i];
        if (cb) cb(this._time, this._delta);
      }
    } finally {
      this._ticking = false;
      if (this._needsCompaction) {
        this.compactCallbacks();
      }
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
      if (this._ticking) {
        this._needsCompaction = true;
        return;
      }
      this.compactCallbacks();
    };
  }

  /** Set simulation time directly (e.g. from timeline scrub). */
  setTime(t: number): void {
    if (!Number.isFinite(t)) return;
    this._time = Math.max(0, t);
    this._delta = 0;
    this._drift = 0;
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

  private compactCallbacks(): void {
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
    this._needsCompaction = false;
  }
}

export const deterministicClock = new DeterministicClock();
