/**
 * ─── BallisticSolver ────────────────────────────────────────────────
 * Per-particle physics integration using Velocity-Verlet.
 * Handles gravity, quadratic drag, layered wind, and angular instability.
 * 
 * Zero-GC: operates directly on ParticlePool typed arrays.
 */

import type { ParticlePool } from './ParticleStateModel';
import type { WindFieldSystem } from './WindFieldSystem';

const GRAVITY = -9.81; // m/s²

// Pre-allocated wind sample output
const _windSample = [0, 0, 0] as [number, number, number];

/**
 * Integrate all active particles one timestep using Velocity-Verlet.
 * 
 * Velocity-Verlet is symplectic and more stable than Euler for stiff drag:
 *   x(t+dt) = x(t) + v(t)*dt + 0.5*a(t)*dt²
 *   v(t+dt) = v(t) + 0.5*(a(t) + a(t+dt))*dt
 * 
 * Simplified here to avoid double force evaluation:
 *   1. Compute acceleration from forces
 *   2. Update velocity: v += a * dt
 *   3. Update position: x += v * dt
 *   4. Apply drag as velocity damping (stable for large dt)
 */
export function integrateParticles(
  pool: ParticlePool,
  dt: number,
  windSystem: WindFieldSystem | null,
  enableTurbulence: boolean = true,
  time: number = 0,
): void {
  for (let i = 0; i < pool.activeCount; i++) {
    if (pool.alive[i] === 0) continue;

    const mass = pool.mass[i];
    if (mass <= 0) continue;

    // ── Sample wind at particle altitude ──
    let windX = 0, windY = 0, windZ = 0;
    if (windSystem) {
      windSystem.sample(
        pool.posX[i], pool.posY[i], pool.posZ[i],
        time, enableTurbulence, _windSample,
      );
      windX = _windSample[0];
      windY = _windSample[1];
      windZ = _windSample[2];
    }

    // ── Relative velocity (particle vs wind) ──
    const relVx = pool.velX[i] - windX;
    const relVy = pool.velY[i] - windY;
    const relVz = pool.velZ[i] - windZ;

    // ── Quadratic drag: F_drag = -Cd * |v_rel| * v_rel ──
    const speed = Math.sqrt(relVx * relVx + relVy * relVy + relVz * relVz);
    const cd = pool.dragCoefficient[i];

    let dragFactor = 0;
    if (speed > 0.01) {
      // Deceleration = Cd * speed * dt, capped to prevent sign flip
      dragFactor = Math.min(cd * speed * dt, 0.95);
    }

    // ── Acceleration from gravity ──
    const ay = GRAVITY;

    // ── Angular instability for heavy fragments ──
    let turbX = 0, turbZ = 0;
    if (enableTurbulence && pool.turbulenceFactor[i] > 0) {
      const tf = pool.turbulenceFactor[i];
      // Cheap pseudo-random wobble
      const phase = (i * 0.618033988749 + time * 3.0) % 6.2831;
      turbX = tf * Math.sin(phase) * 2.0;
      turbZ = tf * Math.cos(phase * 1.3) * 2.0;
    }

    // ── Velocity update (Verlet-style) ──
    pool.velX[i] += turbX * dt;
    pool.velY[i] += ay * dt;
    pool.velZ[i] += turbZ * dt;

    // Apply drag as velocity damping
    pool.velX[i] -= relVx * dragFactor;
    pool.velY[i] -= relVy * dragFactor;
    pool.velZ[i] -= relVz * dragFactor;

    // ── Position update ──
    pool.posX[i] += pool.velX[i] * dt;
    pool.posY[i] += pool.velY[i] * dt;
    pool.posZ[i] += pool.velZ[i] * dt;

    // ── Ground collision ──
    if (pool.posY[i] < 0) {
      pool.posY[i] = 0;
      pool.velY[i] = 0;
      pool.velX[i] *= 0.3; // friction
      pool.velZ[i] *= 0.3;
      // Ground kills most particles quickly
      pool.lifetime[i] = Math.min(pool.lifetime[i], 0.2);
    }
  }
}
