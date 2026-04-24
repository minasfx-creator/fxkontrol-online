import { describe, it, expect } from 'vitest';
import { qualityToRgb, qualityToHex, clamp01 } from './qualityColorRamp';

describe('qualityColorRamp', () => {
  it('clamps inputs to [0..1]', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.4)).toBeCloseTo(0.4);
    expect(clamp01(NaN)).toBe(0);
  });

  it('maps endpoints to red and green', () => {
    expect(qualityToRgb(0)).toEqual([1, 0, 0]);
    expect(qualityToRgb(1)).toEqual([0, 1, 0]);
  });

  it('maps midpoint to yellow', () => {
    const [r, g, b] = qualityToRgb(0.5);
    expect(r).toBeCloseTo(1);
    expect(g).toBeCloseTo(1);
    expect(b).toBe(0);
  });

  it('packs to hex', () => {
    expect(qualityToHex(0)).toBe(0xff0000);
    expect(qualityToHex(1)).toBe(0x00ff00);
    expect(qualityToHex(0.5)).toBe(0xffff00);
  });
});
