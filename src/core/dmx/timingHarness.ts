/**
 * ─── DMX Timing Validation Harness ──────────────────────────────────
 * Records per-stage latency for the DMX frame pipeline against
 * declared budgets and reports regressions.
 *
 * Pipeline stages (per-frame):
 *   schedule  — cue queued in HardwareScheduler
 *   dispatch  — popped from scheduler / tick handler entered
 *   encode    — DMX frame bytes prepared (Uint8Array)
 *   transport — handed to WebSocket / WebSerial / Art-Net
 *   ack       — (optional) confirmation from transport
 *
 * Design constraints:
 *  • Zero-GC hot path: ring buffer of fixed-size frame records, reused.
 *  • Disabled by default in prod — `enable()` flips a flag; when off,
 *    `mark()` and `commit()` are O(1) no-ops (no allocations).
 *  • Regression detection: rolling p95 vs baseline p95 (>20% = warn).
 *  • Console + test reporting via `report()` and `getRegressions()`.
 *
 * NOT a profiler. Does not own timers — callers pass `performance.now()`
 * timestamps. This keeps the harness deterministic in tests.
 */

import { logger } from '@/lib/logger';

// ── Types ──────────────────────────────────────────────────────────
export type DMXStage = 'schedule' | 'dispatch' | 'encode' | 'transport' | 'ack';

export const DMX_STAGES: readonly DMXStage[] = [
  'schedule', 'dispatch', 'encode', 'transport', 'ack',
] as const;

export interface StageBudgets {
  schedule: number;
  dispatch: number;
  encode: number;
  transport: number;
  ack: number;
  /** Total budget for the full frame pipeline (ms). */
  total: number;
}

/**
 * DMX512 spec: 44Hz max frame rate ≈ 22.7ms per frame. Budgets below
 * leave headroom for the renderer / event loop. Tune via `setBudgets()`.
 */
export const DEFAULT_BUDGETS: StageBudgets = {
  schedule: 1.0,   // queue insertion (binary search)
  dispatch: 1.0,   // tick handler entry
  encode: 2.0,     // Uint8Array build + base64
  transport: 8.0,  // WS send / Serial write
  ack: 5.0,        // confirmation roundtrip (when present)
  total: 22.0,     // < 1 DMX frame @ 44Hz
};

// ── Selectable budget presets ──────────────────────────────────────
// Lets operators validate the same pipeline against different timing
// targets without changing code. Pick via `applyBudgetPreset(id)`.
//
//   safe       — generous headroom (~30Hz). Good for noisy USB hubs,
//                hot laptops, or staging environments.
//   standard   — DMX512 spec target (~44Hz, 22ms). Default.
//   aggressive — sub-frame target (~60Hz, 16ms). Used to surface
//                regressions early on tuned production rigs.
export type DMXBudgetPresetId = 'safe' | 'standard' | 'aggressive';

export interface DMXBudgetPreset {
  id: DMXBudgetPresetId;
  label: string;
  description: string;
  /** Approximate frame rate this preset validates against. */
  targetHz: number;
  budgets: StageBudgets;
}

export const DMX_BUDGET_PRESETS: Readonly<Record<DMXBudgetPresetId, DMXBudgetPreset>> = {
  safe: {
    id: 'safe',
    label: 'Safe (~30Hz)',
    description: 'Generous headroom. Use for staging or unstable transports.',
    targetHz: 30,
    budgets: {
      schedule: 2.0,
      dispatch: 2.0,
      encode: 4.0,
      transport: 14.0,
      ack: 8.0,
      total: 33.0,
    },
  },
  standard: {
    id: 'standard',
    label: 'Standard (44Hz)',
    description: 'DMX512 spec target. Default production budget.',
    targetHz: 44,
    budgets: { ...DEFAULT_BUDGETS },
  },
  aggressive: {
    id: 'aggressive',
    label: 'Aggressive (60Hz)',
    description: 'Sub-frame target. Surfaces regressions on tuned rigs.',
    targetHz: 60,
    budgets: {
      schedule: 0.5,
      dispatch: 0.5,
      encode: 1.5,
      transport: 6.0,
      ack: 3.5,
      total: 16.0,
    },
  },
};

