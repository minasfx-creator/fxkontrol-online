import { describe, it, expect } from 'vitest';
import { parseVDL } from '../vdlParser';
import {
  toTypedAdjustments,
  summarizeAdjustments,
  parseAngleOffset,
  VDL_ANGLE_STEPS,
} from '../vdlAdjustments';

/**
 * VDL Adjustment Adjectives + Angles — pins parser + typed helper.
 * See docs/reference/vdl-adjustment-adjectives.md.
 */
describe('VDL Adjustment Adjectives — parser pinning', () => {
  it('extracts "very big" from a peony', () => {
    const r = parseVDL('Very Big Red Peony');
    expect(r.adjustments).toContain('very big');
  });

  it('repetition stacks (compound multiplication)', () => {
    const r = parseVDL('Very Big Very Big Red Peony');
    const verybigs = r.adjustments.filter((a) => a === 'very big');
    expect(verybigs.length).toBe(2);
  });

  it('distinguishes brightness, trail brightness, tip brightness', () => {
    const r = parseVDL('Bright Trail Bright Tip Red Peony');
    expect(r.adjustments).toContain('bright trail');
    expect(r.adjustments).toContain('bright tip');
  });

  it('long vs long trail are different adjustments', () => {
    const a = parseVDL('Long Red Comet');
    const b = parseVDL('Long Trail Red Comet');
    expect(a.adjustments).toContain('long');
    expect(b.adjustments).toContain('long trail');
    expect(b.adjustments).not.toContain('long');
  });

  it('droopy / ragged / uniform recognised', () => {
    expect(parseVDL('Droopy Gold Gerb').adjustments).toContain('droopy');
    expect(parseVDL('Ragged Red Peony').adjustments).toContain('ragged');
    expect(parseVDL('Uniform Red Peony').adjustments).toContain('uniform');
  });
});

describe('VDL Adjustment Adjectives — typed view', () => {
  it('maps "very big" → spread / +3 / 1.5', () => {
    const [t] = toTypedAdjustments(['very big']);
    expect(t.kind).toBe('spread');
    expect(t.intensity).toBe(3);
    expect(t.value).toBe(1.5);
  });

  it('maps "very small" → spread / -3 / 0.6', () => {
    const [t] = toTypedAdjustments(['very small']);
    expect(t.intensity).toBe(-3);
    expect(t.value).toBe(0.6);
  });

  it('summarize multiplies repeats: very big × 2 → spread 2.25', () => {
    const s = summarizeAdjustments(['very big', 'very big']);
    expect(s.spread).toBeCloseTo(1.5 * 1.5, 6);
  });

  it('summarize combines independent kinds', () => {
    const s = summarizeAdjustments(['big', 'dense', 'bright trail']);
    expect(s.spread).toBe(1.25);
    expect(s.stars).toBe(1.5);
    expect(s.trailBrightness).toBe(1.25);
  });

  it('unknown terms silently dropped', () => {
    expect(toTypedAdjustments(['totally bogus'])).toEqual([]);
  });
});

describe('VDL Angles', () => {
  it('R45 → +45 via parser angleOffset', () => {
    const r = parseVDL('Flame Projector R45');
    expect(r.angleOffset).toBe(45);
  });

  it('L105 → -105 (doc example: Wave Flamer Macro #16)', () => {
    const r = parseVDL('Flame Projector L105');
    expect(r.angleOffset).toBe(-105);
  });

  it('parseAngleOffset helper: R30', () => {
    expect(parseAngleOffset('Red Peony R30')).toBe(30);
  });

  it('parseAngleOffset helper: L180', () => {
    expect(parseAngleOffset('Mine L180')).toBe(-180);
  });

  it('parseAngleOffset helper: no angle → null', () => {
    expect(parseAngleOffset('Red Peony')).toBeNull();
  });

  it('parseAngleOffset helper: last match wins on multiple', () => {
    // Mixed: last occurrence in source order wins
    expect(parseAngleOffset('Foo R15 Bar L60')).toBe(-60);
    expect(parseAngleOffset('Foo L60 Bar R15')).toBe(15);
  });

  it('VDL_ANGLE_STEPS covers 15..180 step 15', () => {
    expect(VDL_ANGLE_STEPS).toEqual([15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180]);
  });
});
