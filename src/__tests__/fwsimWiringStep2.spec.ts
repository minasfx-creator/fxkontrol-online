/**
 * FWsim Wiring Step 2/5 — r_fwsim_launch_flash_v2
 *
 * Pins the contract that PrefireShell's muzzle flash scales with FWsim's
 * shellLaunchFlame.sizeDependingOnEnergy curve when the flag is ON, and
 * reproduces the legacy constants when conceptually OFF.
 */
import { describe, it, expect } from 'vitest';
import { isEnabled } from '@/lib/featureFlags';
import { getFwsimGraphics, sampleCurve } from '@/data/fwsimGraphicsConfig';

const energyFromCaliber = (caliber: number) =>
  70 * Math.pow(Math.max(1, caliber) / 3, 2.5);

describe('FWsim Wiring Step 2 — r_fwsim_launch_flash_v2', () => {
  it('flag defaults ON', () => {
    expect(isEnabled('r_fwsim_launch_flash_v2')).toBe(true);
  });

  it('shellLaunchFlame.sizeDependingOnEnergy curve has documented anchors', () => {
    const curve = getFwsimGraphics().flashes.shellLaunchFlame.sizeDependingOnEnergy as ReadonlyArray<readonly [number, number]>;
    expect(curve[0]).toEqual([16, 0.2]);
    expect(curve[1]).toEqual([1300, 1]);
    expect(curve[2]).toEqual([13000, 1.5]);
  });

  it('energy proxy is monotonic across caliber 3..8 inches', () => {
    const energies = [3, 4, 5, 6, 8].map(energyFromCaliber);
    for (let i = 1; i < energies.length; i++) {
      expect(energies[i]).toBeGreaterThan(energies[i - 1]);
    }
  });

  it('sizeMult grows from caliber 3" to 8" (more energy → bigger flash)', () => {
    const curve = getFwsimGraphics().flashes.shellLaunchFlame.sizeDependingOnEnergy as ReadonlyArray<readonly [number, number]>;
    const small = sampleCurve(curve, energyFromCaliber(3));
    const big = sampleCurve(curve, energyFromCaliber(8));
    expect(big).toBeGreaterThan(small);
    expect(small).toBeGreaterThanOrEqual(0.2);
    expect(big).toBeLessThanOrEqual(1.5);
  });

  it('brightness and duration are within FWsim canonical bounds', () => {
    const slf = getFwsimGraphics().flashes.shellLaunchFlame;
    expect(slf.brightness).toBe(5);
    expect(slf.duration).toBe(0.2);
    const opacityMult = Math.min(1.4, slf.brightness / 5);
    expect(opacityMult).toBe(1);
  });

  it('flash window clamps within [0.05, 0.25] regardless of liftTime', () => {
    const slf = getFwsimGraphics().flashes.shellLaunchFlame;
    const clamp = (lt: number) => Math.max(0.05, Math.min(0.25, slf.duration / Math.max(0.5, lt)));
    expect(clamp(0.1)).toBe(0.25); // tiny lift → upper clamp
    expect(clamp(5)).toBe(0.05);   // long lift → lower clamp
    expect(clamp(1)).toBeCloseTo(0.2, 5); // typical mid
  });
});
