import { describe, it, expect, beforeEach } from 'vitest';
import {
  findEffectById,
  getAllEffects,
  resolveEffectLedAccurate,
  ledAccurateColor,
  __resetResolveEffectCache,
} from '../resolveEffect';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import { FWSIM_BUILTIN_EFFECTS } from '@/data/fwsimBuiltinPresets';
import { FWE_MINE_EFFECTS } from '@/data/fweMineCatalog';
import { getStandardEffects } from '@/data/standardEffectsCatalog';
import { getFinaleEffects } from '../registry';

describe('resolveEffect — unified lookup across 5 sources', () => {
  beforeEach(() => __resetResolveEffectCache());

  it('resolves curated effects', () => {
    const sample = EFFECT_LIBRARY[0];
    expect(findEffectById(sample.id)?.id).toBe(sample.id);
  });

  it('resolves FWsim builtin effects', () => {
    const s = FWSIM_BUILTIN_EFFECTS[0];
    if (s) expect(findEffectById(s.id)?.id).toBe(s.id);
  });

  it('resolves FWE Mine effects', () => {
    const s = FWE_MINE_EFFECTS[0];
    if (s) expect(findEffectById(s.id)?.id).toBe(s.id);
  });

  it('resolves Standard Effects', () => {
    const list = getStandardEffects();
    if (list.length) expect(findEffectById(list[0].id)?.id).toBe(list[0].id);
  });

  it('resolves Finale parts', () => {
    const list = getFinaleEffects();
    if (list.length) expect(findEffectById(list[0].id)?.id).toBe(list[0].id);
  });

  it('curated wins on id collision (first-insert)', () => {
    const sample = EFFECT_LIBRARY[0];
    expect(findEffectById(sample.id)).toBe(
      getAllEffects().find(e => e.id === sample.id),
    );
  });

  it('returns undefined for unknown id', () => {
    expect(findEffectById('does-not-exist-xyz')).toBeUndefined();
    expect(findEffectById('')).toBeUndefined();
    expect(findEffectById(null)).toBeUndefined();
  });

  it('getAllEffects includes ≥ curated count', () => {
    expect(getAllEffects().length).toBeGreaterThanOrEqual(EFFECT_LIBRARY.length);
  });

  it('ledAccurateColor snaps arbitrary hex to VDL palette hex', () => {
    const snapped = ledAccurateColor('#ff0000');
    expect(snapped).toMatch(/^#[0-9a-f]{6}$/i);
    // Idempotent: snapping a palette color returns the same
    expect(ledAccurateColor(snapped)).toBe(snapped);
  });

  it('resolveEffectLedAccurate quantizes color', () => {
    const sample = EFFECT_LIBRARY[0];
    const led = resolveEffectLedAccurate(sample.id);
    expect(led).toBeDefined();
    expect(led!.id).toBe(sample.id);
    if (sample.color) {
      expect(led!.color).toBe(ledAccurateColor(sample.color));
    }
  });

  it('resolveEffectLedAccurate is memoised', () => {
    const sample = EFFECT_LIBRARY[0];
    expect(resolveEffectLedAccurate(sample.id)).toBe(
      resolveEffectLedAccurate(sample.id),
    );
  });
});
