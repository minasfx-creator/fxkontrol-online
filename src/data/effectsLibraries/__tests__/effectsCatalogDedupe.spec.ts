import { describe, it, expect } from 'vitest';
import type { Effect } from '@/data/effectLibrary';
import { effectFingerprint } from '../effectFingerprint';
import { getMergedEffectsCatalog } from '../registry';

const mk = (over: Partial<Effect> = {}): Effect => ({
  id: 'x', name: 'x', category: 'morteiros', type: 'firework',
  color: '#ff2233', duration: 2, cost: 0, icon: '💥',
  partType: 'shell', caliber: 4, heightMeters: 80, ...over,
});

describe('effectFingerprint', () => {
  it('is deterministic and idempotent', () => {
    const fp = effectFingerprint(mk());
    expect(fp).toBe(effectFingerprint(mk()));
  });

  it('collapses near-equivalent reds', () => {
    expect(effectFingerprint(mk({ color: '#ff2233' })))
      .toBe(effectFingerprint(mk({ color: '#ff1f30' })));
  });

  it('separates different calibers', () => {
    expect(effectFingerprint(mk({ caliber: 4 })))
      .not.toBe(effectFingerprint(mk({ caliber: 6 })));
  });

  it('separates different partTypes', () => {
    expect(effectFingerprint(mk({ partType: 'shell' })))
      .not.toBe(effectFingerprint(mk({ partType: 'mine' })));
  });
});

describe('getMergedEffectsCatalog', () => {
  it('returns a non-empty catalog', () => {
    const m = getMergedEffectsCatalog();
    expect(m.entries.length).toBeGreaterThan(50);
  });

  it('dedupes (output ≤ input)', () => {
    const m = getMergedEffectsCatalog();
    expect(m.entries.length).toBeLessThanOrEqual(m.totalRaw);
  });

  it('exposes aliases for collapsed duplicates', () => {
    const m = getMergedEffectsCatalog();
    const withAliases = m.entries.filter((e) => e.aliases.length > 0);
    // With 600+ entries across 5 vendors, expect at least some alias overlap.
    expect(withAliases.length).toBeGreaterThan(0);
  });

  it('manufacturer is tagged on every entry', () => {
    const m = getMergedEffectsCatalog();
    for (const e of m.entries) expect(e.manufacturer).toBeTruthy();
  });
});
