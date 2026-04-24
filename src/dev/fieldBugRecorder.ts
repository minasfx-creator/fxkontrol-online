/**
 * ─── Field Bug Recorder (dev only) ────────────────────────────────
 * Captures a live operator session as a self-contained "bug bundle"
 * that QA can ship to engineering for deterministic replay.
 *
 * Bundle shape:
 *   {
 *     trace:       [...]    // wire frames (TX/RX with timing)
 *     profile:     string   // emulator failure profile in use
 *     config:      {...}    // latency/jitter/loss/seed at capture
 *     capturedAt:  ISO date
 *     durationMs:  number
 *     notes:       string   // operator-supplied repro context
 *     ua:          string   // browser/UA for reproducibility
 *   }
 *
 * The recorder is a thin wrapper around an active TransportEmulator.
 * It does not retain any reference to it after `stop()` and snapshots
 * the trace at stop-time so the emulator can be torn down freely.
 */

import type { TransportEmulator } from './transportEmulator';

export interface BugBundle {
  version: 1;
  capturedAt: string;
  durationMs: number;
  profile: string;
  notes: string;
  ua: string;
  config: {
    mode: string;
    latencyMs: number;
    jitterMs: number;
    lossRate: number;
    duplicateRate: number;
    seed: number;
  };
  trace: ReturnType<TransportEmulator['exportTrace']>;
}

export class FieldBugRecorder {
  private emu: TransportEmulator | null = null;
  private profile = '';
  private startedAt = 0;
  private recording = false;

  /** Begin capturing. Resets the underlying emulator's trace log. */
  start(emu: TransportEmulator, profile: string) {
    this.emu = emu;
    this.profile = profile;
    this.startedAt = Date.now();
    this.recording = true;
    emu.resetLog();
  }

  isRecording() { return this.recording; }
  getElapsedMs() { return this.recording ? Date.now() - this.startedAt : 0; }

  /** Stop and return a self-contained bundle. */
  stop(notes: string): BugBundle | null {
    if (!this.recording || !this.emu) return null;
    const trace = this.emu.exportTrace();
    const cfg = this.emu.getConfig();
    const bundle: BugBundle = {
      version: 1,
      capturedAt: new Date(this.startedAt).toISOString(),
      durationMs: Date.now() - this.startedAt,
      profile: this.profile,
      notes: notes.trim(),
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      config: {
        mode: cfg.mode,
        latencyMs: cfg.latencyMs,
        jitterMs: cfg.jitterMs,
        lossRate: cfg.lossRate,
        duplicateRate: cfg.duplicateRate,
        seed: cfg.seed,
      },
      trace,
    };
    this.recording = false;
    this.emu = null;
    return bundle;
  }

  cancel() {
    this.recording = false;
    this.emu = null;
  }
}

/** Validate a bundle shape — used by Engineering when loading a field report. */
export function isValidBugBundle(x: unknown): x is BugBundle {
  if (!x || typeof x !== 'object') return false;
  const b = x as Partial<BugBundle>;
  return b.version === 1
    && typeof b.capturedAt === 'string'
    && typeof b.durationMs === 'number'
    && typeof b.profile === 'string'
    && typeof b.notes === 'string'
    && typeof b.ua === 'string'
    && !!b.config
    && !!b.trace
    && Array.isArray((b.trace as { frames?: unknown }).frames);
}
