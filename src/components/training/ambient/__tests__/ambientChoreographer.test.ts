import { describe, it, expect } from 'vitest';
import {
  pickAmbientHints,
  sampleHintPosition,
  createMicroEventScheduler,
  tickMicroEvents,
  resolveMicroEvent,
} from '../ambientChoreographer';

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

describe('microEventScheduler', () => {
  it('produces zero events when liveCount has reached cap', () => {
    const s = createMicroEventScheduler({ preset: 'frantic', npcPool: ['a', 'b'], seed: 42 });
    s.liveCount = s.maxLive;
    const evs = tickMicroEvents(s, 100, 100);
    expect(evs).toEqual([]);
  });

  it('respects per-kind cooldown', () => {
    const s = createMicroEventScheduler({ preset: 'frantic', npcPool: ['x'], seed: 3 });
    let now = 0;
    const all: string[] = [];
    for (let i = 0; i < 200; i++) {
      now += 100;
      const evs = tickMicroEvents(s, 100, now);
      evs.forEach((e) => { all.push(`${e.kind}@${e.emittedAtMs}`); resolveMicroEvent(s); });
    }
    // No two same-kind events within their cooldown
    const byKind: Record<string, number[]> = {};
    for (const tag of all) {
      const [kind, ts] = tag.split('@');
      (byKind[kind] ??= []).push(Number(ts));
    }
    for (const ts of Object.values(byKind)) {
      ts.sort((a, b) => a - b);
      for (let i = 1; i < ts.length; i++) {
        expect(ts[i] - ts[i - 1]).toBeGreaterThanOrEqual(4500); // smallest cooldown in bank
      }
    }
  });

  it('is deterministic with the same seed', () => {
    const run = () => {
      const s = createMicroEventScheduler({ preset: 'busy', npcPool: ['n1', 'n2'], seed: 9 });
      const out: string[] = [];
      for (let i = 0; i < 50; i++) {
        const evs = tickMicroEvents(s, 100, i * 100);
        evs.forEach((e) => { out.push(`${e.kind}:${e.npcId}`); resolveMicroEvent(s); });
      }
      return out;
    };
    expect(run()).toEqual(run());
  });

  it('emits only valid kinds', () => {
    const s = createMicroEventScheduler({ preset: 'frantic', npcPool: ['n'], seed: 11 });
    const valid = new Set(['chatter', 'glance', 'gesture', 'drop-tool', 'walkie-pop', 'cough']);
    for (let i = 0; i < 100; i++) {
      const evs = tickMicroEvents(s, 100, i * 100);
      evs.forEach((e) => { expect(valid.has(e.kind)).toBe(true); resolveMicroEvent(s); });
    }
  });
});
