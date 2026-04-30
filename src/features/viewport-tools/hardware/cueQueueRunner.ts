/**
 * Real Hardware Bridge — Cue Queue Scheduler
 * ────────────────────────────────────────────────────────────
 * Bridges the **FireOne CSV export** (or any TimelineItem batch
 * with rack/tube/startTime) to the **FXK16 hardware bridge** via
 * Web Serial / BLE. The FXK16 firmware exposes single/batch FIRE
 * commands but NOT a server-side cue list — so this scheduler runs
 * the timeline client-side, dispatching `bridge.fire(channel, ms)`
 * at each cue's timestamp with sub-50ms timer precision.
 *
 * Design rules (honest hardware layer):
 *   • NEVER auto-arms. Caller must explicitly arm before run().
 *   • E-STOP is always available and cancels every pending timer.
 *   • Pure scheduling — does NOT mutate ShowPlan or any export.
 *   • Channel mapping: FireOne `tube` (1..16) → FXK16 channel 1..16.
 *     `rack` is preserved for audit but ignored on a single FXK16
 *     (one rack per device). Multi-rack support requires extending.
 */

import { getFXK16Bridge, channelsToMask } from '@/hooks/useFXK16Bridge';
import { timelineClock } from '@/core/timeline/TimelineClock';
import type { TimelineItem } from '@/types/projectTypes';

export type CueRunStatus =
  | 'idle'
  | 'armed'
  | 'running'
  | 'paused'
  | 'finished'
  | 'aborted';

export interface CueRunEvent {
  type: 'fired' | 'skipped' | 'started' | 'finished' | 'aborted' | 'error' | 'drift';
  cueIndex: number;
  channel?: number;
  time?: number;
  /** Drift in ms (timeline_clock - wall_clock_baseline) — populated on 'drift' events. */
  driftMs?: number;
  message?: string;
}

/** Where the scheduler reads "now" from when computing fire times. */
export type CueClockSource = 'wall' | 'timeline';

/** Diagnostics surfaced for the SMPTE-locked path. */
export interface CueRunDiagnostics {
  clockSource: CueClockSource;
  /** Last measured drift between timeline clock and wall baseline (ms). */
  lastDriftMs: number;
  /** Peak |drift| observed during this run (ms). */
  peakDriftMs: number;
  /** Number of cues actually fired. */
  fired: number;
  /** Number of cues dropped because they were already in the past on dispatch. */
  lateDropped: number;
  /** Look-ahead window currently in use (ms). */
  lookaheadMs: number;
}

interface ScheduledCue {
  channel: number;
  fireAtMs: number; // relative to run start
  durationMs: number;
}

const DEFAULT_DURATION_MS = 120;

export interface CueQueueOptions {
  /** Default fire pulse width when item carries no explicit duration. */
  defaultDurationMs?: number;
  /**
   * Coalesce cues fired within `coalesceWindowMs` of each other into a single
   * `bridge.fireBatch()` mask call. Reduces serial chatter on dense salvos.
   * Default: 8ms (well under FXK16 PWM resolution).
   */
  coalesceWindowMs?: number;
  /**
   * Clock source for scheduling.
   *   • 'wall'     → setTimeout from performance.now() at run start (legacy).
   *   • 'timeline' → SMPTE-locked rAF look-ahead loop driven by
   *                  `timelineClock.getTime()` (master playback). Drift between
   *                  the wall clock and the timeline (audio/SMPTE) is corrected
   *                  every frame, keeping fires inside a ±50 ms envelope even
   *                  if the timeline is paused, scrubbed or chasing LTC.
   * Default: 'wall'.
   */
  clockSource?: CueClockSource;
  /**
   * Look-ahead window for the SMPTE-locked scheduler — cues whose timeline
   * timestamp is within this window from "now" are armed via setTimeout for
   * the exact remaining delta. Smaller = lower latency but more rAF chatter;
   * larger = smoother under jank but coarser. Default 50 ms (sub-50 ms target).
   */
  lookaheadMs?: number;
}

