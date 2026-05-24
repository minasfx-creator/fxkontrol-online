import { describe, it, expect } from 'vitest';
import {
  defaultM1Target,
  resolveM1Target,
  validateM1CueMap,
  buildDefaultM1Plan,
  M1_TOTAL_CUES,
} from '@/lib/showvenM1CueMap';

describe('showvenM1CueMap', () => {
  it('default layout maps cue 1 → slave 1 ch 1, cue 16 → slave 1 ch 16', () => {
    expect(defaultM1Target(1)).toEqual({ slaveAddress: 1, channel: 1 });
    expect(defaultM1Target(16)).toEqual({ slaveAddress: 1, channel: 16 });
  });

  it('default layout cue 17 → slave 2 ch 1, cue 128 → slave 8 ch 16', () => {
    expect(defaultM1Target(17)).toEqual({ slaveAddress: 2, channel: 1 });
    expect(defaultM1Target(128)).toEqual({ slaveAddress: 8, channel: 16 });
  });

  it('rejects cueIndex out of range', () => {
    expect(() => defaultM1Target(0)).toThrow();
    expect(() => defaultM1Target(129)).toThrow();
  });

  it('override wins over default', () => {
    const t = resolveM1Target(1, { 1: { slaveAddress: 9, channel: 5 } });
    expect(t).toEqual({ slaveAddress: 9, channel: 5 });
  });

  it('validateM1CueMap detects collisions', () => {
    const r = validateM1CueMap([1, 17], { 17: { slaveAddress: 1, channel: 1 } });
    expect(r.ok).toBe(false);
    expect(r.collisions.length).toBe(1);
    expect(r.collisions[0].cues).toEqual([1, 17]);
  });

  it('validateM1CueMap accepts a full default plan', () => {
    const cues = Array.from({ length: M1_TOTAL_CUES }, (_, i) => i + 1);
    expect(validateM1CueMap(cues).ok).toBe(true);
  });

  it('buildDefaultM1Plan returns 128 unique targets', () => {
    const plan = buildDefaultM1Plan();
    expect(plan.length).toBe(128);
    const seen = new Set(plan.map((p) => `${p.slaveAddress}:${p.channel}`));
    expect(seen.size).toBe(128);
  });

  it('rejects invalid override targets', () => {
    expect(() => resolveM1Target(1, { 1: { slaveAddress: 99, channel: 1 } })).toThrow();
    expect(() => resolveM1Target(1, { 1: { slaveAddress: 1, channel: 0 } })).toThrow();
  });
});
