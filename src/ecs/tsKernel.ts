/**
 * ─── ECS TS Kernel — deterministic step (best-effort) ──────────────
 * Pure-TS reference implementation of the unified physics step.
 * Bit-equivalent contract with the Rust/WASM kernel (same math order).
 *
 * Per-entity per-frame:
 *   1. accel += GRAVITY (if HAS_GRAVITY)
 *   2. vel   += accel * dt
 *   3. pos   += vel * dt
 *   4. ageMs += dt*1000 ; lifeMs -= dt*1000
 *   5. color.intensity decays linearly with life ratio
 *   6. accel zeroed for next frame
 *   7. if lifeMs ≤ 0 → retire
 *
 * Zero allocation in the hot loop.
 */

import { EcsWorld, FLAG } from './World';

const GRAVITY_Y = -9.80665; // m/s² (Three.js Y-up)

export function stepTs(world: EcsWorld, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const dtMs = dt * 1000;

  const cap = world.capacity;
  const flags = world.flags;
  const pos = world.pos;
  const vel = world.vel;
  const accel = world.accel;
  const color = world.color;
  const life = world.lifeMs;
  const age = world.ageMs;

  let live = 0;

  for (let i = 0; i < cap; i++) {
    const f = flags[i];
    if ((f & FLAG.ALIVE) === 0) continue;

    const p3 = i * 3;
    const c4 = i * 4;

    // 1. gravity
    let ax = accel[p3];
    let ay = accel[p3 + 1];
    let az = accel[p3 + 2];
    if (f & FLAG.HAS_GRAVITY) ay += GRAVITY_Y;

    // 2. integrate velocity
    vel[p3]     += ax * dt;
    vel[p3 + 1] += ay * dt;
    vel[p3 + 2] += az * dt;

    // 3. integrate position
    pos[p3]     += vel[p3]     * dt;
    pos[p3 + 1] += vel[p3 + 1] * dt;
    pos[p3 + 2] += vel[p3 + 2] * dt;

    // 4. life
    age[i]  += dtMs;
    life[i] -= dtMs;

    // 5. intensity decay (linear) — preserve at least 0
    const totalLife = age[i] + life[i];
    if (totalLife > 0) {
      const ratio = life[i] / totalLife;
      color[c4 + 3] = ratio > 0 ? ratio : 0;
    }

    // 6. zero accel for next frame
    accel[p3] = 0; accel[p3 + 1] = 0; accel[p3 + 2] = 0;

    // 7. retire if expired
    if (life[i] <= 0) {
      flags[i] = 0;
      world.kind[i] = 0;
      continue;
    }
    live++;
  }

  world._setLiveCount(live);
}
