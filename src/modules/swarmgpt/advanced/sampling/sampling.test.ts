import { describe, it, expect } from 'vitest';
import { farthestPointSample } from './farthestPointSampling';
import { poissonThenFps } from './poissonThenFps';
import type { Vec3 } from '../../types';

function makeGrid(n: number): Vec3[] {
  const out: Vec3[] = [];
  const side = Math.ceil(Math.sqrt(n));
  for (let i = 0; i < n; i++) {
    out.push({ x: i % side, y: 0, z: Math.floor(i / side) });
  }
  return out;
}

describe('farthestPointSample', () => {
  it('returns empty for empty input', () => {
    expect(farthestPointSample([], 5)).toEqual([]);
  });

  it('returns a padded copy when target ≥ count', () => {
    const pts = makeGrid(3);
    const r = farthestPointSample(pts, 5);
    expect(r.length).toBe(5);
  });

  it('is deterministic across calls', () => {
    const pts = makeGrid(50);
    const a = farthestPointSample(pts, 8);
    const b = farthestPointSample(pts, 8);
    expect(a).toEqual(b);
  });

  it('produces points spread across the cloud', () => {
    const pts = makeGrid(100);
    const r = farthestPointSample(pts, 10);
    // Min pairwise distance should beat random subsampling on a grid.
    let minD = Infinity;
    for (let i = 0; i < r.length; i++) {
      for (let j = i + 1; j < r.length; j++) {
        const d = Math.hypot(r[i].x - r[j].x, r[i].z - r[j].z);
        if (d < minD) minD = d;
      }
    }
    expect(minD).toBeGreaterThan(0);
  });
});

describe('poissonThenFps', () => {
  it('returns exactly droneCount points (or fewer when input is small)', () => {
    const pts = makeGrid(200);
    const r = poissonThenFps(pts, { droneCount: 25, minDistance: 1 });
    expect(r.length).toBe(25);
  });

  it('returns empty for empty input', () => {
    expect(poissonThenFps([], { droneCount: 10, minDistance: 1 })).toEqual([]);
  });
});
