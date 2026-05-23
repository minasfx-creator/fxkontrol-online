import { describe, it, expect } from 'vitest';
import {
  FWE_UPLOADED_SPECS,
  FWE_UPLOADED_EFFECTS,
  fweEffectId,
  fweSpecToEffect,
  resolveFweEffect,
} from '@/data/fweUploadedEffects';

describe('FWE uploaded effects — catalog + resolver round-trip', () => {
  it('exposes exactly 10 curated entries (one per uploaded .fwe)', () => {
    expect(FWE_UPLOADED_SPECS).toHaveLength(10);
    expect(FWE_UPLOADED_EFFECTS).toHaveLength(10);
  });

  it('all entries have stable namespaced ids and unique filenames', () => {
    const ids = new Set<string>();
    const files = new Set<string>();
    for (const fx of FWE_UPLOADED_EFFECTS) {
      expect(fx.id.startsWith('fwe-')).toBe(true);
      expect(ids.has(fx.id)).toBe(false);
      ids.add(fx.id);
    }
    for (const s of FWE_UPLOADED_SPECS) {
      expect(files.has(s.fileName)).toBe(false);
      files.add(s.fileName);
    }
  });

  it('rootKind drives category & partType correctly', () => {
    for (const s of FWE_UPLOADED_SPECS) {
      const fx = fweSpecToEffect(s);
      if (s.rootKind === 'Cake') {
        expect(s.category).toBe('cakes_batteries');
        expect(s.partType).toBe('cake');
        expect(typeof s.shotCount).toBe('number');
        expect(fx.shotCount).toBeGreaterThan(0);
      }
      if (s.rootKind === 'Shell') {
        expect(s.category).toBe('morteiros');
        expect(s.partType).toBe('shell');
      }
      if (s.rootKind === 'Mine') {
        expect(s.category).toBe('mines');
        expect(s.partType).toBe('mine');
      }
    }
  });

  it('resolver round-trips by id, filename, and display name', () => {
    for (const s of FWE_UPLOADED_SPECS) {
      const id = fweEffectId(s);
      expect(resolveFweEffect(id)?.id).toBe(id);
      expect(resolveFweEffect(s.fileName)?.id).toBe(id);
      expect(resolveFweEffect(s.displayName)?.id).toBe(id);
      // Filename with .fwe extension
      expect(resolveFweEffect(`${s.fileName}.fwe`)?.id).toBe(id);
      // Mixed case + spaces vs underscores
      expect(
        resolveFweEffect(s.fileName.replace(/_/g, ' ').toUpperCase())?.id,
      ).toBe(id);
    }
  });

  it('resolver returns undefined for null/empty/unknown queries', () => {
    expect(resolveFweEffect(null)).toBeUndefined();
    expect(resolveFweEffect(undefined)).toBeUndefined();
    expect(resolveFweEffect('')).toBeUndefined();
    expect(resolveFweEffect('   ')).toBeUndefined();
    expect(resolveFweEffect('not-a-real-effect')).toBeUndefined();
  });

  it('Comet_Ultrafast_Red has shortest duration & no trail (matches XML)', () => {
    const fx = resolveFweEffect('Comet_Ultrafast_Red')!;
    expect(fx).toBeDefined();
    expect(fx.duration).toBeLessThan(1.0);
    expect(fx.impliesTrail).toBe(false);
  });

  it('Cake entries advertise shotCount and >=3s duration', () => {
    const cakes = FWE_UPLOADED_EFFECTS.filter((f) => f.partType === 'cake');
    expect(cakes.length).toBe(2);
    for (const c of cakes) {
      expect(c.shotCount).toBeGreaterThan(0);
      expect(c.duration).toBeGreaterThanOrEqual(3);
    }
  });

  it('Crown shells use kamuro pattern and impliesTrail', () => {
    const crowns = FWE_UPLOADED_EFFECTS.filter((f) =>
      f.name.toLowerCase().startsWith('crown'),
    );
    expect(crowns.length).toBe(3);
    for (const c of crowns) {
      expect(c.pattern).toBe('kamuro');
      expect(c.impliesTrail).toBe(true);
      expect(c.partType).toBe('shell');
    }
  });
});
