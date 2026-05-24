import { describe, it, expect } from 'vitest';
import {
  EFFECT_BEHAVIOR_MAP,
  ALL_BEHAVIOR_KINDS,
  getBehavior,
} from '../effectBehaviorMap';

describe('effectBehaviorMap', () => {
  it('cobre as 21 famílias canônicas', () => {
    expect(ALL_BEHAVIOR_KINDS.length).toBe(21);
  });

  it('todos os valores numéricos são finitos e sãos', () => {
    for (const kind of ALL_BEHAVIOR_KINDS) {
      const b = EFFECT_BEHAVIOR_MAP[kind];
      expect(b.kind).toBe(kind);
      expect(b.motion.gravity).toBeGreaterThanOrEqual(0);
      expect(b.motion.gravity).toBeLessThan(15);
      expect(b.motion.drag).toBeGreaterThan(0);
      expect(b.motion.drag).toBeLessThanOrEqual(1);
      const [vmin, vmax] = b.motion.initialSpeed;
      expect(vmin).toBeGreaterThanOrEqual(0);
      expect(vmax).toBeGreaterThanOrEqual(vmin);
      expect(vmax).toBeLessThan(200);
      expect(b.motion.spread.coneDeg).toBeGreaterThanOrEqual(0);
      expect(b.motion.spread.coneDeg).toBeLessThanOrEqual(360);
      expect(b.decay.lifeMul).toBeGreaterThan(0);
      expect(b.tail.lengthMul).toBeGreaterThanOrEqual(0);
      expect(b.launch.jitterDeg).toBeGreaterThanOrEqual(0);
      expect(b.launch.jitterDeg).toBeLessThan(30);
    }
  });

  it('falling-leaves usa gravidade reduzida vs peony', () => {
    expect(EFFECT_BEHAVIOR_MAP['falling-leaves'].motion.gravity).toBeLessThan(
      EFFECT_BEHAVIOR_MAP['shell-peony'].motion.gravity
    );
  });

  it('falling-leaves tem swirl tangencial', () => {
    expect(EFFECT_BEHAVIOR_MAP['falling-leaves'].motion.swirl?.axis).toBe(
      'tangent'
    );
    expect(EFFECT_BEHAVIOR_MAP['falling-leaves'].motion.swirl!.rpm).toBeGreaterThan(
      0
    );
  });

  it('salute tem expansão violenta e decay curtíssimo', () => {
    const s = EFFECT_BEHAVIOR_MAP['shell-salute'];
    expect(s.motion.initialSpeed[0]).toBeGreaterThan(100);
    expect(s.decay.lifeMul).toBeLessThan(0.5);
    expect(s.decay.colorPhase).toBe('flat');
  });

  it('mine usa pattern-fan + bias silhouette', () => {
    const m = EFFECT_BEHAVIOR_MAP.mine;
    expect(m.launch.mode).toBe('pattern-fan');
    expect(m.motion.spread.bias).toBe('silhouette');
  });

  it('comet usa PTS', () => {
    expect(EFFECT_BEHAVIOR_MAP.comet.launch.mode).toBe('pts');
  });

  it('crossette tem bouquetSplit', () => {
    const c = EFFECT_BEHAVIOR_MAP['shell-crossette'];
    expect(c.motion.bouquetSplit).toBeDefined();
    expect(c.motion.bouquetSplit!.childCount).toBeGreaterThan(0);
    expect(c.motion.bouquetSplit!.atLifeRatio).toBeGreaterThan(0);
    expect(c.motion.bouquetSplit!.atLifeRatio).toBeLessThan(1);
  });

  it('willow tem tail willow-drag longo', () => {
    const w = EFFECT_BEHAVIOR_MAP['shell-willow'];
    expect(w.tail.type).toBe('willow-drag');
    expect(w.tail.lengthMul).toBeGreaterThanOrEqual(2);
  });

  it('getBehavior é case-insensitive e devolve null pra desconhecido', () => {
    expect(getBehavior('Comet')).toBeTruthy();
    expect(getBehavior('COMET')).toBeTruthy();
    expect(getBehavior('does-not-exist')).toBeNull();
  });

  it('lancework e setpiece são estáticos (gravity=0, speed=0)', () => {
    for (const k of ['lancework', 'setpiece'] as const) {
      const b = EFFECT_BEHAVIOR_MAP[k];
      expect(b.motion.gravity).toBe(0);
      expect(b.motion.initialSpeed[1]).toBe(0);
    }
  });
});