export const DEFAULT_BUDGET_PRESET: DMXBudgetPresetId = 'standard';

export interface FrameRecord {
  /** Monotonic id, wraps at Number.MAX_SAFE_INTEGER. */
  id: number;
  /** Stage timestamps (performance.now). NaN if stage not marked. */
  marks: Record<DMXStage, number>;
  /** Stage durations in ms (computed at commit). NaN if unmarked. */
  durations: Record<DMXStage, number>;
  /** Total ms from `schedule` to last marked stage. */
  totalMs: number;
  /** Stages that exceeded their per-stage budget. */
  breaches: DMXStage[];
  /** True if `totalMs` exceeded `budgets.total`. */
  totalBreach: boolean;
}

export interface StageStats {
  count: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  budget: number;
  breachRate: number; // 0..1
}

export interface HarnessReport {
  enabled: boolean;
  framesRecorded: number;
  windowSize: number;
  stages: Record<DMXStage, StageStats>;
  total: StageStats;
  regressions: Regression[];
}

export interface Regression {
  stage: DMXStage | 'total';
  baselineP95: number;
  currentP95: number;
  pctIncrease: number;
  budget: number;
}

// ── Internal storage ───────────────────────────────────────────────
const RING_SIZE = 256;
const REGRESSION_THRESHOLD = 0.2; // 20% p95 increase
const WARN_RATE_LIMIT_MS = 1000;  // throttle console.warn

function makeEmptyMarks(): Record<DMXStage, number> {
  return { schedule: NaN, dispatch: NaN, encode: NaN, transport: NaN, ack: NaN };
}

function makeEmptyRecord(): FrameRecord {
  return {
    id: -1,
    marks: makeEmptyMarks(),
    durations: makeEmptyMarks(),
    totalMs: NaN,
    breaches: [],
    totalBreach: false,
  };
}

class DMXTimingHarness {
  private _enabled = false;
  private _budgets: StageBudgets = { ...DEFAULT_BUDGETS };

  // Ring buffer of pre-allocated records (zero-GC).
  private readonly _ring: FrameRecord[] = Array.from({ length: RING_SIZE }, makeEmptyRecord);
  private _ringIndex = 0;
  private _framesRecorded = 0;
  private _nextId = 1;

  // Active (in-flight) record being marked. Re-used across frames.
  private _active: FrameRecord = makeEmptyRecord();
  private _activeOpen = false;

  // Baseline p95s captured via captureBaseline().
  private _baseline: Partial<Record<DMXStage | 'total', number>> = {};

  // Console warn throttle.
  private _lastWarnAt = 0;
  private _suppressedWarns = 0;

  // Test hook for callbacks on commit.
  private _onCommit: ((rec: Readonly<FrameRecord>) => void) | null = null;

  enable(): void { this._enabled = true; }
  disable(): void { this._enabled = false; this._activeOpen = false; }
  isEnabled(): boolean { return this._enabled; }

  setBudgets(b: Partial<StageBudgets>): void {
    this._budgets = { ...this._budgets, ...b };
  }
  getBudgets(): Readonly<StageBudgets> { return this._budgets; }

  /** Begin a new frame; resets in-flight record. */
  begin(): number {
    if (!this._enabled) return -1;
    const id = this._nextId++;
    if (this._nextId >= Number.MAX_SAFE_INTEGER) this._nextId = 1;
    const m = this._active.marks;
    m.schedule = NaN; m.dispatch = NaN; m.encode = NaN; m.transport = NaN; m.ack = NaN;
    this._active.id = id;
    this._activeOpen = true;
    return id;
  }

