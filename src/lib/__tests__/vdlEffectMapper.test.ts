/**
 * Guardião: vdlToEffectSpec deve produzir overrides físicos coerentes
 * para uma matriz de strings VDL canônicas.
 *
 * Estes testes travam a "interpretação realista" — qualquer regressão
 * em CalibrationLayer ou no parser que mude semântica derruba o sinal.
 */
import { describe, it, expect } from 'vitest';
import { vdlToEffectSpec } from '../vdlEffectMapper';

describe('vdlToEffectSpec — physics overrides matrix', () => {
  it('peony 75mm Red é a baseline calibrada (sem boosts exóticos)', () => {
    const spec = vdlToEffectSpec('75mm Red Peony');
    expect(spec.familyName).toBe('peony');
    expect(spec.color.r).toBeGreaterThan(0.8);
    expect(spec.color.g).toBeLessThan(0.2);
    expect(spec.caliberMM).toBe(75);
    // baseline: nenhum modificador → sem flicker forte, sem turbulência
    expect(spec.physicsOverrides.flickerIntensity ?? 0).toBeLessThan(0.5);
    expect(spec.physicsOverrides.turbulenceFactor ?? 0).toBeLessThan(0.2);
    expect(spec.physicsOverrides.trailLength ?? 1).toBeGreaterThan(0);
    expect(spec.modifiers.crackle).toBe(false);
    expect(spec.modifiers.glitter).toBe(false);
  });

  it('Crackle aumenta turbulência, ember persistence e flicker', () => {
    const base = vdlToEffectSpec('75mm Gold Peony');
    const crk = vdlToEffectSpec('75mm Gold Peony with Crackle');
    expect(crk.modifiers.crackle).toBe(true);
    expect(crk.physicsOverrides.turbulenceFactor ?? 0)
      .toBeGreaterThan(base.physicsOverrides.turbulenceFactor ?? 0);
    expect(crk.physicsOverrides.emberPersistence ?? 0).toBeGreaterThanOrEqual(1.5);
    expect(crk.physicsOverrides.flickerIntensity ?? 0).toBeGreaterThan(0.25);
  });

  it('Glitter aumenta starCount e brilho de trail', () => {
    const base = vdlToEffectSpec('100mm Silver Peony');
    const glt = vdlToEffectSpec('100mm Silver Glitter Peony');
    expect(glt.modifiers.glitter).toBe(true);
    expect(glt.physicsOverrides.starCount ?? 0)
      .toBeGreaterThan(base.physicsOverrides.starCount ?? 0);
    expect(glt.physicsOverrides.trailBrightness ?? 0).toBeGreaterThan(0.5);
    expect(glt.physicsOverrides.emberPersistence ?? 0).toBeGreaterThanOrEqual(1.2);
  });

  it('No Trail zera trailLength e trailBrightness', () => {
    const spec = vdlToEffectSpec('75mm Gold No Trail Peony');
    expect(spec.modifiers.noTrail).toBe(true);
    expect(spec.physicsOverrides.trailLength).toBe(0);
    expect(spec.physicsOverrides.trailBrightness).toBe(0);
  });

  it('Kamuro mapeia para família "kamuro" (não cai em peony)', () => {
    const spec = vdlToEffectSpec('150mm Gold Kamuro');
    expect(spec.familyName).toBe('kamuro');
    expect(spec.caliberMM).toBe(150);
    // 150mm > 75mm baseline → mais energia e starCount
    expect(spec.physicsOverrides.energyTotal ?? 0).toBeGreaterThan(1);
    expect(spec.physicsOverrides.burstVelocity ?? 0).toBeGreaterThan(45);
  });

  it('Willow/Falling Leaves aumentam drag e gravity multiplier', () => {
    const spec = vdlToEffectSpec('100mm Gold Willow Falling Leaves');
    expect(spec.physicsOverrides.gravityMultiplier).toBeGreaterThan(1);
    expect(spec.physicsOverrides.dragCoefficient).toBeGreaterThan(0.1);
  });

  it('Salute/Report aumenta flashIntensity e smokeYield', () => {
    const base = vdlToEffectSpec('75mm Gold Peony');
    const rep = vdlToEffectSpec('75mm Red Peony with Report');
    expect(rep.modifiers.report).toBe(true);
    expect(rep.physicsOverrides.flashIntensity ?? 0)
      .toBeGreaterThan(base.physicsOverrides.flashIntensity ?? 0);
    expect(rep.physicsOverrides.smokeYield ?? 0)
      .toBeGreaterThan(base.physicsOverrides.smokeYield ?? 0);
  });

  it('Caliber maior escala energia, velocidade e massa monotonicamente', () => {
    const small = vdlToEffectSpec('50mm Red Peony');
    const big = vdlToEffectSpec('200mm Red Peony');
    expect(big.physicsOverrides.energyTotal ?? 0)
      .toBeGreaterThan(small.physicsOverrides.energyTotal ?? 0);
    expect(big.physicsOverrides.burstVelocity ?? 0)
      .toBeGreaterThan(small.physicsOverrides.burstVelocity ?? 0);
    expect(big.physicsOverrides.particleMass ?? 0)
      .toBeGreaterThan(small.physicsOverrides.particleMass ?? 0);
  });

  it('Strobe ativa flickerIntensity alto', () => {
    const spec = vdlToEffectSpec('75mm White Strobe Peony');
    expect(spec.modifiers.strobe).toBe(true);
    expect(spec.physicsOverrides.flickerIntensity ?? 0).toBeGreaterThanOrEqual(0.8);
  });

  it('Combinação Crackle + Glitter empilha overrides sem zerar starCount', () => {
    const spec = vdlToEffectSpec('100mm Gold Crackle Glitter Peony');
    expect(spec.modifiers.crackle).toBe(true);
    expect(spec.modifiers.glitter).toBe(true);
    expect(spec.physicsOverrides.starCount ?? 0).toBeGreaterThan(100);
    expect(spec.physicsOverrides.turbulenceFactor ?? 0).toBeGreaterThan(0.3);
    expect(spec.physicsOverrides.emberPersistence ?? 0).toBeGreaterThanOrEqual(1.2);
  });
});
