/**
 * FWsim Wiring Step 4/5 — r_fwsim_bloom_weights
 *
 * Verifies that the calibration helper maps graphics.xml Bloom block
 * (amountOfBloom, upsamplingWeights, nrLevels, radiusForUpsampling) into
 * sane renderer-side multipliers and that the legacy bloom branch picks
 * them up via getFwsimBloomCalibration().
 */
import { describe, it, expect } from 'vitest';
import { isEnabled } from '@/lib/featureFlags';
import {
  getFwsimGraphics,
  getFwsimBloomCalibration,
} from '@/data/fwsimGraphicsConfig';

describe('FWsim Wiring Step 4 — bloom weights', () => {
  it('flag r_fwsim_bloom_weights defaults ON', () => {
    expect(isEnabled('r_fwsim_bloom_weights')).toBe(true);
  });

  it('graphics.xml Bloom block exposes canonical values', () => {
    const b = (getFwsimGraphics().bloom as unknown) as {
      amountOfBloom: number;
      upsamplingWeights: number[];
      nrLevels: number;
      radiusForUpsampling: number;
    };
    expect(b.amountOfBloom).toBeCloseTo(0.1, 5);
    expect(b.upsamplingWeights).toHaveLength(8);
    expect(b.nrLevels).toBe(10);
    expect(b.radiusForUpsampling).toBeCloseTo(1.5, 5);
  });

  it('calibration returns clamped, positive multipliers', () => {
    const cal = getFwsimBloomCalibration();
    expect(cal.intensityMul).toBeGreaterThanOrEqual(0.25);
    expect(cal.intensityMul).toBeLessThanOrEqual(4.0);
    expect(cal.levels).toBeGreaterThanOrEqual(1);
    expect(cal.levels).toBeLessThanOrEqual(16);
    expect(cal.radius).toBeGreaterThan(0);
  });

  it('weightsAvg matches arithmetic mean of upsamplingWeights', () => {
    const cal = getFwsimBloomCalibration();
    // weights = [1.3, 0.9, 0.4, 0.5, 0.7, 0.8, 1.2, 1.6] → avg 0.925
    expect(cal.weightsAvg).toBeCloseTo(0.925, 3);
  });

  it('intensityMul ≈ amount × weightsAvg × 10 (within clamp)', () => {
    const cal = getFwsimBloomCalibration();
    const expected = Math.max(0.25, Math.min(4.0, cal.amount * cal.weightsAvg * 10));
    expect(cal.intensityMul).toBeCloseTo(expected, 5);
  });

  it('nrLevels=10 → maps to HUGE-tier kernel (levels >= 10)', () => {
    const cal = getFwsimBloomCalibration();
    expect(cal.levels).toBeGreaterThanOrEqual(10);
  });

  it('calibration is stable across calls (memoised config)', () => {
    const a = getFwsimBloomCalibration();
    const b = getFwsimBloomCalibration();
    expect(a).toEqual(b);
  });
});
