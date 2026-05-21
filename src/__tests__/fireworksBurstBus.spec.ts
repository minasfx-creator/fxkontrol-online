import { describe, it, expect, beforeEach } from 'vitest';
import { fireworksBurstBus } from '@/render_ultra/fireworks/fireworksBurstBus';
import { capsForTier } from '@/render_ultra/fireworks/fireworksTierConfig';

describe('fireworksBurstBus', () => {
  beforeEach(() => fireworksBurstBus._clear());

  it('delivers burst to subscribers', () => {
    const seen: any[] = [];
    const off = fireworksBurstBus.on((r) => seen.push(r));
    fireworksBurstBus.fire({ position: [0, 10, 0], color: [1, 0.4, 0.1], intensity: 1.2, cueId: 'c1' });
    expect(seen).toHaveLength(1);
    expect(seen[0].cueId).toBe('c1');
    off();
    fireworksBurstBus.fire({ position: [1, 1, 1] });
    expect(seen).toHaveLength(1);
  });

  it('swallows listener errors so visual layer never breaks safety path', () => {
    fireworksBurstBus.on(() => { throw new Error('boom'); });
    expect(() => fireworksBurstBus.fire({ position: [0, 0, 0] })).not.toThrow();
  });

  it('multiple subscribers all receive', () => {
    let a = 0, b = 0;
    fireworksBurstBus.on(() => a++);
    fireworksBurstBus.on(() => b++);
    fireworksBurstBus.fire({ position: [0, 0, 0] });
    fireworksBurstBus.fire({ position: [0, 0, 0] });
    expect(a).toBe(2); expect(b).toBe(2);
  });
});

describe('fireworksTierConfig', () => {
  it('eco disables trails + smoke', () => {
    const c = capsForTier('eco');
    expect(c.trails).toBe(false);
    expect(c.smokeCount).toBe(0);
    expect(c.particleCount).toBeLessThan(20_000);
  });
  it('cinema > balanced > eco in particle budget', () => {
    expect(capsForTier('cinema').particleCount).toBeGreaterThan(capsForTier('balanced').particleCount);
    expect(capsForTier('balanced').particleCount).toBeGreaterThan(capsForTier('eco').particleCount);
  });
  it('burstIntensityScale monotonically decreases cinema → balanced → eco', () => {
    expect(capsForTier('cinema').burstIntensityScale).toBe(1);
    expect(capsForTier('balanced').burstIntensityScale).toBeLessThan(1);
    expect(capsForTier('eco').burstIntensityScale).toBeLessThan(capsForTier('balanced').burstIntensityScale);
  });
  it('maxParticlesPerBurst respects tier hierarchy', () => {
    expect(capsForTier('cinema').maxParticlesPerBurst).toBeGreaterThan(capsForTier('balanced').maxParticlesPerBurst);
    expect(capsForTier('balanced').maxParticlesPerBurst).toBeGreaterThan(capsForTier('eco').maxParticlesPerBurst);
  });
  it('eco bans smoke per-burst even if a burst is requested', () => {
    expect(capsForTier('eco').maxSmokePerBurst).toBe(0);
  });
});
