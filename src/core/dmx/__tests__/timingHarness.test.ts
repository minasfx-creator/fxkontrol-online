/**
 * DMX Timing Harness — unit tests
 *
 * Covers: ring buffer, budgets, regression detection, no-op disabled mode,
 * and abort path. Console output asserted via vi.spyOn(console, 'warn').
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  DMXTimingHarness,
  DEFAULT_BUDGETS,
  DMX_STAGES,
  type DMXStage,
} from '../timingHarness';

function frame(h: DMXTimingHarness, durations: Partial<Record<DMXStage, number>>, base = 0) {
  h.begin();
  let t = base;
  for (const s of DMX_STAGES) {
    const d = durations[s];
    if (d === undefined) continue;
    t += d;
    h.mark(s, t);
  }
  return h.commit();
}

describe('DMXTimingHarness — disabled by default', () => {
  it('mark/commit/begin are no-ops when disabled', () => {
    const h = new DMXTimingHarness();
    expect(h.isEnabled()).toBe(false);
    expect(h.begin()).toBe(-1);
    h.mark('schedule');
    h.mark('transport');
    expect(h.commit()).toBeNull();
    expect(h.report().framesRecorded).toBe(0);
  });
});

describe('DMXTimingHarness — recording', () => {
  let h: DMXTimingHarness;
  beforeEach(() => { h = new DMXTimingHarness(); h.enable(); });

  it('records per-stage durations as deltas between marks', () => {
    const rec = frame(h, { schedule: 0, dispatch: 0.5, encode: 1.5, transport: 5, ack: 2 });
    expect(rec).not.toBeNull();
    expect(rec!.durations.schedule).toBe(0);
    expect(rec!.durations.dispatch).toBeCloseTo(0.5, 5);
    expect(rec!.durations.encode).toBeCloseTo(1.5, 5);
    expect(rec!.durations.transport).toBeCloseTo(5, 5);
    expect(rec!.durations.ack).toBeCloseTo(2, 5);
    expect(rec!.totalMs).toBeCloseTo(9, 5);
    expect(rec!.breaches).toEqual([]);
    expect(rec!.totalBreach).toBe(false);
  });

  it('flags per-stage breaches when over budget', () => {
    h.setBudgets({ encode: 1, transport: 4 });
    const rec = frame(h, { schedule: 0, dispatch: 0, encode: 5, transport: 10, ack: 0 });
    expect(rec!.breaches).toEqual(['encode', 'transport']);
  });

  it('flags total breach against budgets.total', () => {
    h.setBudgets({ total: 5 });
    const rec = frame(h, { schedule: 0, dispatch: 0, encode: 0, transport: 10, ack: 0 });
    expect(rec!.totalBreach).toBe(true);
  });

  it('handles missing optional stages (e.g., no ack) without NaN total', () => {
    const rec = frame(h, { schedule: 0, dispatch: 1, encode: 1, transport: 1 });
    expect(Number.isFinite(rec!.totalMs)).toBe(true);
    expect(rec!.totalMs).toBeCloseTo(3, 5);
    expect(Number.isNaN(rec!.durations.ack)).toBe(true);
  });

  it('abort() drops the in-flight frame', () => {
    h.begin(); h.mark('schedule'); h.mark('encode'); h.abort();
    expect(h.commit()).toBeNull();
    expect(h.report().framesRecorded).toBe(0);
  });
});

describe('DMXTimingHarness — ring buffer + stats', () => {
  let h: DMXTimingHarness;
  beforeEach(() => { h = new DMXTimingHarness(); h.enable(); });

  it('caps window at RING_SIZE (256) but tracks total', () => {
    for (let i = 0; i < 300; i++) {
      frame(h, { schedule: 0, transport: 5 });
    }
    const r = h.report();
    expect(r.framesRecorded).toBe(300);
    expect(r.windowSize).toBe(256);
  });

  it('computes p50/p95/max for transport stage', () => {
    // 100 frames where transport duration ramps 1..100 ms
    for (let i = 1; i <= 100; i++) frame(h, { schedule: 0, transport: i });
    const t = h.report().stages.transport;
    expect(t.count).toBe(100);
    expect(t.max).toBe(100);
    expect(t.p50).toBeGreaterThanOrEqual(50);
    expect(t.p50).toBeLessThanOrEqual(51);
    expect(t.p95).toBeGreaterThanOrEqual(95);
  });

  it('breachRate reflects fraction over budget', () => {
    h.setBudgets({ transport: 50 });
    for (let i = 1; i <= 100; i++) frame(h, { schedule: 0, transport: i });
    const t = h.report().stages.transport;
    // values 51..100 = 50 breaches out of 100
    expect(t.breachRate).toBeCloseTo(0.5, 2);
  });
});

describe('DMXTimingHarness — regression detection', () => {
  let h: DMXTimingHarness;
  beforeEach(() => { h = new DMXTimingHarness(); h.enable(); });

  it('reports no regressions without baseline', () => {
    for (let i = 0; i < 32; i++) frame(h, { schedule: 0, transport: 5 });
    expect(h.getRegressions()).toEqual([]);
  });

  it('detects >20% p95 increase on a stage', () => {
    // Warmup: transport p95 ≈ 5ms
    for (let i = 0; i < 64; i++) frame(h, { schedule: 0, transport: 5 });
    h.captureBaseline();
    h.reset();
    // Regression: transport p95 ≈ 10ms (+100%)
    for (let i = 0; i < 64; i++) frame(h, { schedule: 0, transport: 10 });
    const regs = h.getRegressions();
    const t = regs.find(r => r.stage === 'transport');
    expect(t).toBeDefined();
    expect(t!.pctIncrease).toBeGreaterThan(0.2);
  });

  it('does not flag <20% drift as regression', () => {
    for (let i = 0; i < 64; i++) frame(h, { schedule: 0, transport: 5 });
    h.captureBaseline();
    h.reset();
    for (let i = 0; i < 64; i++) frame(h, { schedule: 0, transport: 5.5 }); // +10%
    expect(h.getRegressions()).toEqual([]);
  });

  it('skips regression check below 16-sample minimum', () => {
    for (let i = 0; i < 32; i++) frame(h, { schedule: 0, transport: 5 });
    h.captureBaseline();
    h.reset();
    for (let i = 0; i < 8; i++) frame(h, { schedule: 0, transport: 100 });
    expect(h.getRegressions()).toEqual([]);
  });

  it('setBaseline() accepts manual values (e.g. CI artifact)', () => {
    h.setBaseline({ transport: 5, total: 8 });
    for (let i = 0; i < 64; i++) frame(h, { schedule: 0, transport: 12 });
    const regs = h.getRegressions();
    expect(regs.some(r => r.stage === 'transport')).toBe(true);
  });
});

describe('DMXTimingHarness — console reporting', () => {
  let h: DMXTimingHarness;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    h = new DMXTimingHarness();
    h.enable();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warnSpy.mockRestore());

  it('warns on budget breach (rate-limited)', () => {
    h.setBudgets({ transport: 1 });
    frame(h, { schedule: 0, transport: 50 });
    expect(warnSpy).toHaveBeenCalled();
    const msg = String(warnSpy.mock.calls[0]?.[0] ?? '');
    expect(msg).toContain('DMX timing');
    expect(msg).toContain('transport');
  });

  it('logRegressions() emits one warn per regression', () => {
    for (let i = 0; i < 64; i++) frame(h, { schedule: 0, transport: 5 });
    h.captureBaseline();
    h.reset();
    warnSpy.mockClear();
    for (let i = 0; i < 64; i++) frame(h, { schedule: 0, transport: 20 });
    const n = h.logRegressions();
    expect(n).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalledTimes(n);
  });
});

describe('DMXTimingHarness — defaults', () => {
  it('default budgets fit within one DMX512 frame at 44Hz (~22.7ms)', () => {
    expect(DEFAULT_BUDGETS.total).toBeLessThanOrEqual(22.7);
    const sumStages =
      DEFAULT_BUDGETS.schedule +
      DEFAULT_BUDGETS.dispatch +
      DEFAULT_BUDGETS.encode +
      DEFAULT_BUDGETS.transport;
    // schedule+dispatch+encode+transport must fit even without ack
    expect(sumStages).toBeLessThanOrEqual(DEFAULT_BUDGETS.total);
  });
});
