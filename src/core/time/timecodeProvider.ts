/**
 * ─── Timecode Provider ──────────────────────────────────────────────
 * Multi-source timecode with priority fallback chain:
 * LTC → SMPTE → PTP → NTP → AudioContext → performance.now()
 *
 * Provides frame-accurate time reference for broadcast-level sync.
 */

export type TimecodeSource = 'ltc' | 'smpte' | 'ptp' | 'ntp' | 'audio' | 'local';

export interface TimecodeState {
  source: TimecodeSource;
  timecodeMs: number;
  frame: number;
  fps: number;
  frameDurationMs: number;
  locked: boolean;
  lastUpdate: number;
}

const SOURCE_PRIORITY: TimecodeSource[] = ['ltc', 'smpte', 'ptp', 'ntp', 'audio', 'local'];
const STALE_THRESHOLD_MS = 2000;

class TimecodeProvider {
  private _fps = 60;
  private _frameDurationMs = 1000 / 60;
  private _sources = new Map<TimecodeSource, { timeMs: number; updatedAt: number }>();
  private _activeSource: TimecodeSource = 'local';
  private _locked = false;
  private _audioCtx: AudioContext | null = null;

  // ── Configuration ─────────────────────────────────────────────

  setFPS(fps: number): void {
    this._fps = fps;
    this._frameDurationMs = 1000 / fps;
  }

  getFPS(): number {
    return this._fps;
  }

  getFrameDuration(): number {
    return this._frameDurationMs;
  }

  // ── Source Feeding ────────────────────────────────────────────

  /** Feed timecode from an external source (LTC decoder, SMPTE reader, etc.) */
  feedTimecode(source: TimecodeSource, timeMs: number): void {
    this._sources.set(source, { timeMs, updatedAt: performance.now() });
  }

  /** Bind an AudioContext as audio timecode source */
  bindAudioContext(ctx: AudioContext): void {
    this._audioCtx = ctx;
  }

  unbindAudioContext(): void {
    this._audioCtx = null;
  }

  // ── Core Queries ─────────────────────────────────────────────

  /** Get current timecode in milliseconds from the highest-priority active source */
  getTimecode(): number {
    this._resolveActiveSource();

    if (this._activeSource === 'audio' && this._audioCtx) {
      return this._audioCtx.currentTime * 1000;
    }

    if (this._activeSource === 'local') {
      return performance.now();
    }

    const src = this._sources.get(this._activeSource);
    if (src) {
      // Extrapolate from last known value
      const elapsed = performance.now() - src.updatedAt;
      return src.timeMs + elapsed;
    }

    return performance.now();
  }

  /** Get current frame number */
  getFrame(): number {
    return Math.floor(this.getTimecode() / this._frameDurationMs);
  }

  /** Get frame-aligned time (snapped to frame boundary) */
  getFrameAlignedTime(): number {
    const tc = this.getTimecode();
    return Math.round(tc / this._frameDurationMs) * this._frameDurationMs;
  }

  /** Convert frame number to milliseconds */
  frameToMs(frame: number): number {
    return frame * this._frameDurationMs;
  }

  /** Convert milliseconds to frame number */
  msToFrame(ms: number): number {
    return Math.floor(ms / this._frameDurationMs);
  }

  // ── State ────────────────────────────────────────────────────

  getState(): TimecodeState {
    return {
      source: this._activeSource,
      timecodeMs: this.getTimecode(),
      frame: this.getFrame(),
      fps: this._fps,
      frameDurationMs: this._frameDurationMs,
      locked: this._locked,
      lastUpdate: performance.now(),
    };
  }

  getActiveSource(): TimecodeSource {
    return this._activeSource;
  }

  isLocked(): boolean {
    return this._locked;
  }

  // ── Internal ─────────────────────────────────────────────────

  private _resolveActiveSource(): void {
    const now = performance.now();

    for (const source of SOURCE_PRIORITY) {
      if (source === 'audio') {
        if (this._audioCtx && this._audioCtx.state === 'running') {
          this._activeSource = 'audio';
          this._locked = true;
          return;
        }
        continue;
      }

      if (source === 'local') {
        this._activeSource = 'local';
        this._locked = false;
        return;
      }

      const entry = this._sources.get(source);
      if (entry && (now - entry.updatedAt) < STALE_THRESHOLD_MS) {
        this._activeSource = source;
        this._locked = true;
        return;
      }
    }

    this._activeSource = 'local';
    this._locked = false;
  }
}

export const timecodeProvider = new TimecodeProvider();