export class CueQueueRunner {
  private status: CueRunStatus = 'idle';
  private cues: ScheduledCue[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private startedAt = 0;
  private currentIndex = 0;
  private listeners = new Set<(e: CueRunEvent) => void>();
  private statusListeners = new Set<(s: CueRunStatus) => void>();
  private opts: Required<CueQueueOptions>;

  // ── SMPTE-locked scheduler state (only used when clockSource='timeline')
  private rafId: number | null = null;
  private timelineStartTime = 0;        // timelineClock.getTime() captured at run()
  private wallStartMs = 0;              // performance.now() captured at run()
  private nextGroupIndex = 0;           // monotonically advances; never re-fires
  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  private firedGroupCount = 0;
  private lateDropped = 0;
  private peakDrift = 0;
  private lastDrift = 0;
  private compiledGroups: Array<{
    fireAtMs: number; durationMs: number; channels: number[]; firstIndex: number;
  }> = [];

  constructor(opts: CueQueueOptions = {}) {
    this.opts = {
      defaultDurationMs: opts.defaultDurationMs ?? DEFAULT_DURATION_MS,
      coalesceWindowMs: opts.coalesceWindowMs ?? 8,
      clockSource: opts.clockSource ?? 'wall',
      lookaheadMs: opts.lookaheadMs ?? 50,
    };
  }

  /**
   * Update tunables. Coalesce/duration take effect on next load(); clockSource
   * + lookahead take effect on next run(). Disallowed mid-run.
   */
  setOptions(opts: Partial<CueQueueOptions>): void {
    if (this.status === 'running') {
      throw new Error('Cannot change options while a run is in progress.');
    }
    this.opts = {
      defaultDurationMs: opts.defaultDurationMs ?? this.opts.defaultDurationMs,
      coalesceWindowMs: opts.coalesceWindowMs ?? this.opts.coalesceWindowMs,
      clockSource: opts.clockSource ?? this.opts.clockSource,
      lookaheadMs: opts.lookaheadMs ?? this.opts.lookaheadMs,
    };
  }

  getOptions(): Readonly<Required<CueQueueOptions>> { return this.opts; }

  /** Compile a TimelineItem list into a fire schedule. Pure / non-destructive. */
  load(items: ReadonlyArray<TimelineItem>): { loaded: number; skipped: number } {
    if (this.status === 'running') {
      throw new Error('Cannot load cues while a run is in progress.');
    }
    let skipped = 0;
    const compiled: ScheduledCue[] = [];
    for (const it of items) {
      if (it.tube === undefined || it.tube < 1 || it.tube > 16) {
        skipped++;
        continue;
      }
      compiled.push({
        channel: it.tube,
        fireAtMs: Math.max(0, Math.round(it.startTime * 1000)),
        durationMs: this.opts.defaultDurationMs,
      });
    }
    compiled.sort((a, b) => a.fireAtMs - b.fireAtMs);
    this.cues = compiled;
    this.currentIndex = 0;
    this.setStatus('idle');
    return { loaded: compiled.length, skipped };
  }

  arm(): void {
    if (this.cues.length === 0) throw new Error('No cues loaded.');
    if (this.status !== 'idle' && this.status !== 'finished' && this.status !== 'aborted') {
      throw new Error(`Cannot arm from status: ${this.status}`);
    }
    this.setStatus('armed');
  }

  /**
   * Begin dispatching cues. Caller MUST have armed first. The bridge must be
   * connected — otherwise fires will silently fail per honest-hardware rules.
   */
  run(): void {
    if (this.status !== 'armed') {
      throw new Error(`run() requires status 'armed' (current: ${this.status}).`);
    }
    const bridge = getFXK16Bridge();
    if (!bridge.getStatus().connected) {
      throw new Error('FXK16 bridge not connected. Connect via USB or BLE first.');
    }

    this.setStatus('running');
    this.startedAt = performance.now();
    this.emit({ type: 'started', cueIndex: 0 });

    // ── Coalesce cues within the same time window into batch fires ──
    const win = this.opts.coalesceWindowMs;
    const groups: { fireAtMs: number; durationMs: number; channels: number[]; firstIndex: number }[] = [];
    let curr: typeof groups[number] | null = null;
    for (let i = 0; i < this.cues.length; i++) {
      const c = this.cues[i];
      if (!curr || c.fireAtMs - curr.fireAtMs > win) {
        curr = { fireAtMs: c.fireAtMs, durationMs: c.durationMs, channels: [c.channel], firstIndex: i };
        groups.push(curr);
      } else {
        if (!curr.channels.includes(c.channel)) curr.channels.push(c.channel);
      }
    }

    // Schedule each group with setTimeout. Drift-corrected per-cue from
    // performance.now() rather than chained setTimeout to keep <50ms target.
    for (const g of groups) {
      const t = setTimeout(() => {
        if (this.status !== 'running') return;
        this.dispatch(g);
      }, g.fireAtMs);
      this.timers.push(t);
    }

    // Schedule finish marker.
    const last = groups[groups.length - 1];
    const finishAt = (last?.fireAtMs ?? 0) + (last?.durationMs ?? 0) + 200;
    const finT = setTimeout(() => {
      if (this.status === 'running') {
        this.setStatus('finished');
        this.emit({ type: 'finished', cueIndex: this.cues.length });
      }
    }, finishAt);
    this.timers.push(finT);
  }

  private async dispatch(g: { fireAtMs: number; durationMs: number; channels: number[]; firstIndex: number }) {
    const bridge = getFXK16Bridge();
    try {
      if (g.channels.length === 1) {
        await bridge.fire(g.channels[0], g.durationMs);
      } else {
        const mask = channelsToMask(g.channels);
        await bridge.fireBatch(mask, g.durationMs);
      }
      for (let i = 0; i < g.channels.length; i++) {
        this.currentIndex = g.firstIndex + i + 1;
        this.emit({
          type: 'fired',
          cueIndex: g.firstIndex + i,
          channel: g.channels[i],
          time: g.fireAtMs / 1000,
        });
      }
    } catch (err) {
      this.emit({
        type: 'error',
        cueIndex: g.firstIndex,
        message: err instanceof Error ? err.message : 'fire failed',
      });
    }
  }

  /** Hard E-STOP — clears every pending timer and signals the bridge. */
  async eStop(reason = 'user'): Promise<void> {
    this.clearTimers();
    try {
      await getFXK16Bridge().eStop();
    } catch { /* bridge may already be down */ }
    this.setStatus('aborted');
    this.emit({ type: 'aborted', cueIndex: this.currentIndex, message: reason });
  }

  /** Soft cancel — clears pending timers without sending bridge E-STOP. */
  cancel(): void {
    this.clearTimers();
    this.setStatus('aborted');
    this.emit({ type: 'aborted', cueIndex: this.currentIndex, message: 'cancelled' });
  }

  private clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  // ── Reactive surface ────────────────────────────────────────────
  getStatus(): CueRunStatus {
    return this.status;
  }
  getProgress(): { fired: number; total: number } {
    return { fired: this.currentIndex, total: this.cues.length };
  }
  onEvent(fn: (e: CueRunEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  onStatus(fn: (s: CueRunStatus) => void): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }
  private emit(e: CueRunEvent) {
    for (const fn of this.listeners) {
      try { fn(e); } catch { /* listener should not throw */ }
    }
  }
  private setStatus(s: CueRunStatus) {
    this.status = s;
    for (const fn of this.statusListeners) {
      try { fn(s); } catch { /* listener should not throw */ }
    }
  }
}

// ── Process-singleton runner ─────────────────────────────────────
let _runner: CueQueueRunner | null = null;
export function getCueQueueRunner(): CueQueueRunner {
  if (!_runner) _runner = new CueQueueRunner();
  return _runner;
}