  /**
   * Mark a stage timestamp. `now` defaults to `performance.now()`.
   * Safe to call without `begin()` — first mark implicitly opens a frame.
   */
  mark(stage: DMXStage, now?: number): void {
    if (!this._enabled) return;
    if (!this._activeOpen) this.begin();
    this._active.marks[stage] = now ?? performance.now();
  }

  /**
   * Commit the in-flight frame to the ring buffer, computing durations
   * and budget breaches. Returns the committed record (read-only view).
   */
  commit(): Readonly<FrameRecord> | null {
    if (!this._enabled || !this._activeOpen) return null;

    const src = this._active;
    const slot = this._ring[this._ringIndex];
    slot.id = src.id;

    // Copy marks + compute per-stage durations (delta from previous marked stage).
    let prev = NaN;
    let firstMark = NaN;
    let lastMark = NaN;
    slot.breaches.length = 0;

    for (let i = 0; i < DMX_STAGES.length; i++) {
      const stage = DMX_STAGES[i];
      const t = src.marks[stage];
      slot.marks[stage] = t;

      if (Number.isFinite(t)) {
        if (!Number.isFinite(firstMark)) firstMark = t;
        lastMark = t;
        const dur = Number.isFinite(prev) ? t - prev : 0;
        slot.durations[stage] = dur;
        const budget = this._budgets[stage];
        if (dur > budget) slot.breaches.push(stage);
        prev = t;
      } else {
        slot.durations[stage] = NaN;
      }
    }

    slot.totalMs = Number.isFinite(firstMark) && Number.isFinite(lastMark)
      ? lastMark - firstMark
      : NaN;
    slot.totalBreach = Number.isFinite(slot.totalMs) && slot.totalMs > this._budgets.total;

    this._ringIndex = (this._ringIndex + 1) % RING_SIZE;
    this._framesRecorded++;
    this._activeOpen = false;

    if (slot.breaches.length > 0 || slot.totalBreach) this._maybeWarn(slot);
    this._onCommit?.(slot);
    return slot;
  }

  /** Aborts in-flight frame without committing. */
  abort(): void { this._activeOpen = false; }

  /** Capture current rolling p95 as the regression baseline. */
  captureBaseline(): void {
    const rep = this._stats();
    this._baseline = {};
    for (const s of DMX_STAGES) this._baseline[s] = rep.stages[s].p95;
    this._baseline.total = rep.total.p95;
  }

  /** Manually set baselines (e.g. from CI artifact). */
  setBaseline(b: Partial<Record<DMXStage | 'total', number>>): void {
    this._baseline = { ...b };
  }

  getBaseline(): Readonly<Partial<Record<DMXStage | 'total', number>>> {
    return this._baseline;
  }

  /**
   * Detect regressions vs baseline. Only stages with a baseline AND at
   * least 16 samples are evaluated (avoids noise on tiny windows).
   */
  getRegressions(): Regression[] {
    const out: Regression[] = [];
    const stats = this._stats();
    if (stats.framesRecorded < 16) return out;

    const check = (stage: DMXStage | 'total', cur: StageStats) => {
      const base = this._baseline[stage];
      if (!Number.isFinite(base) || base === undefined || base <= 0) return;
      const pct = (cur.p95 - base) / base;
      if (pct > REGRESSION_THRESHOLD) {
        out.push({
          stage,
          baselineP95: base,
          currentP95: cur.p95,
          pctIncrease: pct,
          budget: cur.budget,
        });
      }
    };

    for (const s of DMX_STAGES) check(s, stats.stages[s]);
    check('total', stats.total);
    return out;
  }

  /** Full report (snapshot) — safe to call from tests. */
  report(): HarnessReport {
    const s = this._stats();
    return { ...s, regressions: this.getRegressions() };
  }

