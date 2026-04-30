/**
 * Showven FX Commander — Cue Queue Scheduler (PBus dual-band)
 * ────────────────────────────────────────────────────────────
 * Bridges the Showven export (TimelineItems with rack/tube/startTime)
 * to the **Showven PyroSlave fleet** via the PBusController over Web
 * Serial (19200 8N1, dual-band 433M/868M).
 *
 * Mapping (Showven FX Commander Pro convention):
 *   • rack 1..64  → PBus device address (1..64). Defaults to 1.
 *   • tube 1..16  → PBus cue index on that device (1-based for users).
 *
 * Coalescing:
 *   Cues firing within `coalesceWindowMs` of each other on the SAME
 *   device address are dispatched as a single FIRE_SEQ frame (one
 *   serial round-trip per device per window) to keep wire chatter
 *   minimal and respect the 19200 baud ceiling.
 *
 * Honest-hardware rules:
 *   • NEVER auto-arms — caller must explicitly arm before run().
 *   • E-STOP is always available; clears every pending timer.
 *   • Pure scheduling — NEVER mutates ShowPlan or any export artifact.
 *   • Run is gated on PBus state ∈ {connected, degraded}.
 */

import { getPBusController, type PBusTransportState } from '@/lib/pbusProtocol';
import type { TimelineItem } from '@/types/projectTypes';

export type ShowvenRunStatus =
  | 'idle'
  | 'armed'
  | 'running'
  | 'finished'
  | 'aborted';

export interface ShowvenRunEvent {
  type: 'fired' | 'started' | 'finished' | 'aborted' | 'error' | 'info';
  cueIndex: number;
  device?: number;
  channel?: number;
  channels?: number[];
  time?: number;
  message?: string;
}

interface ScheduledCue {
  device: number; // PBus address (rack)
  channel: number; // 1..16
  fireAtMs: number;
  durationMs: number;
}

const DEFAULT_DURATION_MS = 500;
const DEFAULT_COALESCE_MS = 8;
const FINISH_GUARD_MS = 250;
const MAX_DEVICE = 64;

export interface ShowvenQueueOptions {
  defaultDurationMs?: number;
  /** Coalesce same-device cues within this window into FIRE_SEQ. */
  coalesceWindowMs?: number;
}

