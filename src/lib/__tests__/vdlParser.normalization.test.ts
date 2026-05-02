/**
 * Guardião: parseVDL deve normalizar espaços, ordem de tokens e
 * capitalização ANTES de qualquer consumidor (em especial vdlToEffectSpec)
 * derivar overrides físicos.
 *
 * Critério: variantes equivalentes de uma mesma string VDL precisam
 * produzir o mesmo familyName, caliberMM, conjunto de modificadores e
 * (consequentemente) os mesmos overrides físicos relevantes.
 */
import { describe, it, expect } from 'vitest';
import { parseVDL } from '../vdlParser';
import { vdlToEffectSpec } from '../vdlEffectMapper';

const PHYSICS_KEYS = [
  'energyTotal',
  'burstVelocity',
  'particleMass',
  'starCount',
  'flickerIntensity',
  'turbulenceFactor',
  'emberPersistence',
  'trailLength',
  'trailBrightness',
  'flashIntensity',
  'smokeYield',
  'gravityMultiplier',
  'dragCoefficient',
] as const;

function physicsSnapshot(vdl: string) {
  const o = vdlToEffectSpec(vdl).physicsOverrides as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of PHYSICS_KEYS) out[k] = o[k];
  return out;
}

function modifierSet(vdl: string): string[] {
  const m = vdlToEffectSpec(vdl).modifiers;
  return Object.entries(m)
    .filter(([, v]) => v === true)
    .map(([k]) => k)
    .sort();
}

describe('parseVDL — normalização (espaços, ordem, capitalização)', () => {
  it('whitespace extra (espaços duplos, tabs, trim) é colapsado', () => {
    const a = parseVDL('75mm Red Peony');
    const b = parseVDL('  75mm   Red    Peony  ');
    const c = parseVDL('\t75mm\tRed\tPeony\n');
    expect(b.caliberMM).toBe(a.caliberMM);
    expect(b.typeName.toLowerCase()).toBe(a.typeName.toLowerCase());
    expect(c.caliberMM).toBe(a.caliberMM);
    expect(c.typeName.toLowerCase()).toBe(a.typeName.toLowerCase());
    expect(b.colorNames.map(s => s.toLowerCase()))
      .toEqual(a.colorNames.map(s => s.toLowerCase()));
  });

  it('capitalização variada produz mesma família e mesmos modificadores', () => {
    const variants = [
      '75mm Red Peony with Crackle',
      '75MM RED PEONY WITH CRACKLE',
      '75mm red peony with crackle',
      '75mm  Red   Peony   With   Crackle',
    ];
    const baseFamily = vdlToEffectSpec(variants[0]).familyName;
    const baseMods = modifierSet(variants[0]);
    for (const v of variants.slice(1)) {
      const spec = vdlToEffectSpec(v);
      expect(spec.familyName).toBe(baseFamily);
      expect(spec.caliberMM).toBe(75);
      expect(modifierSet(v)).toEqual(baseMods);
    }
  });

  it('ordem dos modificadores não altera overrides físicos relevantes', () => {
    const a = physicsSnapshot('100mm Gold Crackle Glitter Peony');
    const b = physicsSnapshot('100mm Gold Glitter Crackle Peony');
    const c = physicsSnapshot('100mm Crackle Gold Glitter Peony');
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it('"No Trail" é reconhecido em qualquer caixa e zera trail', () => {
    for (const v of ['75mm Gold No Trail Peony', '75mm gold NO TRAIL peony', '75mm Gold no trail Peony']) {
      const spec = vdlToEffectSpec(v);
      expect(spec.modifiers.noTrail).toBe(true);
      expect(spec.physicsOverrides.trailLength).toBe(0);
      expect(spec.physicsOverrides.trailBrightness).toBe(0);
    }
  });

  it('caliber tolera espaço entre número e "mm" e mantém escala física', () => {
    const a = vdlToEffectSpec('150mm Gold Kamuro');
    const b = vdlToEffectSpec('150 mm Gold Kamuro');
    expect(b.caliberMM).toBe(a.caliberMM);
    expect(b.familyName).toBe(a.familyName);
    expect(b.physicsOverrides.energyTotal).toBeCloseTo(a.physicsOverrides.energyTotal ?? 0, 5);
    expect(b.physicsOverrides.burstVelocity).toBeCloseTo(a.physicsOverrides.burstVelocity ?? 0, 5);
  });

  it('modificadores em camelCase / case misto continuam ativando flags', () => {
    const spec = vdlToEffectSpec('75mm White StRoBe Peony');
    expect(spec.modifiers.strobe).toBe(true);
    expect(spec.physicsOverrides.flickerIntensity ?? 0).toBeGreaterThanOrEqual(0.8);
  });

  it('cor antes ou depois do tipo produz mesma cor primária', () => {
    const a = vdlToEffectSpec('75mm Red Peony');
    const b = vdlToEffectSpec('75mm Peony Red');
    expect(b.color.r).toBeCloseTo(a.color.r, 3);
    expect(b.color.g).toBeCloseTo(a.color.g, 3);
    expect(b.color.b).toBeCloseTo(a.color.b, 3);
  });

  it('whitespace ao redor de vírgulas/separadores não quebra parsing', () => {
    const a = parseVDL('100mm Red to Gold Peony');
    const b = parseVDL('100mm  Red  to  Gold  Peony');
    expect(b.colorNames.map(s => s.toLowerCase()))
      .toEqual(a.colorNames.map(s => s.toLowerCase()));
    expect(b.caliberMM).toBe(a.caliberMM);
  });

  it('idempotência: re-parsear o raw produz mesmo overrides', () => {
    const v = '100mm Gold Crackle Glitter Peony with Report';
    const first = physicsSnapshot(v);
    const second = physicsSnapshot(v);
    expect(second).toEqual(first);
  });
});
