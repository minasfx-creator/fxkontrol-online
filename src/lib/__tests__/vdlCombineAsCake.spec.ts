import { describe, it, expect } from 'vitest';
import {
  checkCombineAsCakeLimitations,
  decideCakeSyntax,
  scoreSquareness,
  pickSquarestLayout,
  COMBINE_AS_CAKE_ANGLE_TOLERANCE_DEG,
  COMBINE_AS_CAKE_TIME_TOLERANCE_MS,
  type CombineCakeShot,
} from '../vdlCombineAsCake';

const shot = (over: Partial<CombineCakeShot> = {}): CombineCakeShot => ({
  size: '25mm',
  angleDeg: 0,
  timeMs: 0,
  vdl: 'Red Peony',
  ...over,
});

describe('vdlCombineAsCake — tolerances are canonical', () => {
  it('5° and 10ms', () => {
    expect(COMBINE_AS_CAKE_ANGLE_TOLERANCE_DEG).toBe(5);
    expect(COMBINE_AS_CAKE_TIME_TOLERANCE_MS).toBe(10);
  });
});

describe('checkCombineAsCakeLimitations', () => {
  it('passes empty selection', () => {
    expect(checkCombineAsCakeLimitations([])).toEqual({ ok: true, violations: [] });
  });

  it('passes uniform selection', () => {
    const r = checkCombineAsCakeLimitations([shot(), shot({ angleDeg: 15 })]);
    expect(r.ok).toBe(true);
  });

  it('flags mixed tube sizes', () => {
    const r = checkCombineAsCakeLimitations([shot(), shot({ size: '30mm' })]);
    expect(r.ok).toBe(false);
    expect(r.violations[0].code).toBe('mixed-tube-sizes');
    expect(r.violations[0].shotIndex).toBe(1);
  });

  it('flags non-side-to-side angles', () => {
    const r = checkCombineAsCakeLimitations([shot({ angleDeg: 120 })]);
    expect(r.violations.some((v) => v.code === 'non-side-to-side-angle')).toBe(true);
  });

  it('flags VDL containing "+" (peanut/multi-break)', () => {
    const r = checkCombineAsCakeLimitations([shot({ vdl: 'Red Peony + Blue Pistil' })]);
    expect(r.violations.some((v) => v.code === 'plus-sign-effect')).toBe(true);
  });

  it('reports multiple violations at once', () => {
    const r = checkCombineAsCakeLimitations([
      shot(),
      shot({ size: '30mm', angleDeg: 100, vdl: 'A+B' }),
    ]);
    expect(r.violations.length).toBe(3);
  });
});

describe('decideCakeSyntax', () => {
  it('forceExact short-circuits to exact', () => {
    expect(decideCakeSyntax([shot()], { forceExact: true })).toBe('exact');
  });

  it('single shot is standard', () => {
    expect(decideCakeSyntax([shot()])).toBe('standard');
  });

  it('uniform row + even angles → standard', () => {
    const shots: CombineCakeShot[] = [
      shot({ timeMs: 0, angleDeg: -30 }),
      shot({ timeMs: 100, angleDeg: -15 }),
      shot({ timeMs: 200, angleDeg: 0 }),
      shot({ timeMs: 300, angleDeg: 15 }),
      shot({ timeMs: 400, angleDeg: 30 }),
    ];
    expect(decideCakeSyntax(shots)).toBe('standard');
  });

  it('non-uniform intra-row delays beyond tolerance → exact (via custom tol)', () => {
    // With timeToleranceMs=2: gaps 5,2,1 → max-min=4 > 2 ⇒ exact.
    const shots: CombineCakeShot[] = [
      shot({ timeMs: 0 }),
      shot({ timeMs: 5 }),
      shot({ timeMs: 7 }),
      shot({ timeMs: 8 }),
    ];
    expect(decideCakeSyntax(shots, { timeToleranceMs: 2 })).toBe('exact');
  });

  it('irregular angle spacing → exact', () => {
    const shots: CombineCakeShot[] = [
      shot({ timeMs: 0, angleDeg: -30 }),
      shot({ timeMs: 5, angleDeg: -20 }),
      shot({ timeMs: 8, angleDeg: 25 }), // jump
      shot({ timeMs: 10, angleDeg: 30 }),
    ];
    expect(decideCakeSyntax(shots)).toBe('exact');
  });

  it('clusters into multiple rows when gap > timeTol', () => {
    const shots: CombineCakeShot[] = [
      shot({ timeMs: 0, angleDeg: -10 }),
      shot({ timeMs: 5, angleDeg: 10 }),
      // 500ms gap → new row
      shot({ timeMs: 505, angleDeg: -10 }),
      shot({ timeMs: 510, angleDeg: 10 }),
    ];
    expect(decideCakeSyntax(shots)).toBe('standard');
  });
});

describe('scoreSquareness / pickSquarestLayout', () => {
  it('square layout scores 0', () => {
    expect(scoreSquareness({ rows: 5, tubesPerRow: 5 })).toBe(0);
  });

  it('lopsided layout scores worse', () => {
    expect(scoreSquareness({ rows: 1, tubesPerRow: 10 })).toBeGreaterThan(
      scoreSquareness({ rows: 5, tubesPerRow: 2 }),
    );
  });

  it('picks most square-ish from candidates (stable tie)', () => {
    const best = pickSquarestLayout([
      { rows: 1, tubesPerRow: 10 },
      { rows: 2, tubesPerRow: 5 },
      { rows: 5, tubesPerRow: 2 }, // same score as {2,5}; first wins
    ]);
    expect(best).toEqual({ rows: 2, tubesPerRow: 5 });
  });

  it('returns null for empty candidates', () => {
    expect(pickSquarestLayout([])).toBeNull();
  });

  it('rejects invalid dimensions', () => {
    expect(scoreSquareness({ rows: 0, tubesPerRow: 5 })).toBe(Number.POSITIVE_INFINITY);
  });
});
