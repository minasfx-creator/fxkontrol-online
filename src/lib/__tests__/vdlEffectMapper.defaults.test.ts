/**
 * Guardião: na ausência de modificadores (crackle, glitter, kamuro, no trail,
 * strobe, report, twinkle, falling leaves, split), vdlToEffectSpec NÃO deve
 * empurrar overrides físicos relacionados a esses modificadores.
 *
 * Critério: overrides são opcionais — chaves específicas de modificador
 * permanecem `undefined` quando o termo não aparece, e flags ficam `false`.
 * Caliber/energy/velocity continuam presentes (são derivados sempre).
 */
import { describe, it, expect } from 'vitest';
import { vdlToEffectSpec } from '../vdlEffectMapper';

const BASELINE = '75mm Red Peony';

describe('vdlToEffectSpec — defaults sem modificadores exóticos', () => {
  it('baseline 75mm Red Peony: todas as flags de modificador são false', () => {
    const spec = vdlToEffectSpec(BASELINE);
    expect(spec.modifiers.crackle).toBe(false);
    expect(spec.modifiers.glitter).toBe(false);
    expect(spec.modifiers.strobe).toBe(false);
    expect(spec.modifiers.noTrail).toBe(false);
    expect(spec.modifiers.report).toBe(false);
    expect(spec.modifiers.twinkle).toBe(false);
    expect(spec.modifiers.splitStars).toBe(false);
    expect(spec.modifiers.pistil).toBe(false);
  });

  it('sem crackle: turbulenceFactor e emberPersistence ficam undefined', () => {
    const o = vdlToEffectSpec(BASELINE).physicsOverrides;
    expect(o.turbulenceFactor).toBeUndefined();
    // emberPersistence só sobe via crackle/glitter/twinkle — sem nenhum, undefined
    expect(o.emberPersistence).toBeUndefined();
  });

  it('sem glitter: trailBrightness fica undefined (não há boost de spark)', () => {
    const o = vdlToEffectSpec(BASELINE).physicsOverrides;
    expect(o.trailBrightness).toBeUndefined();
  });

  it('sem strobe/crackle: flickerIntensity fica undefined', () => {
    const o = vdlToEffectSpec(BASELINE).physicsOverrides;
    expect(o.flickerIntensity).toBeUndefined();
  });

  it('sem no trail: trailLength NÃO é zerado (permanece undefined → família decide)', () => {
    const o = vdlToEffectSpec(BASELINE).physicsOverrides;
    expect(o.trailLength).toBeUndefined();
  });

  it('sem report: flashIntensity e smokeYield ficam undefined', () => {
    const o = vdlToEffectSpec(BASELINE).physicsOverrides;
    expect(o.flashIntensity).toBeUndefined();
    expect(o.smokeYield).toBeUndefined();
  });

  it('sem falling leaves/willow: gravityMultiplier e dragCoefficient ficam undefined', () => {
    const o = vdlToEffectSpec(BASELINE).physicsOverrides;
    expect(o.gravityMultiplier).toBeUndefined();
    expect(o.dragCoefficient).toBeUndefined();
  });

  it('sem split: releaseDuration/releaseCurve ficam undefined', () => {
    const o = vdlToEffectSpec(BASELINE).physicsOverrides as Record<string, unknown>;
    expect(o.releaseDuration).toBeUndefined();
    expect(o.releaseCurve).toBeUndefined();
  });

  it('sem kamuro: familyName cai no default da família declarada (peony)', () => {
    const spec = vdlToEffectSpec(BASELINE);
    expect(spec.familyName).toBe('peony');
    // sem kamuro implícito → não aplica gravity boost de kamuro
    expect(spec.physicsOverrides.gravityMultiplier).toBeUndefined();
  });

  it('caliber/energy/velocity/mass SEMPRE estão presentes (derivados, não opcionais)', () => {
    const o = vdlToEffectSpec(BASELINE).physicsOverrides;
    expect(o.energyTotal).toBeGreaterThan(0);
    expect(o.burstVelocity).toBeGreaterThan(0);
    expect(o.particleMass).toBeGreaterThan(0);
    expect(o.starCount).toBeGreaterThan(0);
  });

  it('VDL minimalista ("Peony") não inventa modificadores nem overrides', () => {
    const spec = vdlToEffectSpec('Peony');
    // forceTrail é derivado da cor (impliesTrail), não é "modificador exótico"
    const exoticMods = ['crackle', 'glitter', 'strobe', 'noTrail', 'report', 'twinkle', 'splitStars', 'pistil'] as const;
    for (const k of exoticMods) {
      expect(spec.modifiers[k]).toBe(false);
    }
    const o = spec.physicsOverrides;
    expect(o.turbulenceFactor).toBeUndefined();
    expect(o.flickerIntensity).toBeUndefined();
    expect(o.trailBrightness).toBeUndefined();
    expect(o.flashIntensity).toBeUndefined();
    expect(o.gravityMultiplier).toBeUndefined();
  });

  it('adicionar UM modificador NÃO ativa flags de outros', () => {
    const spec = vdlToEffectSpec('75mm Gold Peony with Crackle');
    expect(spec.modifiers.crackle).toBe(true);
    expect(spec.modifiers.glitter).toBe(false);
    expect(spec.modifiers.strobe).toBe(false);
    expect(spec.modifiers.noTrail).toBe(false);
    expect(spec.modifiers.report).toBe(false);
    // glitter-only key não deve aparecer só por causa de crackle
    // (trailBrightness é setado por glitter; crackle não toca)
    expect(spec.physicsOverrides.trailBrightness).toBeUndefined();
    // gravityMultiplier é só leaves/willow
    expect(spec.physicsOverrides.gravityMultiplier).toBeUndefined();
  });
});
