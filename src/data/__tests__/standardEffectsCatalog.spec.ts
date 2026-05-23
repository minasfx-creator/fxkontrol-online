import { describe, it, expect } from 'vitest';
import { getStandardEffects, STANDARD_EFFECTS_META, standardEffectPartToEffect, type StandardEffectPart } from '@/data/standardEffectsCatalog';

describe('standardEffectsCatalog', () => {
  it('exposes 605 parts across 6 collections', () => {
    expect(STANDARD_EFFECTS_META.total).toBe(605);
    const cols = Object.keys(STANDARD_EFFECTS_META.byCollection);
    expect(cols.length).toBe(6);
    expect(STANDARD_EFFECTS_META.byCollection['Marcus Athmer 2023-11']).toBe(210);
    expect(STANDARD_EFFECTS_META.byCollection['Presets-2026']).toBe(69);
  });

  it('all effect ids are unique and prefixed `se-`', () => {
    const effects = getStandardEffects();
    expect(effects.length).toBe(605);
    const ids = new Set(effects.map((e) => e.id));
    expect(ids.size).toBe(605);
    for (const e of effects) expect(e.id.startsWith('se-')).toBe(true);
  });

  it('Bengal parts become light effects with duration from filename', () => {
    const effects = getStandardEffects();
    const bengals = effects.filter((e) => e.partType === 'light' && /bengal/i.test(e.name));
    expect(bengals.length).toBeGreaterThan(20);
    const r30 = bengals.find((e) => /\(30s\)/.test(e.name));
    expect(r30).toBeTruthy();
    expect(r30!.duration).toBe(30);
  });

  it('Shell adapter routes display-name pattern hints', () => {
    const part: StandardEffectPart = {
      id: 'se-test-willow', fileName: 'X.fwe', collection: 'T', subPath: null,
      displayName: 'Willow Gold', rootType: 'Shell', distribution: 'Spherical',
      palette: ['#FFD27A'], primary: '#FFD27A', secondary: null,
      caliberIn: 4, shotCount: null, cakeRows: null, starCount: 200,
      fanAngleDeg: null, prefire: null, lift: null,
      hasPistil: false, hasTailsLink: false, hasCrackling: false,
      subShellCount: 0, bengalDurationS: null,
    };
    const e = standardEffectPartToEffect(part);
    expect(e.partType).toBe('shell');
    expect(e.pattern).toBe('willow');
    expect(e.caliber).toBe(4);
    expect(e.heightMeters).toBe(88);
    expect(e.finalePresetUrl).toBe('/finale-presets/standard-effects/T/X.fwe');
  });

  it('Mine with secondary color exposes colorTransition', () => {
    const part: StandardEffectPart = {
      id: 'se-test-mine', fileName: 'm.fwe', collection: 'T', subPath: null,
      displayName: 'Mine Red to Blue', rootType: 'Mine', distribution: 'Mine',
      palette: ['#FF1A1A', '#3F7BFF'], primary: '#FF1A1A', secondary: '#3F7BFF',
      caliberIn: 3, shotCount: null, cakeRows: null, starCount: 60,
      fanAngleDeg: null, prefire: null, lift: null,
      hasPistil: false, hasTailsLink: false, hasCrackling: false,
      subShellCount: 0, bengalDurationS: null,
    };
    const e = standardEffectPartToEffect(part);
    expect(e.partType).toBe('mine');
    expect(e.pattern).toBe('mine_color_shift');
    expect(e.colorTransition).toBe('#FF1A1A→#3F7BFF');
  });
});
