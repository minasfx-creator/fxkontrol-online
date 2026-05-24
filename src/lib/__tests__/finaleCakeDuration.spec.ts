import { describe, it, expect } from 'vitest';
import {
  resolvePrefire,
  classifyCakeShape,
  computeCakeDuration,
  shotSeparation,
} from '../finaleCakeDuration';

/**
 * Pins the 8-case duration matrix from
 * docs/reference/finale-cake-candle-duration.md.
 */
describe('resolvePrefire', () => {
  it('PFCol wins over PFT and default lift', () => {
    expect(
      resolvePrefire({ pfCol: 0.7, pftFromVdl: 0.3, firstIsShell: true, firstShellLift: 2.0 }),
    ).toBe(0.7);
  });

  it('PFT used when no PFCol', () => {
    expect(
      resolvePrefire({ pftFromVdl: 0.0, firstIsShell: true, firstShellLift: 2.0 }),
    ).toBe(0.0);
  });

  it('default first-shell lift used when neither PFCol nor PFT', () => {
    expect(resolvePrefire({ firstIsShell: true, firstShellLift: 1.8 })).toBe(1.8);
  });

  it('zero default when first shot is not a shell and no PFT/PFCol', () => {
    expect(resolvePrefire({ firstIsShell: false })).toBe(0);
  });
});

describe('classifyCakeShape (8 cases)', () => {
  const base = { shotCount: 5, allAtOnce: false, firstIsShell: true, lastSameAsFirst: false };
  it.each([
    [{ ...base, shotCount: 1 }, 'single-shell'],
    [{ ...base, allAtOnce: false, lastSameAsFirst: false }, 'multi-seq-shell-diff'],
    [{ ...base, allAtOnce: false, lastSameAsFirst: true }, 'multi-seq-shell-same'],
    [{ ...base, allAtOnce: true, lastSameAsFirst: false }, 'multi-all-shell-diff'],
    [{ ...base, allAtOnce: true, lastSameAsFirst: true }, 'multi-all-shell-same'],
    [{ ...base, shotCount: 1, firstIsShell: false }, 'single-nonshell'],
    [{ ...base, firstIsShell: false, allAtOnce: false }, 'multi-seq-nonshell'],
    [{ ...base, firstIsShell: false, allAtOnce: true }, 'multi-all-nonshell'],
  ] as const)('%j → %s', (input, expected) => {
    expect(classifyCakeShape(input)).toBe(expected);
  });
});

