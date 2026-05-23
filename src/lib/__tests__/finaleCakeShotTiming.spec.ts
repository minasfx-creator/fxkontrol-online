import { describe, it, expect } from 'vitest';
import { uniformShotSeparation, solveCakeRowTiming } from '../finaleCakeShotTiming';

/**
 * Pins the worked examples from
 * docs/reference/finale-cake-shot-timing.md.
 */
describe('uniformShotSeparation', () => {
  it('canonical Red Peony 10×25s 2.5 PFT → 2.5 s', () => {
    expect(uniformShotSeparation({
      cakeDuration: 25,
      lastShotLiftIfShell: 2.5,
      numberOfShots: 10,
    })).toBeCloseTo(2.5, 6);
  });

  it('non-shell last shot → pass 0 for lift', () => {
    expect(uniformShotSeparation({
      cakeDuration: 9,
      lastShotLiftIfShell: 0,
      numberOfShots: 10,
    })).toBeCloseTo(1.0, 6);
  });

  it('returns 0 when numberOfShots ≤ 1', () => {
    expect(uniformShotSeparation({ cakeDuration: 5, lastShotLiftIfShell: 0, numberOfShots: 1 })).toBe(0);
    expect(uniformShotSeparation({ cakeDuration: 5, lastShotLiftIfShell: 0, numberOfShots: 0 })).toBe(0);
  });
});

describe('solveCakeRowTiming — canonical 4-row example', () => {
  // 20 Shot 15.0s, 4 Rows:
  //   Rows 1,2,3 (aaaaa/STR/2.0)         ← row duration 2.0, delayBefore unknown for 2,3
  //   Row 4     (0.5/bbbbb/FNT)          ← all-at-once, explicit 0.5 delay
  // Last shot = popcorn crackle shell, default lift 2.5 s.
  // Expected: unknownDelay = 3.0 s (the two inter-row gaps before rows 2 and 3).
  const result = solveCakeRowTiming({
    cakeDuration: 15,
    lastShotLiftIfShell: 2.5,
    rows: [
      { duration: 2.0 },                  // row 1 — first row, no delayBefore
      { duration: 2.0 },                  // row 2 — delayBefore unknown
      { duration: 2.0 },                  // row 3 — delayBefore unknown
      { allAtOnce: true, delayBefore: 0.5 }, // row 4 — known 0.5 s, dur 0
    ],
  });

  it('timeFirstToLast = 12.5', () => {
    expect(result.timeFirstToLast).toBeCloseTo(12.5, 6);
  });

  it('knownSum = 6.5 (2+2+2+0+0.5)', () => {
    expect(result.knownSum).toBeCloseTo(6.5, 6);
  });

  it('unknownCount = 2 (delayBefore for rows 2 and 3)', () => {
    expect(result.unknownCount).toBe(2);
  });

  it('unknownDelay = 3.0 s', () => {
    expect(result.unknownDelay).toBeCloseTo(3.0, 6);
  });

  it('row 4 keeps its explicit 0.5 s gap, no slack', () => {
    expect(result.resolvedRows[3].delayBefore).toBeCloseTo(0.5, 6);
    expect(result.resolvedRows[3].delayBeforeWasUnknown).toBe(false);
    expect(result.slack).toBe(0);
  });

  it('first row delayBefore is always 0 (ignored)', () => {
    expect(result.resolvedRows[0].delayBefore).toBe(0);
    expect(result.resolvedRows[0].delayBeforeWasUnknown).toBe(false);
  });

  it('resolved rows sum (durations + inter-row gaps) = timeFirstToLast', () => {
    const total = result.resolvedRows.reduce(
      (acc, r) => acc + r.duration + r.delayBefore,
      0,
    );
    expect(total).toBeCloseTo(result.timeFirstToLast, 6);
  });
});

describe('solveCakeRowTiming — degenerate cases', () => {
  it('fully specified → unknownCount=0, slack reports residual', () => {
    const r = solveCakeRowTiming({
      cakeDuration: 10,
      lastShotLiftIfShell: 0,
      rows: [
        { duration: 2 },
        { duration: 2, delayBefore: 3 },
        { duration: 2, delayBefore: 1 },
      ],
    });
    expect(r.timeFirstToLast).toBe(10);
    expect(r.knownSum).toBe(10);
    expect(r.unknownCount).toBe(0);
    expect(r.unknownDelay).toBe(0);
    expect(r.slack).toBe(0);
  });

  it('over-specified → positive slack', () => {
    const r = solveCakeRowTiming({
      cakeDuration: 10,
      lastShotLiftIfShell: 0,
      rows: [
        { duration: 2 },
        { duration: 2, delayBefore: 2 },
        { duration: 2, delayBefore: 1 },
      ],
    });
    expect(r.slack).toBeCloseTo(1, 6);
  });

  it('all unknowns → distributes equally', () => {
    const r = solveCakeRowTiming({
      cakeDuration: 10,
      lastShotLiftIfShell: 0,
      rows: [{}, {}, {}], // 3 unknown durations + 2 unknown delays = 5 slots
    });
    expect(r.unknownCount).toBe(5);
    expect(r.unknownDelay).toBeCloseTo(2, 6);
    expect(r.resolvedRows.every(row => row.duration === 2 || row.delayBefore === 2 || row.delayBefore === 0)).toBe(true);
  });

  it('allAtOnce sugar equivalent to duration: 0', () => {
    const a = solveCakeRowTiming({
      cakeDuration: 5, lastShotLiftIfShell: 0,
      rows: [{ allAtOnce: true }, { allAtOnce: true, delayBefore: 5 }],
    });
    const b = solveCakeRowTiming({
      cakeDuration: 5, lastShotLiftIfShell: 0,
      rows: [{ duration: 0 }, { duration: 0, delayBefore: 5 }],
    });
    expect(a.unknownCount).toBe(b.unknownCount);
    expect(a.knownSum).toBe(b.knownSum);
  });
});
