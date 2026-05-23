import { describe, it, expect } from 'vitest';
import { getMergedEffectsCatalog } from '@/data/effectsLibraries/registry';

describe('registry merge — standard effects', () => {
  it('includes Standard Effects parts under FWsim manufacturer', () => {
    const merged = getMergedEffectsCatalog();
    const fromStd = merged.entries.filter((e) => e.effect.id.startsWith('se-'));
    // Standard Effects contribute many unique entries post-dedup; the rest
    // collapse into earlier sources via effectFingerprint (curated/FWsim wins).
    expect(fromStd.length).toBeGreaterThan(100);
    for (const e of fromStd) expect(e.manufacturer).toBe('FWsim');
  });
  it('totalRaw reflects all source lists summed', () => {
    const merged = getMergedEffectsCatalog();
    // curated + fwsim builtins + fwe mines + standard effects (605) + finale libs (527)
    expect(merged.totalRaw).toBeGreaterThanOrEqual(605 + 527);
  });
});
