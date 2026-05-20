import { describe, it, expect } from 'vitest';
import { thermalRGB, emberTemperature, emberRGB } from '@/render_ultra/fireworks/thermalGradient';
import { createSparkPool, emitSparks, stepSparks } from '@/render_ultra/fireworks/sparkChildEmitter';
import { renderQualityCaps } from '@/lib/featureFlags';

describe('thermalGradient', () => {
  it('cold edge ≈ deep red', () => {
    const c = thermalRGB(1500);
    expect(c[0]).toBeGreaterThan(c[1]);
    expect(c[1]).toBeGreaterThan(c[2]);
  });

  it('hot edge ≈ cool white/blue', () => {
    const c = thermalRGB(9500);
    expect(c[2]).toBeGreaterThanOrEqual(c[0]);
  });

  it('monotone gradient between stops', () => {
    const c1 = thermalRGB(2000);
    const c2 = thermalRGB(2500);
    expect(c2[1]).toBeGreaterThan(c1[1]);
  });

  it('emberTemperature cools across life', () => {
    expect(emberTemperature(0)).toBeGreaterThan(emberTemperature(0.5));
    expect(emberTemperature(0.5)).toBeGreaterThan(emberTemperature(1));
  });

  it('emberRGB roundtrips through thermal LUT', () => {
    const a = emberRGB(0.1);
    const b = emberRGB(0.9);
    // young (hot) ember is brighter on green/blue than aged (cool) one
    expect(a[1] + a[2]).toBeGreaterThan(b[1] + b[2]);
  });
});

describe('sparkChildEmitter', () => {
  let rng: () => number;
  beforeEachIdx();
  function beforeEachIdx() {
    let i = 0;
    const seq = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.05, 0.15, 0.25, 0.35, 0.45];
    rng = () => seq[(i++) % seq.length];
  }

  it('emits up to N sparks and respects capacity', () => {
    const p = createSparkPool(4);
    const n = emitSparks(p, { px: 0, py: 10, pz: 0, vx: 1, vy: 0, vz: 0, n: 10, rng });
    expect(n).toBe(4);
    expect(p.count).toBe(4);
  });

  it('inherits a fraction of parent velocity', () => {
    const p = createSparkPool(2);
    emitSparks(p, { px: 0, py: 0, pz: 0, vx: 10, vy: 0, vz: 0, n: 2, inheritFrac: 0.5, scatterSpeed: 0, rng: () => 0.5 });
    expect(p.velX[0]).toBeCloseTo(5, 5);
  });

  it('stepSparks decays life and compacts dead slots', () => {
    const p = createSparkPool(3);
    emitSparks(p, { px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0, n: 3, lifetimeSec: 0.1, rng: () => 0.5 });
    expect(p.count).toBe(3);
    stepSparks(p, 0.2);
    expect(p.count).toBe(0);
  });

  it('stepSparks applies gravity', () => {
    const p = createSparkPool(1);
    emitSparks(p, { px: 0, py: 10, pz: 0, vx: 0, vy: 0, vz: 0, n: 1, scatterSpeed: 0, lifetimeSec: 5, rng: () => 0.5 });
    const y0 = p.posY[0];
    stepSparks(p, 0.5);
    expect(p.posY[0]).toBeLessThan(y0);
  });
});

describe('renderQualityCaps', () => {
  it('cinema caps are strictly higher than balanced and eco', () => {
    const c = renderQualityCaps('cinema');
    const b = renderQualityCaps('balanced');
    const e = renderQualityCaps('eco');
    expect(c.maxBursts).toBeGreaterThan(b.maxBursts);
    expect(b.maxBursts).toBeGreaterThan(e.maxBursts);
    expect(c.maxParticles).toBeGreaterThan(b.maxParticles);
    expect(b.maxParticles).toBeGreaterThan(e.maxParticles);
    expect(e.smokeEnabled).toBe(false);
    expect(c.lensFlare).toBe(true);
  });
});
