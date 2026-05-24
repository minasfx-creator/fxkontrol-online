import { describe, it, expect } from 'vitest';
import { FWE_MINE_CATALOG, FWE_MINE_EFFECTS } from '@/data/fweMineCatalog';

describe('FWE Mine Catalog', () => {
  it('contains all 9 uploaded mines', () => {
    expect(FWE_MINE_CATALOG).toHaveLength(9);
    expect(FWE_MINE_EFFECTS).toHaveLength(9);
  });

  it('ids are stable and unique', () => {
    const ids = FWE_MINE_EFFECTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(9);
    expect(ids.every((id) => id.startsWith('fwe-mine-'))).toBe(true);
  });

  it('every entry maps to partType=mine + category=mines', () => {
    for (const e of FWE_MINE_EFFECTS) {
      expect(e.partType).toBe('mine');
      expect(e.category).toBe('mines');
      expect(e.color).toMatch(/^#[0-9A-F]{6}$/);
      expect(e.finalePresetUrl).toMatch(/^\/finale-presets\/mines\/.*\.fwe$/);
    }
  });

  it('color-shift mines carry secondary + colorTransition', () => {
    const shifts = FWE_MINE_CATALOG.filter((c) => c.colorShift);
    expect(shifts.map((c) => c.id).sort()).toEqual([
      'fwe-mine-purple-to-orange',
      'fwe-mine-red-to-green',
      'fwe-mine-yellow-to-purple',
    ]);
    for (const c of shifts) {
      expect(c.secondary).toBeTruthy();
      const fx = FWE_MINE_EFFECTS.find((e) => e.id === c.id)!;
      expect(fx.colorTransition).toContain('→');
    }
  });

  it('comet head mine uses mine_comet pattern + impliesTrail', () => {
    const comet = FWE_MINE_EFFECTS.find((e) => e.id === 'fwe-mine-purple-comet-white-w-silver-tail')!;
    expect(comet.pattern).toBe('mine_comet');
    expect(comet.impliesTrail).toBe(true);
  });
});