describe('computeCakeDuration', () => {
  it('single-shell with prefire≥0.5: Expire − prefire', () => {
    const r = computeCakeDuration({
      shotCount: 1,
      allAtOnce: false,
      firstIsShell: true,
      lastIsShell: true,
      lastSameAsFirst: true,
      firstShellLift: 2.0,
      lastShellLift: 2.0,
      expireLastStars: 6.0,
      firstLaunchTime: 0,
      effectTimeLast: 0,
      prefire: { pfCol: 1.0, firstIsShell: true, firstShellLift: 2.0 },
    });
    expect(r.caseKey).toBe('single-shell');
    expect(r.prefireUsed).toBe(1.0);
    expect(r.duration).toBe(5.0); // 6.0 − 1.0
    expect(r.liftAdjusted).toBe(true);
  });

  it('single-shell with prefire<0.5: Expire − (prefire + lift)', () => {
    const r = computeCakeDuration({
      shotCount: 1,
      allAtOnce: false,
      firstIsShell: true,
      lastIsShell: true,
      lastSameAsFirst: true,
      firstShellLift: 2.0,
      lastShellLift: 2.0,
      expireLastStars: 6.0,
      firstLaunchTime: 0,
      effectTimeLast: 0,
      prefire: { pfCol: 0.0, firstIsShell: true, firstShellLift: 2.0 },
    });
    expect(r.duration).toBe(4.0); // 6.0 − (0.0 + 2.0)
    expect(r.liftAdjusted).toBe(false);
  });

  it('multi-seq-shell-diff: BreakTime(last) − LaunchTime(first)', () => {
    const r = computeCakeDuration({
      shotCount: 10,
      allAtOnce: false,
      firstIsShell: true,
      lastIsShell: true,
      lastSameAsFirst: false,
      firstShellLift: 2.0,
      lastShellLift: 2.2,
      expireLastStars: 12.0,
      firstLaunchTime: 0,
      effectTimeLast: 11.2, // launchLast + liftLast (unaffected by prefire)
      prefire: { pftFromVdl: 1.0, firstIsShell: true, firstShellLift: 2.0 },
    });
    expect(r.caseKey).toBe('multi-seq-shell-diff');
    expect(r.duration).toBe(11.2);
  });

  it('multi-all-shell-* → duration 0', () => {
    const r = computeCakeDuration({
      shotCount: 8,
      allAtOnce: true,
      firstIsShell: true,
      lastIsShell: true,
      lastSameAsFirst: true,
      firstShellLift: 2.0,
      lastShellLift: 2.0,
      expireLastStars: 8.0,
      firstLaunchTime: 0,
      effectTimeLast: 2.0,
      prefire: { firstIsShell: true, firstShellLift: 2.0 },
    });
    expect(r.caseKey).toBe('multi-all-shell-same');
    expect(r.duration).toBe(0);
  });

  it('single-nonshell: Expire − LaunchTime', () => {
    const r = computeCakeDuration({
      shotCount: 1,
      allAtOnce: false,
      firstIsShell: false,
      lastIsShell: false,
      lastSameAsFirst: true,
      expireLastStars: 3.5,
      firstLaunchTime: 0,
      effectTimeLast: 0,
      prefire: { firstIsShell: false },
    });
    expect(r.caseKey).toBe('single-nonshell');
    expect(r.duration).toBe(3.5);
    expect(r.prefireUsed).toBe(0);
  });

  it('multi-seq-nonshell: EffectTime(last) − LaunchTime(first)', () => {
    const r = computeCakeDuration({
      shotCount: 10,
      allAtOnce: false,
      firstIsShell: false,
      lastIsShell: false,
      lastSameAsFirst: true,
      expireLastStars: 9.0,
      firstLaunchTime: 0,
      effectTimeLast: 8.0,
      prefire: { firstIsShell: false },
    });
    expect(r.caseKey).toBe('multi-seq-nonshell');
    expect(r.duration).toBe(8.0);
  });

  it('multi-all-nonshell → duration 0', () => {
    const r = computeCakeDuration({
      shotCount: 20,
      allAtOnce: true,
      firstIsShell: false,
      lastIsShell: false,
      lastSameAsFirst: true,
      expireLastStars: 5.0,
      firstLaunchTime: 0,
      effectTimeLast: 0,
      prefire: { firstIsShell: false },
    });
    expect(r.caseKey).toBe('multi-all-nonshell');
    expect(r.duration).toBe(0);
  });
});

describe('shotSeparation', () => {
  it('subtracts lift when last is shell', () => {
    // Cake duration 10s, last lift 2.0s, 10 shots → (10−2)/(10−1) ≈ 0.888
    expect(shotSeparation({ cakeDuration: 10, lastShotLiftIfShell: 2.0, numberOfShots: 10 }))
      .toBeCloseTo(8 / 9, 6);
  });

  it('no lift subtraction when last is not a shell (pass 0)', () => {
    expect(shotSeparation({ cakeDuration: 9, lastShotLiftIfShell: 0, numberOfShots: 10 }))
      .toBe(1);
  });

  it('returns 0 for ≤1 shot', () => {
    expect(shotSeparation({ cakeDuration: 5, lastShotLiftIfShell: 0, numberOfShots: 1 })).toBe(0);
    expect(shotSeparation({ cakeDuration: 5, lastShotLiftIfShell: 0, numberOfShots: 0 })).toBe(0);
  });
});
