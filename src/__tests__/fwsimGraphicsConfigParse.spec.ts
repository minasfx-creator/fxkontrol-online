import { describe, it, expect } from 'vitest';
import {
  getFwsimGraphics,
  getFwsimPresetHex,
  sampleCurve,
} from '@/data/fwsimGraphicsConfig';

describe('fwsimGraphicsConfig — canonical FWsim tuning', () => {
  it('exposes 30 preset colors from graphics.xml', () => {
    const cfg = getFwsimGraphics();
    expect(Object.keys(cfg.presetColors).length).toBe(30);
    const palette = cfg.presetColors as Record<string, number[]>;
    expect(palette.Red).toEqual([255, 0, 15]);
    expect(palette.DeepPurple).toEqual([49, 1, 192]);
  });

  it('returns hex for known preset and null for unknown', () => {
    expect(getFwsimPresetHex('Red')).toBe('#ff000f');
    expect(getFwsimPresetHex('Gold')).toBe('#ffc878');
    expect(getFwsimPresetHex('UnknownColor')).toBeNull();
  });

  it('preserves canonical tonemapping (Contrast 1.7, HdrMax 16)', () => {
    const t = getFwsimGraphics().tonemapping;
    expect(t.contrast).toBeCloseTo(1.7);
    expect(t.hdrMax).toBe(16);
  });

  it('preserves canonical motion blur (1/35 shutter, 0.8 exposure correction)', () => {
    const mb = getFwsimGraphics().motionBlur;
    expect(mb.enabled).toBe(true);
    expect(mb.oneDividedByExposureTime).toBe(35);
    expect(mb.exposureCorrection).toBeCloseTo(0.8);
  });

  it('extracts 8 per-type star settings (XLarge…XXSmall + Sparks + FallingLeaves)', () => {
    const pts = getFwsimGraphics().perTypeStars as Record<string, { brightness: number }>;
    expect(Object.keys(pts).sort()).toEqual([
      'FallingLeaves', 'Large', 'Normal', 'Small', 'Sparks', 'XLarge', 'XSmall', 'XXSmall',
    ]);
    expect(pts.Normal.brightness).toBe(1);
    expect(pts.XXSmall.brightness).toBe(8);
  });

  it('extracts Bloom canonical: AmountOfBloom=0.1, NrLevels=10, 8 upsampling weights', () => {
    const b = getFwsimGraphics().bloom;
    expect(b.enabled).toBe(true);
    expect(b.amountOfBloom).toBeCloseTo(0.1);
    expect(b.nrLevels).toBe(10);
    expect(b.upsamplingWeights).toEqual([1.3, 0.9, 0.4, 0.5, 0.7, 0.8, 1.2, 1.6]);
    expect(b.algorithm).toBe('Raw');
  });

  it('extracts MineFlame curve with 3 datapoints (16→0.2, 50→1, 100→1.5)', () => {
    const mf = getFwsimGraphics().flashes.mineFlame!;
    expect(mf.duration).toBeCloseTo(0.15);
    expect(mf.brightness).toBe(2);
    expect(mf.sizeDependingOnEnergy).toEqual([[16, 0.2], [50, 1], [100, 1.5]]);
  });

  it('extracts spinner physics (Whistle/Farfalle/Tourbillon)', () => {
    const s = getFwsimGraphics().spinners;
    expect(s.whistle?.rotSpeed).toBe(25);
    expect(s.farfalle?.nrNozzles).toBe(2);
    expect(s.tourbillon?.density).toBe(530);
  });

  it('extracts globals canonical (mainStarsBrightness=25, sparksBrightness=10.75)', () => {
    const g = getFwsimGraphics().globals;
    expect(g.mainStarsBrightness).toBe(25);
    expect(g.sparksBrightness).toBeCloseTo(10.75);
    expect(g.lightOnEnvironmentFactor).toBe(50);
  });

  it('memoizes — repeated calls return same reference', () => {
    expect(getFwsimGraphics()).toBe(getFwsimGraphics());
  });

  it('sampleCurve interpolates linearly and clamps at edges', () => {
    const pts: Array<[number, number]> = [[0, 0], [10, 1], [20, 0]];
    expect(sampleCurve(pts, -5)).toBe(0);
    expect(sampleCurve(pts, 0)).toBe(0);
    expect(sampleCurve(pts, 5)).toBeCloseTo(0.5);
    expect(sampleCurve(pts, 10)).toBe(1);
    expect(sampleCurve(pts, 15)).toBeCloseTo(0.5);
    expect(sampleCurve(pts, 100)).toBe(0);
  });

  it('sampleCurve applies to FWsim shell_NrStars (40mm→100, 70mm→200, 200mm→250)', () => {
    const curve = getFwsimGraphics().launchSparks.shellNrStars as Array<[number, number]>;
    expect(sampleCurve(curve, 40)).toBe(100);
    expect(sampleCurve(curve, 55)).toBeCloseTo(150);
    expect(sampleCurve(curve, 70)).toBe(200);
    expect(sampleCurve(curve, 200)).toBe(250);
  });
});
