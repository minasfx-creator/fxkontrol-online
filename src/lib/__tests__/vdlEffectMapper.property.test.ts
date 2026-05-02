/**
 * Property-based tests para vdlToEffectSpec.
 *
 * Gera strings VDL aleatórias (caliber × cor × família × modificadores ×
 * permutação de tokens × espaços/caixa) e valida invariantes que devem
 * valer SEMPRE, independente da string concreta:
 *
 *   I1. caliberMM parsado == caliberMM gerado (coerência do parser).
 *   I2. trailLength: noTrail ⇒ trailLength === 0; ausente ⇒ undefined.
 *   I3. Monotonicidade de energia: caliber maior ⇒ energyTotal ≥ menor
 *       (mesma família, mesmos modificadores, mesma cor).
 *   I4. Monotonicidade de burstVelocity: idem energia.
 *   I5. Idempotência: parsear duas vezes a mesma string produz mesmos overrides.
 *   I6. Modificador presente ⇒ flag correspondente é true.
 *   I7. Cor primária ∈ [0,1] em todos os canais.
 *
 * RNG é seedado e determinístico — falhas são reproduzíveis.
 */
import { describe, it, expect } from 'vitest';
import { vdlToEffectSpec } from '../vdlEffectMapper';

// ── RNG seedável (mulberry32) ─────────────────────────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CALIBERS = [50, 75, 100, 125, 150, 200, 250, 300];
const COLORS = ['Red', 'Gold', 'Silver', 'Blue', 'Green', 'White', 'Purple', 'Pink', 'Cyan'];
const FAMILIES = ['Peony', 'Chrysanthemum', 'Willow', 'Brocade', 'Kamuro', 'Dahlia', 'Ring'];
const MOD_POOL = ['Crackle', 'Glitter', 'Strobe', 'with Report', 'No Trail'];

interface GenSpec {
  caliber: number;
  color: string;
  family: string;
  mods: string[];
  raw: string;
}

function randPick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function jitterCase(rng: () => number, s: string): string {
  if (rng() < 0.33) return s.toUpperCase();
  if (rng() < 0.5) return s.toLowerCase();
  return s;
}

function jitterSpaces(rng: () => number, s: string): string {
  // injeta 1-3 espaços aleatórios entre tokens
  return s.split(' ').join(rng() < 0.5 ? '  ' : ' ');
}

function generateVdl(rng: () => number, opts?: Partial<GenSpec>): GenSpec {
  const caliber = opts?.caliber ?? randPick(rng, CALIBERS);
  const color = opts?.color ?? randPick(rng, COLORS);
  const family = opts?.family ?? randPick(rng, FAMILIES);
  // 0-3 modificadores únicos
  const nMods = opts?.mods ? opts.mods.length : Math.floor(rng() * 4);
  const mods = opts?.mods ?? shuffle(rng, MOD_POOL).slice(0, nMods);

  const tokens = shuffle(rng, [`${caliber}mm`, color, family, ...mods]);
  let raw = tokens.join(' ');
  raw = jitterSpaces(rng, raw);
  raw = jitterCase(rng, raw);
  return { caliber, color, family, mods, raw };
}

