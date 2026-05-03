import { describe, it, expect } from 'vitest';
import { pickAmbientHints, sampleHintPosition } from '../ambientChoreographer';

describe('ambientChoreographer', () => {
  it('picks 1 hint for calm, 3 for busy, 5 for frantic', () => {
    expect(pickAmbientHints({ preset: 'calm', seed: 1 }).length).toBe(1);
    expect(pickAmbientHints({ preset: 'busy', seed: 1 }).length).toBe(3);
    expect(pickAmbientHints({ preset: 'frantic', seed: 1 }).length).toBe(5);
  });

  it('is deterministic with the same seed', () => {
    const a = pickAmbientHints({ preset: 'busy', seed: 7 });
    const b = pickAmbientHints({ preset: 'busy', seed: 7 });
    expect(a.map((h) => h.id)).toEqual(b.map((h) => h.id));
  });

  it('sampleHintPosition loops through waypoints', () => {
    const hint = {
      id: 'x', npcId: 'y',
      waypoints: [[0, 0, 0], [10, 0, 0]] as [number, number, number][],
      durationMs: 1000,
    };
    const p0 = sampleHintPosition(hint, 0);
    const pHalf = sampleHintPosition(hint, 250);
    const pLoop = sampleHintPosition(hint, 1000);
    expect(p0[0]).toBeCloseTo(0);
    expect(pHalf[0]).toBeGreaterThan(0);
    expect(pHalf[0]).toBeLessThan(10);
    expect(pLoop[0]).toBeCloseTo(0);
  });
});
