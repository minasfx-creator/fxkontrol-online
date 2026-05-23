/**
 * Guardião: vdlToEffectSpec deve SATURAR calibres fora do range industrial
 * real (25mm..450mm) sem quebrar (sem NaN, Infinity, energy negativa,
 * starCount=0). Strings degeneradas tampouco devem lançar exceção.
 *
 * Range industrial:
 *   - mínimo 25mm  (menor cake comercial)
 *   - máximo 450mm (recorde mundial Steel Beach 1988)
 *
 * Fora desse range: clamp transparente; spec.caliberMM reflete o valor saturado.
 */
import { describe, it, expect } from 'vitest';
import { vdlToEffectSpec } from '../vdlEffectMapper';

const PHYSICS_NUMERIC_KEYS = [
  'energyTotal',
  'burstVelocity',
  'particleMass',
  'starCount',
] as const;

function assertSaneOverrides(spec: ReturnType<typeof vdlToEffectSpec>, label: string) {
  const o = spec.physicsOverrides as Record<string, unknown>;
  for (const k of PHYSICS_NUMERIC_KEYS) {
    const v = o[k] as number | undefined;
    expect(Number.isFinite(v ?? 0), `${label} :: ${k} deve ser finito (recebeu ${v})`).toBe(true);
    expect((v ?? 0) > 0, `${label} :: ${k} deve ser > 0 (recebeu ${v})`).toBe(true);
  }
}

describe('vdlToEffectSpec — saturação de calibre fora do range', () => {
  it('caliber 0mm satura para mínimo 25mm sem zerar overrides', () => {
    const spec = vdlToEffectSpec('0mm Red Peony');
    expect(spec.caliberMM).toBe(25);
    assertSaneOverrides(spec, '0mm');
  });

  it('caliber 1mm é elevado para 25mm (mínimo industrial)', () => {
    const spec = vdlToEffectSpec('1mm Red Peony');
    expect(spec.caliberMM).toBe(25);
    assertSaneOverrides(spec, '1mm');
  });

  it('caliber negativo é tratado pelo |·| e clamp', () => {
    const spec = vdlToEffectSpec('-50mm Red Peony');
    expect(spec.caliberMM).toBe(50); // |-50| = 50 dentro do range
    assertSaneOverrides(spec, '-50mm');
  });

  it('caliber 1000mm satura para máximo 450mm (recorde mundial)', () => {
    const spec = vdlToEffectSpec('1000mm Red Peony');
    expect(spec.caliberMM).toBe(450);
    assertSaneOverrides(spec, '1000mm');
  });

  it('caliber 5000mm também satura para 450mm sem explodir', () => {
    const spec = vdlToEffectSpec('5000mm Red Peony');
    expect(spec.caliberMM).toBe(450);
    const e1000 = vdlToEffectSpec('1000mm Red Peony').physicsOverrides.energyTotal!;
    const e5000 = spec.physicsOverrides.energyTotal!;
    expect(e5000).toBe(e1000); // mesma saturação ⇒ mesma energia
    expect(e5000).toBeLessThan(2000); // teto sane: 450mm ≈ 234x base; longe de 36k+
    assertSaneOverrides(spec, '5000mm');
  });

  it('caliber ausente (sem token mm) usa fallback 75mm da família', () => {
    const spec = vdlToEffectSpec('Red Peony');
    expect(spec.caliberMM).toBeGreaterThanOrEqual(25);
    expect(spec.caliberMM).toBeLessThanOrEqual(450);
    assertSaneOverrides(spec, 'no caliber');
  });

  it('strings degeneradas não lançam exceção', () => {
    const inputs = ['', '   ', 'banana', '???', 'mm', '0', '0mm', '0mm 0mm 0mm'];
    for (const v of inputs) {
      expect(() => vdlToEffectSpec(v), `input "${v}"`).not.toThrow();
      const spec = vdlToEffectSpec(v);
      assertSaneOverrides(spec, `degen "${v}"`);
    }
  });

  it('saturação preserva monotonicidade nos extremos (5000 ≥ 1000 ≥ 100)', () => {
    const a = vdlToEffectSpec('100mm Red Peony').physicsOverrides.energyTotal!;
    const b = vdlToEffectSpec('1000mm Red Peony').physicsOverrides.energyTotal!;
    const c = vdlToEffectSpec('5000mm Red Peony').physicsOverrides.energyTotal!;
    expect(b).toBeGreaterThanOrEqual(a);
    expect(c).toBeGreaterThanOrEqual(b); // 1000 e 5000 viram 450 → igual, mas ≥
  });

  it('starCount nunca é 0 mesmo em caliber mínimo', () => {
    const spec = vdlToEffectSpec('0mm Red Peony');
    expect(spec.physicsOverrides.starCount).toBeGreaterThanOrEqual(24);
  });

  it('flags de modificadores continuam corretas em caliber extremo', () => {
    const spec = vdlToEffectSpec('5000mm Gold Crackle Glitter Peony with Report');
    expect(spec.modifiers.crackle).toBe(true);
    expect(spec.modifiers.glitter).toBe(true);
    expect(spec.modifiers.report).toBe(true);
    expect(spec.caliberMM).toBe(450);
    assertSaneOverrides(spec, 'extreme + mods');
  });
});
