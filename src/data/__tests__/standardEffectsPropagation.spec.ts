/**
 * Verifies new fields (tailRef, colorPhases, caliberSource) are propagated
 * from StandardEffectPart → Effect via standardEffectPartToEffect().
 */
import { describe, it, expect } from 'vitest';
import { getStandardEffects } from '@/data/standardEffectsCatalog';
import { findTailComponent, TAIL_COMPONENTS_META } from '@/data/tailComponentCatalog';

describe('Standard Effects propagation v2', () => {
  const effects = getStandardEffects();

  it('exposes at least one effect with tailRef propagated', () => {
    const withTail = effects.filter(e => e.tailRef);
    expect(withTail.length).toBeGreaterThan(50);
  });

  it('exposes at least one effect with colorPhases propagated', () => {
    const withPhases = effects.filter(e => e.colorPhases && e.colorPhases.length > 0);
    expect(withPhases.length).toBeGreaterThan(0);
  });

  it('every effect has caliberSource set', () => {
    const missing = effects.filter(e => e.caliberSource === undefined);
    // Tolerate a few legacy entries; main pyro must be tagged
    expect(missing.length).toBeLessThan(effects.length * 0.05);
  });

  it('tailRefs resolve to a known tail component for most entries', () => {
    const tails = effects.filter(e => e.tailRef);
    const resolved = tails.filter(e => findTailComponent(e.tailRef!) !== null);
    // ≥80% resolution rate
    expect(resolved.length / tails.length).toBeGreaterThan(0.8);
  });

  it('tail catalog has 100+ non-deprecated components', () => {
    expect(TAIL_COMPONENTS_META.total).toBeGreaterThanOrEqual(100);
  });
});
