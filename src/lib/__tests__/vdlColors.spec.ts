/**
 * VDL Colors — pinning test
 *
 * Source: docs/reference/vdl-colors.md (Finale 3D VDL Documentation, "VDL colors").
 * Locks Table 1 (hex + trail flag) into VDL_COLORS_TABLE / VDL_PALETTE so any
 * accidental drift fails CI.
 */
import { describe, it, expect } from 'vitest';
import { parseVDL } from '../vdlParser';

// Table 1 — must match docs/reference/vdl-colors.md byte-for-byte
const TABLE_1: Array<{ name: string; hex: string; impliesTrail: boolean }> = [
  { name: 'Ruby',         hex: '#f2194c', impliesTrail: false },
  { name: 'Red',          hex: '#f21919', impliesTrail: false },
  { name: 'Orange',       hex: '#e56619', impliesTrail: false },
  { name: 'Peach',        hex: '#cc7f19', impliesTrail: false },
  { name: 'Fresh Yellow', hex: '#b29959', impliesTrail: false },
  { name: 'Yellow',       hex: '#ccb20c', impliesTrail: false },
  { name: 'Lemon',        hex: '#bf990c', impliesTrail: false },
  { name: 'Green',        hex: '#26b21c', impliesTrail: false },
  { name: 'Grass Green',  hex: '#3fb20c', impliesTrail: false },
  { name: 'Lime',         hex: '#59b21c', impliesTrail: false },
  { name: 'Blue',         hex: '#4c66ff', impliesTrail: false },
  { name: 'Sea Blue',     hex: '#3f7fff', impliesTrail: false },
  { name: 'Sky Blue',     hex: '#337fcc', impliesTrail: false },
  { name: 'Aqua',         hex: '#337fcc', impliesTrail: false },
  { name: 'Turquoise',    hex: '#28a3cc', impliesTrail: false },
  { name: 'Cyan',         hex: '#51a3cc', impliesTrail: false },
  { name: 'Indigo',       hex: '#7f3fff', impliesTrail: false },
  { name: 'Lavender',     hex: '#a03fff', impliesTrail: false },
  { name: 'Pink',         hex: '#d859bf', impliesTrail: false },
  { name: 'Fuchsia',      hex: '#d859e5', impliesTrail: false },
  { name: 'Purple',       hex: '#bf3fff', impliesTrail: false },
  { name: 'Magenta',      hex: '#cc19ff', impliesTrail: false },
  { name: 'Plum',         hex: '#b2197f', impliesTrail: false },
  { name: 'Violet',       hex: '#cc66ff', impliesTrail: false },
  { name: 'White',        hex: '#bfbfd8', impliesTrail: false },
  { name: 'Dark',         hex: '#000000', impliesTrail: false },
  // Bare metals/fuels — color comes from the trail itself.
  { name: 'Charcoal',     hex: '#5a280a', impliesTrail: true  },
  { name: 'Gamboge',      hex: '#ff9959', impliesTrail: true  },
  { name: 'Gold',         hex: '#504605', impliesTrail: true  },
  { name: 'Silver',       hex: '#4b4b55', impliesTrail: true  },
];

describe('VDL Colors — Table 1', () => {
  for (const row of TABLE_1) {
    it(`${row.name} → ${row.hex} (impliesTrail=${row.impliesTrail})`, () => {
      const vdl = parseVDL(`${row.name} Peony`);
      expect(vdl.color.toLowerCase()).toBe(row.hex.toLowerCase());
      expect(vdl.impliesTrail).toBe(row.impliesTrail);
    });
  }

  it('Tip variants set impliesTrail=false but reuse the Tip hex', () => {
    for (const name of ['Charcoal Tip', 'Gamboge Tip', 'Gold Tip', 'Silver Tip']) {
      const vdl = parseVDL(`${name} Peony`);
      expect(vdl.impliesTrail).toBe(false);
      expect(vdl.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('VDL Colors — trail derivation', () => {
  it('Chrysanthemum forces trail regardless of color', () => {
    const v = parseVDL('Red Chrysanthemum');
    expect(v.trailType).not.toBe('none');
  });

  it('Willow forces trail regardless of color', () => {
    const v = parseVDL('Blue Willow');
    expect(v.trailType).not.toBe('none');
  });

  it('Peony does NOT carry a trail when color is non-implying', () => {
    const v = parseVDL('Red Peony');
    expect(v.trailType).toBe('none');
    expect(v.impliesTrail).toBe(false);
  });

  it('Gold Peony implies trail (color-derived)', () => {
    const v = parseVDL('Gold Peony');
    expect(v.impliesTrail).toBe(true);
    expect(v.trailType).not.toBe('none');
  });

  it('"No Trail" overrides color-implied trail (Red Chrysanthemum No Trail)', () => {
    const v = parseVDL('Red Chrysanthemum No Trail');
    expect(v.noTrail).toBe(true);
    expect(v.trailType).toBe('none');
    expect(v.impliesTrail).toBe(false);
  });

  it('"No Trail" overrides shape forcesTrail (Willow No Trail)', () => {
    const v = parseVDL('Silver Willow No Trail');
    expect(v.noTrail).toBe(true);
    expect(v.trailType).toBe('none');
  });
});