describe('vdlToEffectSpec — property-based invariants', () => {
  it('I1: caliberMM parsado == caliberMM gerado (200 amostras)', () => {
    const rng = mulberry32(0xC0FFEE);
    for (let i = 0; i < 200; i++) {
      const g = generateVdl(rng);
      const spec = vdlToEffectSpec(g.raw);
      expect(spec.caliberMM, `caso "${g.raw}" → esperava ${g.caliber}, obteve ${spec.caliberMM}`)
        .toBe(g.caliber);
    }
  });

  it('I2: noTrail ⇒ trailLength === 0; ausente ⇒ trailLength undefined', () => {
    const rng = mulberry32(0xBEEF01);
    for (let i = 0; i < 150; i++) {
      const includeNoTrail = rng() < 0.5;
      const mods = includeNoTrail ? ['No Trail'] : [];
      const g = generateVdl(rng, { mods });
      const spec = vdlToEffectSpec(g.raw);
      if (includeNoTrail) {
        expect(spec.modifiers.noTrail, `"${g.raw}"`).toBe(true);
        expect(spec.physicsOverrides.trailLength, `"${g.raw}"`).toBe(0);
        expect(spec.physicsOverrides.trailBrightness, `"${g.raw}"`).toBe(0);
      } else {
        expect(spec.modifiers.noTrail, `"${g.raw}"`).toBe(false);
        expect(spec.physicsOverrides.trailLength, `"${g.raw}"`).toBeUndefined();
      }
    }
  });

  it('I3+I4: caliber maior ⇒ energyTotal e burstVelocity monotonicamente ≥', () => {
    const rng = mulberry32(0xDEAD11);
    for (let i = 0; i < 100; i++) {
      // mantém família/cor/modificadores fixos, varia só caliber
      const family = randPick(rng, FAMILIES);
      const color = randPick(rng, COLORS);
      const mods = shuffle(rng, MOD_POOL).slice(0, Math.floor(rng() * 3));
      const small = generateVdl(rng, { caliber: 50, family, color, mods });
      const big = generateVdl(rng, { caliber: 250, family, color, mods });
      const sSmall = vdlToEffectSpec(small.raw).physicsOverrides;
      const sBig = vdlToEffectSpec(big.raw).physicsOverrides;
      expect(sBig.energyTotal ?? 0, `energy 250 ≥ 50 :: small="${small.raw}" big="${big.raw}"`)
        .toBeGreaterThanOrEqual(sSmall.energyTotal ?? 0);
      expect(sBig.burstVelocity ?? 0, `vel 250 ≥ 50 :: small="${small.raw}" big="${big.raw}"`)
        .toBeGreaterThanOrEqual(sSmall.burstVelocity ?? 0);
      expect(sBig.particleMass ?? 0).toBeGreaterThanOrEqual(sSmall.particleMass ?? 0);
    }
  });

  it('I5: idempotência — parsear duas vezes produz overrides estruturalmente iguais', () => {
    const rng = mulberry32(0x12345);
    for (let i = 0; i < 100; i++) {
      const g = generateVdl(rng);
      const a = vdlToEffectSpec(g.raw).physicsOverrides;
      const b = vdlToEffectSpec(g.raw).physicsOverrides;
      expect(b).toEqual(a);
    }
  });

  it('I6: modificador presente na string ⇒ flag correspondente true', () => {
    const rng = mulberry32(0x99001);
    const flagMap: Record<string, keyof ReturnType<typeof vdlToEffectSpec>['modifiers']> = {
      'Crackle': 'crackle',
      'Glitter': 'glitter',
      'Strobe': 'strobe',
      'with Report': 'report',
      'No Trail': 'noTrail',
    };
    for (let i = 0; i < 150; i++) {
      const mods = shuffle(rng, MOD_POOL).slice(0, 1 + Math.floor(rng() * 3));
      const g = generateVdl(rng, { mods });
      const spec = vdlToEffectSpec(g.raw);
      for (const m of mods) {
        const flag = flagMap[m];
        expect(spec.modifiers[flag], `"${g.raw}" deveria ter ${flag}=true`).toBe(true);
      }
    }
  });

  it('I7: cor primária sempre em [0,1] em r/g/b', () => {
    const rng = mulberry32(0xAABB);
    for (let i = 0; i < 100; i++) {
      const g = generateVdl(rng);
      const c = vdlToEffectSpec(g.raw).color;
      expect(c.r).toBeGreaterThanOrEqual(0);
      expect(c.r).toBeLessThanOrEqual(1);
      expect(c.g).toBeGreaterThanOrEqual(0);
      expect(c.g).toBeLessThanOrEqual(1);
      expect(c.b).toBeGreaterThanOrEqual(0);
      expect(c.b).toBeLessThanOrEqual(1);
    }
  });

  it('I8: starCount sempre > 0 e finito (nunca NaN/Infinity)', () => {
    const rng = mulberry32(0x55AA);
    for (let i = 0; i < 100; i++) {
      const g = generateVdl(rng);
      const n = vdlToEffectSpec(g.raw).physicsOverrides.starCount ?? 0;
      expect(Number.isFinite(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });
});
