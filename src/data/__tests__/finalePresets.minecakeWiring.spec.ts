import { describe, it, expect } from 'vitest';
import {
  resolveMinePresetId,
  resolveMinePresetProps,
  resolveCakeShotPresetId,
  resolveCakeShotPresetProps,
} from '@/data/finalePresets';

describe('Mine/Cake renderer wiring (rev9) — preset → renderer props', () => {
  it('resolves canonical Mine preset color + strobe for spray modulation', () => {
    const id = resolveMinePresetId('Single Shot Mine — Gold Glitter');
    expect(id).toBe('single-mine-gold-glitter');
    const p = resolveMinePresetProps(id!);
    expect(p).toBeDefined();
    expect(p!.color.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
    expect(p!.strobeHz).toBeGreaterThan(0); // tail strobe drives MineEffect
  });

  it('resolves canonical Cake-shot preset inner color', () => {
    const id = resolveCakeShotPresetId('Cake Silver Titanium');
    expect(id).toBe('cake-shell-silver-titanium');
    const p = resolveCakeShotPresetProps(id!);
    expect(p).toBeDefined();
    expect(p!.innerColor.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
    expect(['shell', 'mine']).toContain(p!.wrappedKind);
  });

  it('returns undefined for ambiguous mine names (no silent default)', () => {
    expect(resolveMinePresetId('silver crackling')).toBeUndefined();
    expect(resolveMinePresetId('')).toBeUndefined();
    expect(resolveMinePresetId(null)).toBeUndefined();
  });
});

describe('resolveMinePresetId — name variations & edge cases', () => {
  it('is case-insensitive and tolerates extra whitespace', () => {
    expect(resolveMinePresetId('  GOLD GLITTER MINE  ')).toBe('single-mine-gold-glitter');
    expect(resolveMinePresetId('Single Shot Mine — Gold Glitter')).toBe('single-mine-gold-glitter');
    expect(resolveMinePresetId('gold mine')).toBe('single-mine-gold-glitter');
    expect(resolveMinePresetId('glitter')).toBe('single-mine-gold-glitter');
  });

  it('disambiguates comet variants (silver/white vs gold/deep vs comet-mine)', () => {
    expect(resolveMinePresetId('Silver Comet')).toBe('single-comet-silver-glitter');
    expect(resolveMinePresetId('comet white')).toBe('single-comet-silver-glitter');
    expect(resolveMinePresetId('Comet Deep Gold')).toBe('single-comet-mine-gold');
    expect(resolveMinePresetId('comet/mine')).toBe('single-comet-mine-gold');
    expect(resolveMinePresetId('comet-mine')).toBe('single-comet-mine-gold');
    expect(resolveMinePresetId('comet_mine')).toBe('single-comet-mine-gold');
    expect(resolveMinePresetId('comet mine')).toBe('single-comet-mine-gold');
  });

  it('matches all Silver-Crackling tip colors with separator/punctuation variants', () => {
    expect(resolveMinePresetId('Mine Silver-Crackling to Aqua Tip')).toBe('mine-silver-crackling-aqua');
    expect(resolveMinePresetId('silver_crackling blue')).toBe('mine-silver-crackling-blue');
    expect(resolveMinePresetId('SILVER CRACKLING GREEN')).toBe('mine-silver-crackling-green');
    expect(resolveMinePresetId('silver crackling — mint')).toBe('mine-silver-crackling-mint');
    expect(resolveMinePresetId('silver crackling, orange tip')).toBe('mine-silver-crackling-orange');
  });

  it('handles pastel synonyms (violet→purple, pink→red)', () => {
    expect(resolveMinePresetId('silver crackling pastel violet')).toBe('mine-silver-crackling-pastel-purple');
    expect(resolveMinePresetId('silver crackling pastel pink')).toBe('mine-silver-crackling-pastel-red');
    expect(resolveMinePresetId('silver crackling pastel blue')).toBe('mine-silver-crackling-pastel-blue');
    expect(resolveMinePresetId('silver crackling pastel green')).toBe('mine-silver-crackling-pastel-green');
  });

  it('Silver Crackling tip rules win over generic silver/comet rules', () => {
    // "silver crackling blue" must NOT fall into single-comet-silver-glitter
    expect(resolveMinePresetId('silver crackling blue comet')).toBe('mine-silver-crackling-blue');
  });

  it('returns undefined for unrelated, empty, or nullish names', () => {
    expect(resolveMinePresetId(undefined)).toBeUndefined();
    expect(resolveMinePresetId('   ')).toBeUndefined();
    expect(resolveMinePresetId('peony pistil')).toBeUndefined();
    expect(resolveMinePresetId('chrysanthemum gold')).toBeUndefined();
    expect(resolveMinePresetId('palm willow')).toBeUndefined();
    // bare "silver crackling" with no tip → ambiguous, must not silently default
    expect(resolveMinePresetId('silver crackling')).toBeUndefined();
    expect(resolveMinePresetId('SILVER CRACKLING')).toBeUndefined();
  });

  it('every resolved id has a corresponding props entry', () => {
    const samples = [
      'gold glitter mine', 'silver comet', 'comet/mine deep gold',
      'mine silver crackling aqua tip',
      'silver crackling blue', 'silver crackling green', 'silver crackling mint',
      'silver crackling orange', 'silver crackling pastel blue',
      'silver crackling pastel green', 'silver crackling pastel purple',
      'silver crackling pastel red',
    ];
    for (const name of samples) {
      const id = resolveMinePresetId(name);
      expect(id, `unresolved: "${name}"`).toBeDefined();
      const p = resolveMinePresetProps(id!);
      expect(p, `no props for id "${id}" (from "${name}")`).toBeDefined();
      expect(p!.color.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('resolveCakeShotPresetId — name variations & edge cases', () => {
  it('is case-insensitive and trims whitespace', () => {
    expect(resolveCakeShotPresetId('  CAKE SILVER TITANIUM  '))
      .toBe('cake-shell-silver-titanium');
    expect(resolveCakeShotPresetId('cake titanium silver'))
      .toBe('cake-shell-silver-titanium');
    expect(resolveCakeShotPresetId('silver titanium cake'))
      .toBe('cake-shell-silver-titanium');
  });

  it('matches mine-shell variants with separator tolerance', () => {
    expect(resolveCakeShotPresetId('Cake Mine-Shell')).toBe('cake-mine-shell-gold');
    expect(resolveCakeShotPresetId('cake mine_shell gold')).toBe('cake-mine-shell-gold');
    expect(resolveCakeShotPresetId('cake mine shell')).toBe('cake-mine-shell-gold');
  });

  it('matches hybrid/coal variants', () => {
    expect(resolveCakeShotPresetId('Cake Hybrid')).toBe('cake-hybrid-coal-gold');
    expect(resolveCakeShotPresetId('cake coal gold')).toBe('cake-hybrid-coal-gold');
    expect(resolveCakeShotPresetId('CAKE HYBRID COAL')).toBe('cake-hybrid-coal-gold');
  });

  it('returns undefined for unrelated/empty/nullish input', () => {
    expect(resolveCakeShotPresetId(null)).toBeUndefined();
    expect(resolveCakeShotPresetId(undefined)).toBeUndefined();
    expect(resolveCakeShotPresetId('')).toBeUndefined();
    expect(resolveCakeShotPresetId('   ')).toBeUndefined();
    expect(resolveCakeShotPresetId('peony')).toBeUndefined();
    expect(resolveCakeShotPresetId('chrysanthemum')).toBeUndefined();
    // "cake" alone → no family hint, must not silently default
    expect(resolveCakeShotPresetId('cake')).toBeUndefined();
  });

  it('every resolved id has a corresponding props entry', () => {
    const samples = ['cake silver titanium', 'cake mine-shell gold', 'cake hybrid coal'];
    for (const name of samples) {
      const id = resolveCakeShotPresetId(name);
      expect(id, `unresolved: "${name}"`).toBeDefined();
      const p = resolveCakeShotPresetProps(id!);
      expect(p, `no props for id "${id}" (from "${name}")`).toBeDefined();
      expect(p!.innerColor.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
      expect(['shell', 'mine']).toContain(p!.wrappedKind);
    }
  });
});
