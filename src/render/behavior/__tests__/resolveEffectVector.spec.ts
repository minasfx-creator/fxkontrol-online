import { describe, it, expect } from 'vitest';
import { resolveEffectVector } from '../resolveEffectVector';
import { EFFECT_BEHAVIOR_MAP } from '../effectBehaviorMap';

const PEONY = EFFECT_BEHAVIOR_MAP['shell-peony'];
const COMET = EFFECT_BEHAVIOR_MAP.comet;
const MINE = EFFECT_BEHAVIOR_MAP.mine;
const GERB = EFFECT_BEHAVIOR_MAP.gerb;

function close(a: number, b: number, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

describe('resolveEffectVector', () => {
  it('omni mode retorna +Y unit (peony)', () => {
    const r = resolveEffectVector({ behavior: PEONY });
    expect(close(r.unit.x, 0)).toBe(true);
    expect(close(r.unit.y, 1)).toBe(true);
    expect(close(r.unit.z, 0)).toBe(true);
    expect(r.modeUsed).toBe('omni');
  });

  it('PTS pan=0/tilt=0 → +Y up', () => {
    const r = resolveEffectVector({
      behavior: COMET,
      pts: { pan: 0, tilt: 0, spin: 0 },
      jitterSeed: 0.5,
    });
    // jitter ~1.5° → y ainda muito perto de 1
    expect(r.unit.y).toBeGreaterThan(0.999);
  });

  it('PTS tilt=30° produz vetor inclinado, não vertical', () => {
    // Sem jitter pra checar o vetor exato (use behavior c/ jitter=0)
    const noJitter = { ...COMET, launch: { ...COMET.launch, jitterDeg: 0 } };
    const r = resolveEffectVector({
      behavior: noJitter,
      pts: { pan: 0, tilt: 30 },
    });
    // Rx(30°) aplicado a +Y: (0, cos30, sin30) ≈ (0, 0.866, 0.5)
    expect(close(r.unit.x, 0, 1e-9)).toBe(true);
    expect(close(r.unit.y, Math.cos((30 * Math.PI) / 180), 1e-6)).toBe(true);
    expect(close(r.unit.z, Math.sin((30 * Math.PI) / 180), 1e-6)).toBe(true);
  });

  it('PTS Fig2 (pan=90, tilt=45) aponta lateral-up (sin45, cos45, 0)', () => {
    const noJitter = { ...COMET, launch: { ...COMET.launch, jitterDeg: 0 } };
    const r = resolveEffectVector({
      behavior: noJitter,
      pts: { pan: 90, tilt: 45 },
    });
    const s = Math.sin((45 * Math.PI) / 180);
    const c = Math.cos((45 * Math.PI) / 180);
    expect(close(r.unit.x, s, 1e-6)).toBe(true);
    expect(close(r.unit.y, c, 1e-6)).toBe(true);
    expect(close(r.unit.z, 0, 1e-6)).toBe(true);
  });

  it('pattern-fan angle=20° → vetor inclinado pra +X', () => {
    const noJitter = { ...MINE, launch: { ...MINE.launch, jitterDeg: 0 } };
    const r = resolveEffectVector({
      behavior: noJitter,
      patternAngleDeg: 20,
    });
    expect(r.unit.x).toBeGreaterThan(0);
    expect(r.unit.y).toBeGreaterThan(0.9);
    expect(close(r.unit.z, 0, 1e-9)).toBe(true);
  });

  it('parent-vector pitch=45° → vetor 45° entre +Y e +Z', () => {
    const noJitter = { ...GERB, launch: { ...GERB.launch, jitterDeg: 0 } };
    const r = resolveEffectVector({
      behavior: noJitter,
      parentPitchDeg: 45,
    });
    expect(close(r.unit.y, Math.sin(Math.PI / 4), 1e-6)).toBe(true);
    expect(close(r.unit.z, Math.cos(Math.PI / 4), 1e-6)).toBe(true);
  });

  it('parentHeading=90° rotaciona vetor PTS em torno de Y', () => {
    const noJitter = { ...COMET, launch: { ...COMET.launch, jitterDeg: 0 } };
    const r = resolveEffectVector({
      behavior: noJitter,
      pts: { pan: 0, tilt: 30 },
      parentHeadingDeg: 90,
    });
    // Sem heading: z=sin30. Com Ry(90°): novo x=sin30, novo z≈0
    expect(close(r.unit.x, Math.sin((30 * Math.PI) / 180), 1e-6)).toBe(true);
    expect(close(r.unit.z, 0, 1e-6)).toBe(true);
  });

  it('suggestedSpeed é a média do range initialSpeed', () => {
    const r = resolveEffectVector({ behavior: COMET });
    expect(r.suggestedSpeed).toBe((35 + 55) / 2);
  });

  it('vetor sempre normalizado', () => {
    const r = resolveEffectVector({
      behavior: COMET,
      pts: { pan: 37, tilt: 62 },
      parentHeadingDeg: 23,
      jitterSeed: 0.71,
    });
    const m = Math.hypot(r.unit.x, r.unit.y, r.unit.z);
    expect(Math.abs(m - 1)).toBeLessThan(1e-6);
  });

  it('mesmo jitterSeed → resultado determinístico', () => {
    const a = resolveEffectVector({ behavior: COMET, pts: { tilt: 10 }, jitterSeed: 0.3 });
    const b = resolveEffectVector({ behavior: COMET, pts: { tilt: 10 }, jitterSeed: 0.3 });
    expect(a.unit).toEqual(b.unit);
  });
});
