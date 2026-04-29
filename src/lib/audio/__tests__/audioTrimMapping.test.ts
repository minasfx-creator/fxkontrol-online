import { describe, it, expect } from 'vitest';
import {
  timelineToAudio,
  audioToTimeline,
  clampToTrim,
  effectiveDuration,
  validateTrim,
  MIN_TRIM_WINDOW_SEC,
} from '../audioTrimMapping';

describe('audioTrimMapping', () => {
  it('timelineToAudio adds the in point', () => {
    expect(timelineToAudio(0, 5)).toBe(5);
    expect(timelineToAudio(3, 5)).toBe(8);
    expect(timelineToAudio(0, 0)).toBe(0);
  });

  it('audioToTimeline subtracts the in point', () => {
    expect(audioToTimeline(5, 5)).toBe(0);
    expect(audioToTimeline(8, 5)).toBe(3);
  });

  it('clampToTrim respects the in/out window', () => {
    expect(clampToTrim(2, 5, 10, 30)).toBe(5);     // before window
    expect(clampToTrim(15, 5, 10, 30)).toBe(10);   // after window
    expect(clampToTrim(7, 5, 10, 30)).toBe(7);     // inside window
  });

  it('clampToTrim falls back to original duration when out is null', () => {
    expect(clampToTrim(50, 5, null, 30)).toBe(30);
    expect(clampToTrim(20, 5, null, 30)).toBe(20);
  });

  it('effectiveDuration uses out − in', () => {
    expect(effectiveDuration(5, 10, 30)).toBe(5);
    expect(effectiveDuration(5, null, 30)).toBe(25);
    expect(effectiveDuration(0, null, 0)).toBe(0);
  });

  describe('validateTrim', () => {
    it('accepts a valid window', () => {
      expect(validateTrim(2, 8, 30)).toBeNull();
    });
    it('rejects non-finite values', () => {
      expect(validateTrim(NaN, 8, 30)).toMatch(/finite/);
      expect(validateTrim(2, Infinity, 30)).toMatch(/finite/);
    });
    it('rejects in ≥ out', () => {
      expect(validateTrim(5, 5, 30)).toMatch(/greater/);
      expect(validateTrim(8, 2, 30)).toMatch(/greater/);
    });
    it('rejects negative in', () => {
      expect(validateTrim(-1, 8, 30)).toMatch(/negative/);
    });
    it('rejects sub-minimum windows', () => {
      expect(validateTrim(2, 2 + MIN_TRIM_WINDOW_SEC / 2, 30)).toMatch(/window/);
    });
    it('rejects out beyond original duration', () => {
      expect(validateTrim(2, 31, 30)).toMatch(/exceeds/);
    });
    it('tolerates origDur=null (still validating)', () => {
      expect(validateTrim(2, 8, null)).toBeNull();
    });
  });
});
