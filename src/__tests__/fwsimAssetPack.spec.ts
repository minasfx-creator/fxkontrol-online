import { describe, it, expect } from 'vitest';
import { FWSIM_BUILTIN_EFFECTS, FWSIM_BUILTIN_COUNT } from '@/data/fwsimBuiltinPresets';
import { FWSIM_OLD_EFFECTS_INDEX, searchFwsimOldEffects } from '@/data/fwsimOldEffectsIndex';

describe('FWsim asset pack', () => {
  it('ships at least 44 built-in presets (Peony..Lancework)', () => {
    expect(FWSIM_BUILTIN_COUNT).toBeGreaterThanOrEqual(44);
  });

  it('every built-in has id/name/color/duration and a thumbUrl', () => {
    for (const e of FWSIM_BUILTIN_EFFECTS) {
      expect(e.id).toMatch(/^fin-/);
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(e.duration).toBeGreaterThan(0);
      expect(e.type).toBe('firework');
      expect(e.thumbUrl).toMatch(/^\/finale-presets\/thumbs\//);
    }
  });

  it('built-in ids are unique', () => {
    const ids = FWSIM_BUILTIN_EFFECTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Old Effects Index loads 229 legacy names', () => {
    expect(FWSIM_OLD_EFFECTS_INDEX.length).toBe(229);
  });

  it('searchFwsimOldEffects matches case-insensitively', () => {
    const hits = searchFwsimOldEffects('comet');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].name.toLowerCase()).toContain('comet');
  });
});
