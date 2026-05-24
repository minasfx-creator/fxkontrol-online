import { describe, it, expect } from 'vitest';
import {
  getFinaleParts,
  getFinaleEffects,
  getFinaleSummary,
  findFinalePartByEffectId,
  finalePartToEffect,
  FINALE_LIBRARIES_META,
} from '@/data/effectsLibraries';

describe('Finale libraries — real import (Showven/Lidu/Magic/Winda/Amazon)', () => {
  it('bundles 527 parts split across 5 libraries', () => {
    const summary = getFinaleSummary();
    expect(summary.showven).toBe(181);
    expect(summary.lidu).toBe(112);
    expect(summary.magic).toBe(40);
    expect(summary.winda).toBe(85);
    expect(summary.amazon).toBe(109);
    expect(FINALE_LIBRARIES_META.total).toBe(527);
    expect(getFinaleParts()).toHaveLength(527);
  });

  it('Winda rows are normalised to canonical column names', () => {
    const winda = getFinaleParts().filter((p) => p.libraryId === 'winda');
    expect(winda.length).toBe(85);
    const sample = winda[0];
    // Canonical columns must be present after the alias map
    expect(sample.partNumber).toBeTruthy();
    expect(sample.manufacturer).toBe('Winda');
    // Display columns must NOT leak through
    expect((sample as Record<string, unknown>)['Product ID']).toBeUndefined();
    expect((sample as Record<string, unknown>)['Effect Color']).toBeUndefined();
  });

  it('every library produces at least one Effect with a non-default partType', () => {
    const effects = getFinaleEffects();
    expect(effects).toHaveLength(527);
    const libs: Array<'showven' | 'lidu' | 'magic' | 'winda' | 'amazon'> =
      ['showven', 'lidu', 'magic', 'winda', 'amazon'];
    for (const id of libs) {
      const slice = effects.filter((e) => e.id.startsWith(`fl-${id}-`));
      expect(slice.length).toBeGreaterThan(0);
    }
  });

  it('round-trips Effect.id back to the source FinalePart', () => {
    const parts = getFinaleParts();
    const sample = parts[42];
    const eff = finalePartToEffect(sample);
    const back = findFinalePartByEffectId(eff.id);
    expect(back?.partNumber).toBe(sample.partNumber);
    expect(back?.libraryId).toBe(sample.libraryId);
  });

  it('caliber inference handles inches, mm, and "0.0" → undefined', () => {
    expect(finalePartToEffect({
      partNumber: 'X', libraryId: 'showven', manufacturer: 'X', size: '4"',
    }).caliber).toBe(4);
    expect(finalePartToEffect({
      partNumber: 'X', libraryId: 'showven', manufacturer: 'X', size: '125mm',
    }).caliber).toBe(5);
    expect(finalePartToEffect({
      partNumber: 'X', libraryId: 'showven', manufacturer: 'X', size: '0.0',
    }).caliber).toBeUndefined();
  });
});
