import { beforeEach, describe, expect, it } from 'vitest';
import {
  getVdlPipelineStats,
  hexToRenderHex,
  quantizeRgbToVdl,
  rec709Luma,
  resetVdlPipelineCache,
  rgbToRenderHex,
} from '@/lib/vdlColorPipeline';

describe('vdlColorPipeline — RGB → VDL render-accurate', () => {
  beforeEach(() => resetVdlPipelineCache());

  it('quantizes pure red to VDL "Red" family', () => {
    const c = quantizeRgbToVdl(255, 0, 0);
    expect(c.name).toBe('Red');
    expect(c.exportName).toBe('Red');
    expect(c.paletteHex.toLowerCase()).toBe('#f21919');
  });

  it('export name handles trail-implying colors with noTrail=true', () => {
    expect(quantizeRgbToVdl(204, 102, 25, true).exportName).toMatch(/(No Trail|Tip)$/);
    expect(quantizeRgbToVdl(255, 144, 80, true).exportName).toContain('Tip');
  });

  it('render hex preserves dim inputs (low luminance → low render brightness)', () => {
    const bright = quantizeRgbToVdl(255, 0, 0);
    const dim = quantizeRgbToVdl(40, 0, 0);
    expect(bright.brightness).toBeGreaterThan(dim.brightness);
    // Render hex of dim should be visibly darker than bright on R channel.
    const brightR = parseInt(bright.renderHex.slice(1, 3), 16);
    const dimR = parseInt(dim.renderHex.slice(1, 3), 16);
    expect(dimR).toBeLessThan(brightR);
  });

  it('"Dark" stays #000000 regardless of palette math', () => {
    const c = quantizeRgbToVdl(0, 0, 0);
    expect(c.name).toBe('Dark');
    expect(c.renderHex).toBe('#000000');
  });

  it('LRU cache: hit on repeated query', () => {
    quantizeRgbToVdl(123, 200, 50);
    quantizeRgbToVdl(123, 200, 50);
    quantizeRgbToVdl(123, 200, 50);
    const s = getVdlPipelineStats();
    expect(s.hits).toBe(2);
    expect(s.misses).toBe(1);
  });

  it('LRU cache: cap evicts oldest entries beyond 256', () => {
    for (let i = 0; i < 300; i++) quantizeRgbToVdl(i & 0xff, (i * 3) & 0xff, (i * 7) & 0xff);
    const s = getVdlPipelineStats();
    expect(s.size).toBeLessThanOrEqual(256);
  });

  it('rec709Luma matches expected weights', () => {
    expect(rec709Luma(255, 0, 0)).toBeCloseTo(0.2126, 3);
    expect(rec709Luma(0, 255, 0)).toBeCloseTo(0.7152, 3);
    expect(rec709Luma(0, 0, 255)).toBeCloseTo(0.0722, 3);
  });

  it('convenience helpers return strings starting with #', () => {
    expect(rgbToRenderHex(10, 200, 50)).toMatch(/^#[0-9a-f]{6}$/i);
    expect(hexToRenderHex('#ff00aa')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('bright pure-white maps to White/Silver family with high render luma', () => {
    const c = quantizeRgbToVdl(255, 255, 255);
    expect(['White', 'Silver']).toContain(c.name);
    expect(c.brightness).toBeGreaterThan(0.95);
  });

  it('quantization is deterministic (same input → same output)', () => {
    const a = quantizeRgbToVdl(123, 80, 200);
    const b = quantizeRgbToVdl(123, 80, 200);
    expect(a).toEqual(b);
  });
});
