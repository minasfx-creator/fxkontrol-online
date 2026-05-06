import { describe, it, expect } from 'vitest';
import {
  listFinaleLibraries,
  getFinaleLibrary,
  getFinalePart,
  searchFinaleParts,
  buildImportedEffects,
  getRegistrySummary,
} from '@/data/effectsLibraries/registry';

describe('effectsLibrariesRegistry', () => {
  it('bundles all 5 canonical libraries with the expected total', () => {
    const summary = getRegistrySummary();
    expect(summary.totalLibraries).toBe(5);
    expect(summary.totalParts).toBe(527);
    const slugs = summary.byManufacturer.map((m) => m.slug).sort();
    expect(slugs).toEqual(['amazon', 'lidu', 'magic', 'showven', 'winda']);
  });

  it('lookup by slug + part id', () => {
    const showven = getFinaleLibrary('showven');
    expect(showven?.parts.length).toBe(181);
    const first = showven!.parts[0];
    expect(getFinalePart(`showven:${first.partNumber}`)?.partNumber).toBe(first.partNumber);
  });

  it('search filters by manufacturer + query', () => {
    const r = searchFinaleParts({ manufacturers: ['Magic Fireworks'] });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.lib.slug === 'magic')).toBe(true);
    const q = searchFinaleParts({ query: 'red' });
    expect(q.length).toBeGreaterThan(0);
  });

  it('buildImportedEffects returns one Effect per part with namespaced ids', () => {
    const eff = buildImportedEffects();
    expect(eff.length).toBe(527);
    expect(eff[0].id).toContain(':');
    // Memoized: same array instance
    expect(buildImportedEffects()).toBe(eff);
  });

  it('exposes 31-key Winda mapping covering core fields', async () => {
    const { WINDA_DISPLAY_TO_CANONICAL } = await import('@/data/effectsLibraries/finalePart');
    expect(WINDA_DISPLAY_TO_CANONICAL['Product ID']).toBe('partNumber');
    expect(WINDA_DISPLAY_TO_CANONICAL['VDL description']).toBe('vdl');
    expect(WINDA_DISPLAY_TO_CANONICAL['Effect height']).toBe('height');
    expect(WINDA_DISPLAY_TO_CANONICAL['NEQ per unit']).toBe('neq');
    expect(Object.keys(WINDA_DISPLAY_TO_CANONICAL).length).toBe(30);
  });
});

describe('finalePartsImporter (JSON)', () => {
  it('parses inline FinaleLibrary JSON and warns on duplicates', async () => {
    const { parseFinalePartsJson } = await import('@/data/effectsLibraries/import');
    const r = parseFinalePartsJson(JSON.stringify({
      manufacturer: 'Test', slug: 'test',
      parts: [
        { partNumber: 'A1', description: 'Red comet', size: '3"', duration: 2 },
        { partNumber: 'A1', description: 'Duplicate' },
        { partNumber: 'A2', size: '30mm' },
      ],
    }));
    expect(r.library.count).toBe(2);
    expect(r.warnings.some((w) => w.includes('Duplicate'))).toBe(true);
  });
});
