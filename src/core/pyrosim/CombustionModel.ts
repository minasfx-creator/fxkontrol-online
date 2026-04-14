/**
 * ─── CombustionModel ────────────────────────────────────────────────
 * Per-particle fuel consumption and brightness computation.
 * 
 * - fuel_mass decreases by burn_rate * dt
 * - brightness follows exponential decay, not linear
 * - asymptotic fade to ember glow (no abrupt cutoff)
 * - integrates with pyroNoise for flicker
 */

import type { ParticlePool, DecayCurveType } from './ParticleStateModel';

/**
 * Update combustion state for all active particles.
 * Modifies pool in-place (zero allocation).
 */
export function updateCombustion(pool: ParticlePool, dt: number): void {
  for (let i = 0; i < pool.activeCount; i++) {
    if (pool.alive[i] === 0) continue;

    // Consume fuel
    const consumed = pool.burnRate[i] * dt;
    pool.fuelMass[i] = Math.max(0, pool.fuelMass[i] - consumed);

    // Age tracking
    pool.age[i] += dt;
    pool.lifetime[i] -= dt;

    // Fuel ratio
    const fuelRatio = pool.fuelInitial[i] > 0
      ? pool.fuelMass[i] / pool.fuelInitial[i]
      : 0;

    // Brightness from decay curve
    pool.brightness[i] = computeBrightness(fuelRatio, pool.decayCurve[i] as DecayCurveType);

    // Temperature tracks fuel (power law)
    // Base temperature stored at spawn; decays with fuel
    const baseTemp = pool.temperature[i];
    if (fuelRatio < 1.0) {
      // T = 800 + (T_initial - 800) * ratio^0.6
      pool.temperature[i] = 800 + (baseTemp - 800) * Math.pow(Math.max(0.001, fuelRatio), 0.6);
    }

    // Kill particle when fuel exhausted AND brightness negligible
    if (pool.lifetime[i] <= 0 || (fuelRatio <= 0 && pool.brightness[i] < 0.01)) {
      pool.alive[i] = 0;
    }
  }
}

/**
 * Compute brightness from fuel ratio using decay curve type.
 * 
 * Exponential (0): I = e^(-3 * (1 - ratio))  — fast initial drop, long tail
 * Linear (1):      I = ratio                   — uniform fade (fallback)
 * Hybrid (2):      Two-phase: slow start then accelerating decay
 */
function computeBrightness(fuelRatio: number, curve: DecayCurveType): number {
  switch (curve) {
    case 0: // exponential — primary curve
      return Math.exp(-3.0 * (1.0 - fuelRatio));
    case 1: // linear (fallback)
      return fuelRatio;
    case 2: // hybrid — plateau then drop
      if (fuelRatio > 0.7) return 1.0 - 0.15 * ((1.0 - fuelRatio) / 0.3);
      return 0.85 * Math.exp(-4.0 * (0.7 - fuelRatio));
    default:
      return fuelRatio;
  }
}

/**
 * Apply flicker modulation to brightness array.
 * Uses pre-computed flicker values to avoid per-particle trig.
 */
export function applyFlicker(
  pool: ParticlePool,
  time: number,
  flickerIntensity: number = 0.15,
): void {
  // Simple temporal flicker using cheap hash
  for (let i = 0; i < pool.activeCount; i++) {
    if (pool.alive[i] === 0) continue;
    // Cheap per-particle phase offset via index
    const phase = (i * 0.618033988749) % 1.0;
    const flicker = 1.0 - flickerIntensity * (0.5 + 0.5 * Math.sin(time * 12.0 + phase * 6.2831));
    pool.brightness[i] *= flicker;
  }
}

/**
 * Get burn rate multiplier by compound type.
 */
export const BURN_RATE_TABLE: Record<string, number> = {
  strontium: 0.35,    // red — moderate
  barium: 0.30,       // green — moderate
  copper: 0.25,       // blue — slow (hard to burn)
  sodium: 0.40,       // yellow — fast
  magnesium: 0.55,    // white — very fast, bright
  titanium: 0.15,     // sparks — slow, heavy
  iron: 0.12,         // gold sparks — very slow
  charcoal: 0.20,     // tail/brocade — slow glow
  aluminum: 0.50,     // flash — very fast
  default: 0.30,
};

export function getBurnRate(compound: string): number {
  return BURN_RATE_TABLE[compound] ?? BURN_RATE_TABLE.default;
}
