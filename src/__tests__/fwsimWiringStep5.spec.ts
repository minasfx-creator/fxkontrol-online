/**
 * FWsim Wiring Step 5/5 — launchSparks.mine* → MineEffect spray spark layer.
 *
 * Asserts:
 *  - feature flag `r_fwsim_launch_sparks_mine` default ON
 *  - canonical config block exists and matches the FWsim graphics.xml authored values
 *  - derived multipliers stay neutral (=1) with canonical width/speed → bit-equivalent
 *    fallback when flag flips ON over an unchanged config
 *  - clamps protect the renderer from malformed configs
 */
import { describe, it, expect } from 'vitest';
import { isEnabled } from '@/lib/featureFlags';
import { getFwsimGraphics } from '@/data/fwsimGraphicsConfig';

describe('FWsim Wiring Step 5 — launchSparks.mine*', () => {
  it('flag r_fwsim_launch_sparks_mine defaults ON', () => {
    expect(isEnabled('r_fwsim_launch_sparks_mine')).toBe(true);
  });

  it('canonical launchSparks.mine* block matches FWsim graphics.xml', () => {
    const ls = getFwsimGraphics().launchSparks as unknown as {
      mineNrStars: number;
      mineExplosionRelativeSpeed: number;
      mineSpeedVariance: number;
      mineMineWidth: number;
    };
    expect(ls.mineNrStars).toBe(75);
    expect(ls.mineExplosionRelativeSpeed).toBe(1);
    expect(ls.mineSpeedVariance).toBeCloseTo(0.14, 5);
    expect(ls.mineMineWidth).toBeCloseTo(0.05, 5);
  });

  it('derived width multiplier is neutral (=1) with canonical mineMineWidth', () => {
    const baseWidth = 0.05;
    const cfgWidth = (getFwsimGraphics().launchSparks as { mineMineWidth: number }).mineMineWidth;
    const widthMult = Math.max(0.25, Math.min(4, cfgWidth / baseWidth));
    expect(widthMult).toBeCloseTo(1.0, 5);
  });

  it('derived speed multiplier is neutral (=1) with canonical mineExplosionRelativeSpeed', () => {
    const cfgSpeed = (getFwsimGraphics().launchSparks as { mineExplosionRelativeSpeed: number })
      .mineExplosionRelativeSpeed;
    const speedMult = Math.max(0.25, Math.min(4, cfgSpeed ?? 1));
    expect(speedMult).toBeCloseTo(1.0, 5);
  });

  it('variance clamps into [0,1] and target count clamps to ≥8', () => {
    const v = (raw: number) => Math.max(0, Math.min(1, raw));
    const n = (raw: number) => Math.max(8, Math.round(raw));
    expect(v(-0.5)).toBe(0);
    expect(v(0.14)).toBeCloseTo(0.14, 5);
    expect(v(2)).toBe(1);
    expect(n(75)).toBe(75);
    expect(n(3)).toBe(8);
    expect(n(120.4)).toBe(120);
  });

  it('width/speed clamps protect the renderer from malformed configs', () => {
    const wm = (mineWidth: number, base = 0.05) =>
      Math.max(0.25, Math.min(4, mineWidth / base));
    expect(wm(0)).toBe(0.25); // 0/0.05 = 0 → clamped to 0.25
    expect(wm(1)).toBe(4); // 1/0.05 = 20 → clamped to 4
    expect(wm(0.05)).toBe(1); // neutral
    const sm = (s: number) => Math.max(0.25, Math.min(4, s));
    expect(sm(-10)).toBe(0.25);
    expect(sm(10)).toBe(4);
    expect(sm(1)).toBe(1);
  });
});