  /** Print regressions + summary to console. Returns count of regressions. */
  logRegressions(): number {
    const r = this.getRegressions();
    if (r.length === 0) {
      logger.info('[DMX timing] no regressions vs baseline');
      return 0;
    }
    for (const reg of r) {
      logger.warn(
        `[DMX timing] regression in "${reg.stage}": p95 ${reg.currentP95.toFixed(2)}ms ` +
        `vs baseline ${reg.baselineP95.toFixed(2)}ms ` +
        `(+${(reg.pctIncrease * 100).toFixed(1)}%, budget ${reg.budget}ms)`
      );
    }
    return r.length;
  }

  /** Reset all recorded frames and counters. Keeps budgets + baseline. */
  reset(): void {
    this._framesRecorded = 0;
    this._ringIndex = 0;
    this._activeOpen = false;
    this._lastWarnAt = 0;
    this._suppressedWarns = 0;
    for (const r of this._ring) {
      r.id = -1;
      r.totalMs = NaN;
      r.totalBreach = false;
      r.breaches.length = 0;
      for (const s of DMX_STAGES) { r.marks[s] = NaN; r.durations[s] = NaN; }
    }
  }

  /** Test hook — fired after each commit. */
  _setOnCommit(fn: ((r: Readonly<FrameRecord>) => void) | null): void {
    this._onCommit = fn;
  }

  /** Direct ring-buffer view (read-only). For tests/debug. */
  _getRecords(): readonly FrameRecord[] {
    if (this._framesRecorded < RING_SIZE) {
      return this._ring.slice(0, this._framesRecorded);
    }
    // Return chronologically ordered window
    return [...this._ring.slice(this._ringIndex), ...this._ring.slice(0, this._ringIndex)];
  }

  // ── Internals ────────────────────────────────────────────────────
  private _stats(): Omit<HarnessReport, 'regressions'> {
    const records = this._getRecords();
    const stages = {} as Record<DMXStage, StageStats>;
    for (const s of DMX_STAGES) {
      stages[s] = this._statsFor(records, r => r.durations[s], this._budgets[s]);
    }
    const total = this._statsFor(records, r => r.totalMs, this._budgets.total);
    return {
      enabled: this._enabled,
      framesRecorded: this._framesRecorded,
      windowSize: records.length,
      stages,
      total,
    };
  }

  private _statsFor(
    records: readonly FrameRecord[],
    pick: (r: FrameRecord) => number,
    budget: number,
  ): StageStats {
    // Collect finite samples (avoid GC on hot path: only called from report()).
    const samples: number[] = [];
    let breaches = 0;
    for (const r of records) {
      const v = pick(r);
      if (Number.isFinite(v)) {
        samples.push(v);
        if (v > budget) breaches++;
      }
    }
    if (samples.length === 0) {
      return { count: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0, budget, breachRate: 0 };
    }
    samples.sort((a, b) => a - b);
    const sum = samples.reduce((a, b) => a + b, 0);
    return {
      count: samples.length,
      mean: sum / samples.length,
      p50: samples[Math.floor(samples.length * 0.5)],
      p95: samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))],
      p99: samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.99))],
      max: samples[samples.length - 1],
      budget,
      breachRate: breaches / samples.length,
    };
  }

  private _maybeWarn(rec: Readonly<FrameRecord>): void {
    const now = performance.now();
    if (now - this._lastWarnAt < WARN_RATE_LIMIT_MS) {
      this._suppressedWarns++;
      return;
    }
    const skipped = this._suppressedWarns;
    this._lastWarnAt = now;
    this._suppressedWarns = 0;

    const parts: string[] = [];
    for (const s of rec.breaches) {
      parts.push(`${s}=${rec.durations[s].toFixed(2)}ms (>${this._budgets[s]}ms)`);
    }
    if (rec.totalBreach) parts.push(`total=${rec.totalMs.toFixed(2)}ms (>${this._budgets.total}ms)`);
    const skippedNote = skipped > 0 ? ` (+${skipped} suppressed)` : '';
    logger.warn(`[DMX timing] frame #${rec.id} budget breach: ${parts.join(', ')}${skippedNote}`);
  }
}

export const dmxTimingHarness = new DMXTimingHarness();
export { DMXTimingHarness };
