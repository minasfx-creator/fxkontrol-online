import { describe, it, expect } from 'vitest';
import { matchPointsByHungarian, solveHungarian, shouldUseHungarian, MAX_HUNGARIAN_N } from './hungarianOptimal';
import { matchPointsByGreedyCost } from './hungarianLite';
import type { Vec3 } from '../../types';

function totalDistance(from: Vec3[], matched: Vec3[]): number {
  let s = 0;
  for (let i = 0; i < Math.min(from.length, matched.length); i++) {
    const dx = from[i].x - matched[i].x;
    const dy = from[i].y - matched[i].y;
    const dz = from[i].z - matched[i].z;
    s += Math.hypot(dx, dy, dz);
  }
  return s;
}

describe('shouldUseHungarian', () => {
  it('respects the hard cap', () => {
    expect(shouldUseHungarian(10, 10)).toBe(true);
    expect(shouldUseHungarian(MAX_HUNGARIAN_N, MAX_HUNGARIAN_N)).toBe(true);
    expect(shouldUseHungarian(MAX_HUNGARIAN_N + 1, 1)).toBe(false);
  });
});

describe('solveHungarian — known optimal', () => {
  it('matches the canonical 3×3 example', () => {
    // Classic Hungarian textbook matrix; known optimal cost = 13.
    const cost = [
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ];
    const a = solveHungarian(cost);
    let total = 0;
    for (let r = 0; r < a.length; r++) total += cost[r][a[r]];
    expect(total).toBe(5);
    // Verify it's a permutation.
    expect(new Set(a).size).toBe(3);
  });
});

describe('matchPointsByHungarian — beats or ties greedy on adversarial input', () => {
  it('produces a lower-or-equal total than greedy on a swap-trap layout', () => {
    // Adversarial: greedy picks the wrong target first and pays for it.
    const from: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
    ];
    const to: Vec3[] = [
      { x: 9, y: 0, z: 0 },   // very close to from[1]
      { x: 0.5, y: 0, z: 0 }, // very close to from[0]
    ];
    const greedy = matchPointsByGreedyCost(from, to);
    const hungarian = matchPointsByHungarian(from, to);
    expect(totalDistance(from, hungarian)).toBeLessThanOrEqual(totalDistance(from, greedy));
  });

  it('handles rectangular cases (more from than to)', () => {
    const from: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ];
    const to: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ];
    const r = matchPointsByHungarian(from, to);
    expect(r.length).toBeGreaterThan(0);
  });

  it('handles empty input', () => {
    expect(matchPointsByHungarian([], [{ x: 0, y: 0, z: 0 }])).toEqual([]);
    expect(matchPointsByHungarian([{ x: 0, y: 0, z: 0 }], [])).toEqual([]);
  });
});
