/**
 * FWsim wiring step 1 — pin behaviour of r_fwsim_mine_calibration and
 * r_fwsim_smoke_texture as currently shipped (both ON by default).
 *
 * These tests cover the pure pieces that MineEffect.tsx consumes; the React
 * three-fiber render itself is exercised in /dev/effects-e2e visual harness.
 */
import { describe, it, expect } from 'vitest';
import { isEnabled } from '@/lib/featureFlags';
import { getFwsimGraphics, sampleCurve } from '@/data/fwsimGraphicsConfig';
import {
  FWSIM_SMOKE_URL,
  getFwsimSmokeTexture,
  disposeFwsimSmokeTexture,
} from '@/render/textures/fwsimSmokeTexture';

describe('FWsim wiring step 1', () => {
  it('flags default ON', () => {
    expect(isEnabled('r_fwsim_mine_calibration')).toBe(true);
    expect(isEnabled('r_fwsim_smoke_texture')).toBe(true);
  });

  it('mineFlame energy curve is monotonic and bounded', () => {
    const cfg = getFwsimGraphics().flashes.mineFlame;
    const curve = cfg.sizeDependingOnEnergy as unknown as ReadonlyArray<readonly [number, number]>;
    expect(curve.length).toBeGreaterThanOrEqual(2);
    let prevY = -Infinity;
    for (const [, y] of curve) {
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThanOrEqual(5);
      expect(y).toBeGreaterThanOrEqual(prevY);
      prevY = y;
    }
    expect(cfg.brightness).toBeGreaterThan(0);
    expect(cfg.duration).toBeGreaterThan(0);
  });

  it('sampleCurve clamps at edges and interpolates linearly', () => {
    const curve: ReadonlyArray<readonly [number, number]> = [[16, 0.2], [50, 1], [100, 1.5]];
    expect(sampleCurve(curve, 0)).toBe(0.2);
    expect(sampleCurve(curve, 200)).toBe(1.5);
    // midpoint 33 between [16,0.2] and [50,1] → y ≈ 0.2 + (1-0.2)*(33-16)/(50-16)
    const expected = 0.2 + 0.8 * (33 - 16) / (50 - 16);
    expect(sampleCurve(curve, 33)).toBeCloseTo(expected, 5);
  });

  it('caliber→energy mapping yields plausible size multiplier (caliber 1..6 inches)', () => {
    const curve = getFwsimGraphics().flashes.mineFlame
      .sizeDependingOnEnergy as unknown as ReadonlyArray<readonly [number, number]>;
    for (const caliber of [1, 2, 3, 4, 5, 6]) {
      const mm = Math.max(16, Math.min(100, caliber * 25.4));
      const mult = sampleCurve(curve, mm);
      expect(mult).toBeGreaterThan(0.1);
      expect(mult).toBeLessThan(3);
    }
  });

  it('FWSIM_SMOKE_URL points at the FWsim asset bundle', () => {
    expect(FWSIM_SMOKE_URL).toMatch(/smoke_with_alpha/);
  });

  it('getFwsimSmokeTexture is a memoized singleton', () => {
    const a = getFwsimSmokeTexture();
    const b = getFwsimSmokeTexture();
    expect(a).toBe(b);
    disposeFwsimSmokeTexture();
    const c = getFwsimSmokeTexture();
    expect(c).not.toBe(a);
    disposeFwsimSmokeTexture();
  });
});
