/**
 * Finale 3D — Effect Data / Motion Data parser & serializer tests
 * Pins docs/reference/finale-effect-motion-data.md.
 */
import { describe, it, expect } from 'vitest';
import {
  parseFinaleEffectData,
  serializeFinaleEffectData,
  sampleVec4,
  sampleHpr,
  sampleRgb,
} from '../finaleEffectData';

describe('Finale Effect Data — parse', () => {
  it('parses empty object', () => {
    expect(parseFinaleEffectData('{}')).toEqual({});
    expect(parseFinaleEffectData('  {}  ')).toEqual({});
  });

  it('parses canonical wheel example', () => {
    // {[pos2 [0 .5 0 0]] [hpr [10000 0 0 -3600]]}
    const d = parseFinaleEffectData('{[pos2 [0 .5 0 0]] [hpr [10000 0 0 -3600]]}');
    expect(d.pos2).toEqual([{ t: 0, x: 0.5, y: 0, z: 0 }]);
    expect(d.hpr).toEqual([{ t: 10000, h: 0, p: 0, r: -3600 }]);
  });

  it('parses pos with multiple samples and floats', () => {
    const d = parseFinaleEffectData('{[pos [0 0 0 0 1000 0 10 0 2000 10 10 0]]}');
    expect(d.pos).toHaveLength(3);
    expect(d.pos![1]).toEqual({ t: 1000, x: 0, y: 10, z: 0 });
  });

  it('parses rgb with packed ints', () => {
    const d = parseFinaleEffectData('{[rgb [0 255 10000 65280]]}');
    expect(d.rgb).toEqual([{ t: 0, rgb: 255 }, { t: 10000, rgb: 65280 }]);
  });

  it('parses hash attribute as int32', () => {
    const d = parseFinaleEffectData('{[hash 1908853237] [pos []]}');
    expect(d.hash).toBe(1908853237);
    expect(d.pos).toEqual([]);
  });

  it('preserves unknown attributes verbatim', () => {
    const d = parseFinaleEffectData('{[future [1 2 3]]}');
    expect(d.unknown).toEqual({ future: [1, 2, 3] });
  });

  it('rejects mid-tuple pos (length 3)', () => {
    expect(() => parseFinaleEffectData('{[pos [0 1 2]]}')).toThrow(/not a multiple of 4/);
  });

  it('rejects mid-tuple rgb (length 3)', () => {
    expect(() => parseFinaleEffectData('{[rgb [0 1 2]]}')).toThrow(/not a multiple of 2/);
  });

  it('warns on non-monotonic times', () => {
    const d = parseFinaleEffectData('{[pos [1000 0 0 0 500 1 1 1]]}');
    expect(d.warnings?.[0]).toMatch(/not monotonic/);
  });
});

describe('Finale Effect Data — serialize', () => {
  it('round-trips canonical wheel', () => {
    const src = '{[pos2 [0 0.5 0 0]] [hpr [10000 0 0 -3600]]}';
    const d = parseFinaleEffectData(src);
    expect(serializeFinaleEffectData(d)).toBe(src);
  });

  it('round-trips rgb', () => {
    const src = '{[rgb [0 255 10000 65280]]}';
    expect(serializeFinaleEffectData(parseFinaleEffectData(src))).toBe(src);
  });

  it('emits hash first', () => {
    const src = '{[hash 42] [pos [0 0 0 0]]}';
    expect(serializeFinaleEffectData(parseFinaleEffectData(src))).toBe(src);
  });

  it('produces stable order: hash, pos, pos2, hpr, hpr2, rgb', () => {
    const d = {
      hpr: [{ t: 1, h: 0, p: 0, r: 0 }],
      pos: [{ t: 0, x: 0, y: 0, z: 0 }],
      rgb: [{ t: 0, rgb: 1 }],
    };
    expect(serializeFinaleEffectData(d)).toBe('{[pos [0 0 0 0]] [hpr [1 0 0 0]] [rgb [0 1]]}');
  });
});

describe('Finale Effect Data — interpolation', () => {
  it('pos: implicit (0,0,0) before first sample', () => {
    const s = [{ t: 1000, x: 10, y: 0, z: 0 }];
    expect(sampleVec4(s, 0)).toEqual([0, 0, 0]);
    expect(sampleVec4(s, 500)).toEqual([5, 0, 0]);
    expect(sampleVec4(s, 1000)).toEqual([10, 0, 0]);
  });

  it('pos: held after last sample', () => {
    const s = [{ t: 1000, x: 10, y: 0, z: 0 }, { t: 2000, x: 20, y: 0, z: 0 }];
    expect(sampleVec4(s, 5000)).toEqual([20, 0, 0]);
  });

  it('hpr: per-component linear (10 full spins over 10s)', () => {
    const s = [{ t: 10000, h: 0, p: 0, r: -3600 }];
    expect(sampleHpr(s, 5000)).toEqual([0, 0, -1800]);
    expect(sampleHpr(s, 10000)).toEqual([0, 0, -3600]);
  });

  it('rgb: implicit black at t=0; per-channel lerp', () => {
    const s = [{ t: 1000, rgb: 0xff0000 }];
    expect(sampleRgb(s, 0)).toBe(0x000000);
    const mid = sampleRgb(s, 500);
    // ~half red
    expect((mid >> 16) & 0xff).toBeGreaterThanOrEqual(127);
    expect((mid >> 16) & 0xff).toBeLessThanOrEqual(128);
  });

  it('rgb: between two samples lerps each channel', () => {
    const s = [
      { t: 0,     rgb: 0xff0000 }, // red
      { t: 1000,  rgb: 0x00ff00 }, // green
    ];
    const mid = sampleRgb(s, 500);
    expect((mid >> 16) & 0xff).toBe(128); // R: 255→0
    expect((mid >> 8)  & 0xff).toBe(128); // G: 0→255
    expect(mid & 0xff).toBe(0);
  });
});