export class ShowvenCueRunner {
  private status: ShowvenRunStatus = 'idle';
  private cues: ScheduledCue[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private startedAt = 0;
  private currentIndex = 0;
  private listeners = new Set<(e: ShowvenRunEvent) => void>();
  private statusListeners = new Set<(s: ShowvenRunStatus) => void>();
  private opts: Required<ShowvenQueueOptions>;

  constructor(opts: ShowvenQueueOptions = {}) {
    this.opts = {
      defaultDurationMs: opts.defaultDurationMs ?? DEFAULT_DURATION_MS,
      coalesceWindowMs: opts.coalesceWindowMs ?? DEFAULT_COALESCE_MS,
    };
  }

  /**
   * Update tunables. Safe to call any time except mid-run; takes effect
   * on the next `load()` (durationMs is baked in at compile time).
   */
  setOptions(opts: ShowvenQueueOptions): void {
    if (this.status === 'running') {
      throw new Error('Cannot change options while a run is in progress.');
    }
    this.opts = {
      defaultDurationMs: opts.defaultDurationMs ?? this.opts.defaultDurationMs,
      coalesceWindowMs: opts.coalesceWindowMs ?? this.opts.coalesceWindowMs,
    };
  }

  getOptions(): Readonly<Required<ShowvenQueueOptions>> { return this.opts; }

  /** Compile a TimelineItem list into a fire schedule. Pure / non-destructive. */
  load(items: ReadonlyArray<TimelineItem>): { loaded: number; skipped: number } {
    if (this.status === 'running') {
      throw new Error('Cannot load cues while a run is in progress.');
    }
    let skipped = 0;
    const compiled: ScheduledCue[] = [];
    for (const it of items) {
      const tube = it.tube;
      const rack = (it as { rack?: number }).rack ?? 1;
      if (tube === undefined || tube < 1 || tube > 16) { skipped++; continue; }
      if (rack < 1 || rack > MAX_DEVICE) { skipped++; continue; }
      compiled.push({
        device: rack,
        channel: tube,
        fireAtMs: Math.max(0, Math.round(it.startTime * 1000)),
        durationMs: this.opts.defaultDurationMs,
      });
    }
    compiled.sort((a, b) =>
      a.fireAtMs - b.fireAtMs || a.device - b.device || a.channel - b.channel,
    );
    this.cues = compiled;
    this.currentIndex = 0;
    this.setStatus('idle');
    return { loaded: compiled.length, skipped };
  }

  arm(): void {
    if (this.cues.length === 0) throw new Error('No cues loaded.');
    if (
      this.status !== 'idle' &&
      this.status !== 'finished' &&
      this.status !== 'aborted'
    ) {
      throw new Error(`Cannot arm from status: ${this.status}`);
    }
    this.setStatus('armed');
  }

  /**
   * Begin dispatching cues. Caller MUST have armed first. The PBus
   * transport must be connected — fires fail loudly otherwise.
   */
  run(): void {
    if (this.status !== 'armed') {
      throw new Error(`run() requires status 'armed' (current: ${this.status}).`);
    }
    const ctrl = getPBusController();
    const st: PBusTransportState = ctrl.getState();
    if (st !== 'connected' && st !== 'degraded') {
      throw new Error(`PBus not connected (state=${st}). Connect via Web Serial first.`);
    }

    this.setStatus('running');
    this.startedAt = performance.now();
    this.emit({ type: 'started', cueIndex: 0 });

    // ── Coalesce per (time-window, device) ──────────────────────────
    const win = this.opts.coalesceWindowMs;
    interface Group {
      fireAtMs: number;
      device: number;
      durationMs: number;
      channels: number[];
      firstIndex: number;
    }
    const groups: Group[] = [];
    let curr: Group | null = null;
    for (let i = 0; i < this.cues.length; i++) {
      const c = this.cues[i];
      if (
        !curr ||
        c.device !== curr.device ||
        c.fireAtMs - curr.fireAtMs > win
      ) {
        curr = {
          fireAtMs: c.fireAtMs,
          device: c.device,
          durationMs: c.durationMs,
          channels: [c.channel],
          firstIndex: i,
        };
        groups.push(curr);
      } else if (!curr.channels.includes(c.channel)) {
        curr.channels.push(c.channel);
      }
    }

    // Drift-corrected scheduling against performance.now()
    for (const g of groups) {
      const delay = Math.max(0, g.fireAtMs - (performance.now() - this.startedAt));
      const t = setTimeout(() => {
        if (this.status !== 'running') return;
        void this.dispatch(g);
      }, delay);
      this.timers.push(t);
    }

    const last = groups[groups.length - 1];
    const finishAt = (last?.fireAtMs ?? 0) + (last?.durationMs ?? 0) + FINISH_GUARD_MS;
    const finT = setTimeout(() => {
      if (this.status === 'running') {
        this.setStatus('finished');
        this.emit({ type: 'finished', cueIndex: this.cues.length });
      }
    }, finishAt);
    this.timers.push(finT);
  }

  private async dispatch(g: {
    fireAtMs: number;
    device: number;
    durationMs: number;
    channels: number[];
    firstIndex: number;
  }): Promise<void> {
    const ctrl = getPBusController();
    try {
      if (g.channels.length === 1) {
        // PBus FIRE accepts cue index + duration. PBus uses 0-based cue
        // index internally; users address 1..16 so we send (ch - 1).
        await ctrl.fireCue(g.device, g.channels[0] - 1, g.durationMs);
      } else {
        // Fire sequence — interval=1ms means "as fast as bus allows",
        // perceptually a single salvo on the slave.
        const cuesZeroBased = g.channels.map((c) => c - 1);
        // buildFireSequenceFrame is exposed indirectly via send/.fire path;
        // controller has no helper, so we go through the public send().
        const { buildFireSequenceFrame } = await import('@/lib/pbusProtocol');
        await ctrl.send(buildFireSequenceFrame(g.device, cuesZeroBased, 1));
      }
      for (let i = 0; i < g.channels.length; i++) {
        this.currentIndex = g.firstIndex + i + 1;
        this.emit({
          type: 'fired',
          cueIndex: g.firstIndex + i,
          device: g.device,
          channel: g.channels[i],
          channels: g.channels.length > 1 ? g.channels : undefined,
          time: g.fireAtMs / 1000,
        });
      }
    } catch (err) {
      this.emit({
        type: 'error',
        cueIndex: g.firstIndex,
        device: g.device,
        message: err instanceof Error ? err.message : 'fire failed',
      });
    }
  }

  /** Hard E-STOP — clears every pending timer and broadcasts PBus E-STOP. */
  async eStop(reason = 'user'): Promise<void> {
    this.clearTimers();
    try {
      await getPBusController().emergencyStop();
    } catch {
      /* PBus may already be down */
    }
    this.setStatus('aborted');
    this.emit({ type: 'aborted', cueIndex: this.currentIndex, message: reason });
  }

  /** Soft cancel — clears pending timers without broadcasting E-STOP. */
  cancel(): void {
    this.clearTimers();
    this.setStatus('aborted');
    this.emit({ type: 'aborted', cueIndex: this.currentIndex, message: 'cancelled' });
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  // ── Reactive surface ─────────────────────────────────────────────
  getStatus(): ShowvenRunStatus { return this.status; }
  getProgress(): { fired: number; total: number; devices: number } {
    const devs = new Set(this.cues.map((c) => c.device));
    return { fired: this.currentIndex, total: this.cues.length, devices: devs.size };
  }
  /** Unique device addresses present in the loaded queue. */
  getDeviceList(): number[] {
    return Array.from(new Set(this.cues.map((c) => c.device))).sort((a, b) => a - b);
  }
  onEvent(fn: (e: ShowvenRunEvent) => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }
  onStatus(fn: (s: ShowvenRunStatus) => void): () => void {
    this.statusListeners.add(fn);
    return () => { this.statusListeners.delete(fn); };
  }
  private emit(e: ShowvenRunEvent): void {
    for (const fn of this.listeners) {
      try { fn(e); } catch { /* listener should not throw */ }
    }
  }
  private setStatus(s: ShowvenRunStatus): void {
    if (this.status === s) return;
    this.status = s;
    for (const fn of this.statusListeners) {
      try { fn(s); } catch { /* listener should not throw */ }
    }
  }
}

// ── Process-singleton runner ───────────────────────────────────────
let _runner: ShowvenCueRunner | null = null;
export function getShowvenCueRunner(): ShowvenCueRunner {
  if (!_runner) _runner = new ShowvenCueRunner();
  return _runner;
}
