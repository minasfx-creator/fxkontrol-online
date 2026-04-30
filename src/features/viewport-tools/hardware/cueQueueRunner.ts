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
   *
   * Two scheduling paths, selected by `clockSource`:
   *   • 'wall'     → setTimeout from run() baseline. Simple, ignores pauses.
   *   • 'timeline' → SMPTE-locked rAF loop. Re-anchors every frame against
   *     `timelineClock.getTime()` so pauses, scrubs, LTC chase and audio
   *     drift all bend the schedule. Look-ahead window (default 50 ms) is
   *     the maximum lead used for the per-group setTimeout — that's the
   *     sub-50 ms target for FXK16 fire latency.
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

    // ── Compile coalesced groups (shared across both paths) ─────────
    this.compiledGroups = this.compileGroups();

    if (this.opts.clockSource === 'timeline') {
      this.runTimelineLocked();
    } else {
      this.runWallClock();
    }
  }

  /** Coalesce cues within `coalesceWindowMs` into single-mask FIRE groups. */
  private compileGroups(): Array<{
    fireAtMs: number; durationMs: number; channels: number[]; firstIndex: number;
  }> {
    const win = this.opts.coalesceWindowMs;
    const groups: Array<{
      fireAtMs: number; durationMs: number; channels: number[]; firstIndex: number;
    }> = [];
    let curr: typeof groups[number] | null = null;
    for (let i = 0; i < this.cues.length; i++) {
      const c = this.cues[i];
      if (!curr || c.fireAtMs - curr.fireAtMs > win) {
        curr = {
          fireAtMs: c.fireAtMs,
          durationMs: c.durationMs,
          channels: [c.channel],
          firstIndex: i,
        };
        groups.push(curr);
      } else if (!curr.channels.includes(c.channel)) {
        curr.channels.push(c.channel);
      }
    }
    return groups;
  }

  /** Legacy path — schedules every group up-front from wall-clock baseline. */
  private runWallClock(): void {
    for (const g of this.compiledGroups) {
      const t = setTimeout(() => {
        if (this.status !== 'running') return;
        void this.dispatch(g);
      }, g.fireAtMs);
      this.timers.push(t);
    }
    const last = this.compiledGroups[this.compiledGroups.length - 1];
    const finishAt = (last?.fireAtMs ?? 0) + (last?.durationMs ?? 0) + 200;
    const finT = setTimeout(() => {
      if (this.status === 'running') {
        this.setStatus('finished');
        this.emit({ type: 'finished', cueIndex: this.cues.length });
      }
    }, finishAt);
    this.timers.push(finT);
  }

  /**
   * SMPTE-locked path. Anchors fire times to `timelineClock.getTime()` and
   * re-evaluates every animation frame. Cues whose timeline timestamp falls
   * within `lookaheadMs` from "now" are armed via setTimeout for the exact
   * remaining delta. Drift between timeline_clock and wall_clock is sampled
   * each frame and broadcast as 'drift' events for HUD diagnostics.
   *
   * Key honest-hardware properties:
   *   • If the timeline pauses, no new fires arm — already-armed setTimeouts
   *     for the next ≤50 ms still resolve (intentionally — those cues were
   *     already "in flight" from the operator's POV).
   *   • If the timeline scrubs backwards, `nextGroupIndex` does NOT roll
   *     back. Re-firing a cue would be a safety violation. The operator
   *     must explicitly re-arm to replay.
   *   • Cues whose timestamp is already in the past at run() start are
   *     dropped (lateDropped++) instead of stacking up an immediate barrage.
   */
  private runTimelineLocked(): void {
    this.timelineStartTime = timelineClock.getTime();
    this.wallStartMs = performance.now();
    this.nextGroupIndex = 0;
    this.firedGroupCount = 0;
    this.lateDropped = 0;
    this.peakDrift = 0;
    this.lastDrift = 0;

    const tick = (): void => {
      if (this.status !== 'running') {
        this.rafId = null;
        return;
      }

      // Anchor: where is the timeline NOW (in seconds), and how does that
      // compare to the wall clock baseline captured at run start?
      const tlNow = timelineClock.getTime();
      const tlElapsedMs = (tlNow - this.timelineStartTime) * 1000;
      const wallElapsedMs = performance.now() - this.wallStartMs;
      // drift > 0 → timeline is ahead of wall (e.g. seek forward / fast LTC)
      // drift < 0 → timeline is behind wall (paused, slow LTC, audio underrun)
      const drift = tlElapsedMs - wallElapsedMs;
      this.lastDrift = drift;
      if (Math.abs(drift) > Math.abs(this.peakDrift)) this.peakDrift = drift;

      const lookahead = this.opts.lookaheadMs;
      const horizonMs = tlElapsedMs + lookahead;

      // Arm every group inside the look-ahead window that we haven't fired yet
      while (this.nextGroupIndex < this.compiledGroups.length) {
        const g = this.compiledGroups[this.nextGroupIndex];
        if (g.fireAtMs > horizonMs) break;

        const groupIdx = this.nextGroupIndex;
        this.nextGroupIndex++;

        // Late cue (already past on first sight) → drop, don't stack
        if (g.fireAtMs < tlElapsedMs - lookahead) {
          this.lateDropped++;
          this.emit({
            type: 'skipped',
            cueIndex: g.firstIndex,
            time: g.fireAtMs / 1000,
            message: `late by ${Math.round(tlElapsedMs - g.fireAtMs)}ms`,
          });
          continue;
        }

        // Schedule precisely at delta from NOW (positive small ms)
        const delayMs = Math.max(0, g.fireAtMs - tlElapsedMs);
        const t = setTimeout(() => {
          this.pendingTimers.delete(t);
          if (this.status !== 'running') return;
          this.firedGroupCount++;
          void this.dispatch(g);
        }, delayMs);
        this.pendingTimers.add(t);
        this.timers.push(t);
        // Track group index for diagnostics
        void groupIdx;
      }

      // Emit a drift breadcrumb every ~250 ms for the HUD
      if (Math.abs(drift) > 5 && (this.firedGroupCount & 0x7) === 0) {
        this.emit({ type: 'drift', cueIndex: this.nextGroupIndex, driftMs: drift });
      }

      // Finished?
      if (
        this.nextGroupIndex >= this.compiledGroups.length &&
        this.pendingTimers.size === 0
      ) {
        this.setStatus('finished');
        this.emit({ type: 'finished', cueIndex: this.cues.length });
        this.rafId = null;
        return;
      }

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
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
    this.pendingTimers.clear();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** SMPTE-locked diagnostics (also valid for wall mode — drift fields stay 0). */
  getDiagnostics(): CueRunDiagnostics {
    return {
      clockSource: this.opts.clockSource,
      lastDriftMs: this.lastDrift,
      peakDriftMs: this.peakDrift,
      fired: this.currentIndex,
      lateDropped: this.lateDropped,
      lookaheadMs: this.opts.lookaheadMs,
    };
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
