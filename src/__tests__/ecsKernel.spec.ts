import { describe, it, expect } from 'vitest';
import { EcsWorld, ENTITY_KIND, FLAG } from '@/ecs/World';
import { stepTs } from '@/ecs/tsKernel';
import { createTsKernel } from '@/ecs/kernel';

describe('ECS unified kernel', () => {
  it('spawns into SoA slots and tracks liveCount', () => {
    const w = new EcsWorld(8);
    expect(w.liveCount).toBe(0);
    const a = w.spawn({ kind: ENTITY_KIND.PYRO, pos: [1, 2, 3], lifeMs: 1000 });
    const b = w.spawn({ kind: ENTITY_KIND.DRONE, pos: [4, 5, 6], lifeMs: 500 });
    expect(a).toBe(0); expect(b).toBe(1);
    expect(w.liveCount).toBe(2);
    expect(w.pos[0]).toBe(1); expect(w.pos[1]).toBe(2); expect(w.pos[2]).toBe(3);
    expect(w.flags[a] & FLAG.ALIVE).toBeTruthy();
  });

  it('returns -1 when world is full', () => {
    const w = new EcsWorld(2);
    w.spawn({ kind: ENTITY_KIND.PARTICLE, pos: [0, 0, 0], lifeMs: 1000 });
    w.spawn({ kind: ENTITY_KIND.PARTICLE, pos: [0, 0, 0], lifeMs: 1000 });
    expect(w.spawn({ kind: ENTITY_KIND.PARTICLE, pos: [0, 0, 0], lifeMs: 1000 })).toBe(-1);
  });

  it('integrates position with velocity (no gravity)', () => {
    const w = new EcsWorld(1);
    w.spawn({ kind: ENTITY_KIND.PARTICLE, pos: [0, 0, 0], vel: [10, 0, 0], lifeMs: 1000 });
    stepTs(w, 0.1); // 0.1s
    expect(w.pos[0]).toBeCloseTo(1.0, 5);
    expect(w.vel[1]).toBe(0); // no gravity flag
  });

  it('applies gravity when HAS_GRAVITY is set', () => {
    const w = new EcsWorld(1);
    w.spawn({ kind: ENTITY_KIND.PARTICLE, pos: [0, 0, 0], vel: [0, 0, 0], lifeMs: 1000, flags: FLAG.HAS_GRAVITY });
    stepTs(w, 0.5);
    // v = -9.80665*0.5 = -4.903325 ; pos.y = v*dt = -2.4516625
    expect(w.vel[1]).toBeCloseTo(-4.903325, 4);
    expect(w.pos[1]).toBeCloseTo(-2.4516625, 4);
  });

  it('retires entities when life expires', () => {
    const w = new EcsWorld(2);
    w.spawn({ kind: ENTITY_KIND.PARTICLE, pos: [0, 0, 0], lifeMs: 50 });
    w.spawn({ kind: ENTITY_KIND.PARTICLE, pos: [0, 0, 0], lifeMs: 5000 });
    expect(w.liveCount).toBe(2);
    stepTs(w, 0.1); // 100ms — first dies
    expect(w.liveCount).toBe(1);
    expect(w.flags[0] & FLAG.ALIVE).toBe(0);
    expect(w.flags[1] & FLAG.ALIVE).toBeTruthy();
  });

  it('zeros accel after each step', () => {
    const w = new EcsWorld(1);
    w.spawn({ kind: ENTITY_KIND.PARTICLE, pos: [0, 0, 0], lifeMs: 1000 });
    w.accel[0] = 5; w.accel[1] = 5; w.accel[2] = 5;
    stepTs(w, 0.016);
    expect(w.accel[0]).toBe(0);
    expect(w.accel[1]).toBe(0);
    expect(w.accel[2]).toBe(0);
  });

  it('kernel reports stats and TS backend', () => {
    const w = new EcsWorld(100);
    for (let i = 0; i < 100; i++) {
      w.spawn({ kind: ENTITY_KIND.PARTICLE, pos: [0, 0, 0], lifeMs: 1000, flags: FLAG.HAS_GRAVITY });
    }
    const k = createTsKernel(w);
    expect(k.backend).toBe('ts');
    for (let s = 0; s < 5; s++) k.step(1 / 60);
    const stats = k.getStats();
    expect(stats.backend).toBe('ts');
    expect(stats.liveCount).toBe(100);
    expect(stats.lastStepMs).toBeGreaterThanOrEqual(0);
    expect(stats.emaStepMs).toBeGreaterThanOrEqual(0);
  });

  it('100k entities single step completes well under frame budget', () => {
    const N = 100_000;
    const w = new EcsWorld(N);
    for (let i = 0; i < N; i++) {
      w.spawn({
        kind: ENTITY_KIND.PARTICLE,
        pos: [0, 0, 0], vel: [1, 1, 1],
        lifeMs: 5000, flags: FLAG.HAS_GRAVITY,
      });
    }
    const t0 = performance.now();
    stepTs(w, 1 / 60);
    const dt = performance.now() - t0;
    // best-effort: 100k particles should comfortably fit a 50ms budget
    // even on slow CI runners. Soft assertion just guards regressions.
    expect(dt).toBeLessThan(150);
    expect(w.liveCount).toBe(N);
  });
});
