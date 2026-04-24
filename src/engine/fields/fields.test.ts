/**
 * Tests for src/engine/fields/.
 * Covers: vec3 math invariants, density semantics, Poisson min-distance,
 *         blend continuity, and deterministic seeding.
 */
import { describe, it, expect } from 'vitest';
import {
  add, sub, scale, dot, normalize, length, distance,
  coneBeamField, gaussianClusterField, sphereShellField,
  combineFields, blendFields, mirrorField,
  importanceSample, poissonDiskSample,
  applySymmetry, applyRotationalSymmetry,
  attractToCenter,
  vec3, type Bounds,
} from './index';

const BOUNDS: Bounds = { min: vec3(-50, -50, -50), max: vec3(50, 50, 50) };

describe('vec3 math', () => {
  it('add / sub are inverses', () => {
    const a = vec3(1, 2, 3);
    const b = vec3(4, 5, 6);
    expect(sub(add(a, b), b)).toEqual(a);
  });

  it('dot of orthogonal vectors is 0', () => {
    expect(dot(vec3(1, 0, 0), vec3(0, 1, 0))).toBe(0);
  });

  it('normalize produces unit length (or zero for zero vector)', () => {
    const n = normalize(vec3(3, 4, 0));
    expect(length(n)).toBeCloseTo(1, 6);
    expect(normalize(vec3(0, 0, 0))).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('scale is linear', () => {
    expect(scale(vec3(1, 2, 3), 2)).toEqual({ x: 2, y: 4, z: 6 });
  });
});

describe('coneBeamField', () => {
  const beam = coneBeamField(vec3(0, 0, 0), vec3(0, 1, 0), Math.PI / 6);

  it('density = 0 outside the cone', () => {
    expect(beam.density(vec3(50, 0, 0))).toBe(0);
    expect(beam.density(vec3(0, -10, 0))).toBe(0);
  });

  it('density > 0 inside the cone', () => {
    expect(beam.density(vec3(0, 10, 0))).toBeGreaterThan(0);
  });

  it('density falls off with distance along the axis', () => {
    const near = beam.density(vec3(0, 1, 0));
    const far = beam.density(vec3(0, 30, 0));
    expect(near).toBeGreaterThan(far);
  });
});

describe('gaussianClusterField', () => {
  const g = gaussianClusterField(vec3(0, 0, 0), 5);

  it('peaks at center', () => {
    const center = g.density(vec3(0, 0, 0));
    const offset = g.density(vec3(5, 0, 0));
    expect(center).toBeGreaterThan(offset);
  });

  it('approaches 0 far from center', () => {
    expect(g.density(vec3(100, 100, 100))).toBeLessThan(1e-10);
  });
});

describe('sphereShellField', () => {
  const shell = sphereShellField(vec3(0, 0, 0), 10, 1);

  it('peaks near radius', () => {
    const onShell = shell.density(vec3(10, 0, 0));
    const inside = shell.density(vec3(0, 0, 0));
    const outside = shell.density(vec3(20, 0, 0));
    expect(onShell).toBeGreaterThan(inside);
    expect(onShell).toBeGreaterThan(outside);
  });
});

describe('combineFields', () => {
  it('density is additive', () => {
    const a = gaussianClusterField(vec3(0, 0, 0), 5);
    const b = gaussianClusterField(vec3(10, 0, 0), 5);
    const c = combineFields([a, b]);
    const p = vec3(5, 0, 0);
    expect(c.density(p)).toBeCloseTo(a.density(p) + b.density(p), 6);
  });

  it('handles empty array gracefully', () => {
    const c = combineFields([]);
    expect(c.density(vec3(1, 2, 3))).toBe(0);
  });
});

describe('blendFields', () => {
  const a = gaussianClusterField(vec3(0, 0, 0), 5);
  const b = gaussianClusterField(vec3(20, 0, 0), 5);

  it('t=0 returns a only', () => {
    const blended = blendFields(a, b, 0);
    const p = vec3(0, 0, 0);
    expect(blended.density(p)).toBeCloseTo(a.density(p), 6);
  });

  it('t=1 returns b only', () => {
    const blended = blendFields(a, b, 1);
    const p = vec3(20, 0, 0);
    expect(blended.density(p)).toBeCloseTo(b.density(p), 6);
  });

  it('t=0.5 is exact midpoint', () => {
    const blended = blendFields(a, b, 0.5);
    const p = vec3(10, 0, 0);
    expect(blended.density(p)).toBeCloseTo((a.density(p) + b.density(p)) * 0.5, 6);
  });

  it('clamps t outside [0,1]', () => {
    const blended = blendFields(a, b, 2);
    const p = vec3(20, 0, 0);
    // Behaves like t=1.
    expect(blended.density(p)).toBeCloseTo(b.density(p), 6);
  });
});

describe('mirrorField', () => {
  const half = gaussianClusterField(vec3(10, 0, 0), 5);
  const mirrored = mirrorField(half, 'x');

  it('density at -x equals density at +x', () => {
    expect(mirrored.density(vec3(-10, 0, 0))).toBeCloseTo(mirrored.density(vec3(10, 0, 0)), 6);
  });
});

describe('importanceSample', () => {
  const field = gaussianClusterField(vec3(0, 0, 0), 10);

  it('returns deterministic output for same seed', () => {
    const a = importanceSample(field, { count: 50, bounds: BOUNDS, seed: 42 });
    const b = importanceSample(field, { count: 50, bounds: BOUNDS, seed: 42 });
    expect(a).toEqual(b);
  });

  it('differs for different seeds', () => {
    const a = importanceSample(field, { count: 50, bounds: BOUNDS, seed: 1 });
    const b = importanceSample(field, { count: 50, bounds: BOUNDS, seed: 2 });
    expect(a).not.toEqual(b);
  });

  it('points cluster around the density peak', () => {
    const samples = importanceSample(field, { count: 200, bounds: BOUNDS, seed: 7 });
    const meanDist = samples.reduce((s, x) => s + length(x.position), 0) / samples.length;
    expect(meanDist).toBeLessThan(20); // most points should be within 2 sigma
  });
});

describe('poissonDiskSample', () => {
  const field = gaussianClusterField(vec3(0, 0, 0), 20);

  it('every pair of points satisfies min distance', () => {
    const samples = poissonDiskSample(field, {
      count: 100,
      bounds: BOUNDS,
      minDistance: 3,
      seed: 11,
    });
    for (let i = 0; i < samples.length; i++) {
      for (let j = i + 1; j < samples.length; j++) {
        expect(distance(samples[i].position, samples[j].position)).toBeGreaterThanOrEqual(3 - 1e-9);
      }
    }
  });

  it('respects density (no points where density is 0)', () => {
    const cone = coneBeamField(vec3(0, 0, 0), vec3(0, 1, 0), Math.PI / 12);
    const samples = poissonDiskSample(cone, { count: 50, bounds: BOUNDS, minDistance: 2, seed: 3 });
    for (const s of samples) {
      expect(cone.density(s.position)).toBeGreaterThan(0);
    }
  });
});

describe('applySymmetry / applyRotationalSymmetry', () => {
  it('mirror doubles point count', () => {
    const pts = [vec3(1, 2, 3), vec3(4, 5, 6)];
    expect(applySymmetry(pts, 'x')).toHaveLength(4);
  });

  it('rotational n=4 quadruples count', () => {
    const pts = [vec3(1, 0, 0)];
    const out = applyRotationalSymmetry(pts, 4);
    expect(out).toHaveLength(4);
    // The four points should lie on the unit circle around Y axis.
    for (const p of out) {
      expect(Math.sqrt(p.x * p.x + p.z * p.z)).toBeCloseTo(1, 6);
    }
  });
});

describe('attractToCenter', () => {
  it('strength=1 collapses to center', () => {
    const pts = [vec3(10, 0, 0), vec3(0, 5, 0)];
    const out = attractToCenter(pts, vec3(0, 0, 0), 1);
    for (const p of out) {
      expect(p.x).toBeCloseTo(0, 6);
      expect(p.y).toBeCloseTo(0, 6);
      expect(p.z).toBeCloseTo(0, 6);
    }
  });

  it('strength=0 is identity', () => {
    const pts = [vec3(10, 0, 0)];
    expect(attractToCenter(pts, vec3(0, 0, 0), 0)).toEqual(pts);
  });
});
