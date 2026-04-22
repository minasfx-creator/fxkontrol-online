/**
 * ─── CombustionModel v2 — Studio Mode ───────────────────────────────
 * Per-particle fuel consumption, energy dissipation, and thermal state.
 *
 * When thermal_color_model flag is ON:
 *   - Temperature follows energy-driven model (ignition ramp → burn → ember)
 *   - HDR brightness from Stefan-Boltzmann (T^4)
 *   - Color computed from Planckian locus + chemical blend
 *   - Smoke output proportional to remaining fuel mass
 *
 * When OFF (legacy):
 *   - Temperature tracks fuel ratio with power law
 *   - Brightness from decay curve heuristic
 *
 * Zero-GC: operates directly on ParticlePool typed arrays.
 */

import type { ParticlePool, DecayCurveType } from './ParticleStateModel';
import { isEnabled } from '@/lib/featureFlags';
import {
  computeParticleThermalState,
  stefanBoltzmannEmission,
} from './ThermalColorModel';

// Pre-allocated thermal output (zero-GC)
const _thermalState = { r: 0, g: 0, b: 0, temperature: 0, emission: 0 };

/**
 * Update combustion state for all active particles.
 * Modifies pool in-place (zero allocation).
 */
export function updateCombustion(pool: ParticlePool, dt: number): void {
  const useThermalModel = isEnabled('thermal_color_model');

  for (let i = 0; i < pool.activeCount; i++) {
    if (pool.alive[i] === 0) continue;

    // ── Consume fuel ──
    const consumed = pool.burnRate[i] * dt;
    pool.fuelMass[i] = Math.max(0, pool.fuelMass[i] - consumed);

    // Age tracking
    pool.age[i] += dt;
    pool.lifetime[i] -= dt;

    // Fuel ratio
    const fuelRatio = pool.fuelInitial[i] > 0
      ? pool.fuelMass[i] / pool.fuelInitial[i]
      : 0;

    if (useThermalModel) {
      // ═══ Studio Mode: Energy-driven thermal model ═══

      // Burn duration estimate
      const burnDuration = pool.fuelInitial[i] > 0 && pool.burnRate[i] > 0
        ? pool.fuelInitial[i] / pool.burnRate[i]
        : 2.0;

      // Full thermal computation: temperature, color, emission
      computeParticleThermalState(
        pool.temperature[i] > 800 ? pool.temperature[i] : 3500, // use stored or default
        fuelRatio,
        pool.age[i],
        burnDuration,
        pool.colorR[i], pool.colorG[i], pool.colorB[i], // chemical color
        _thermalState,
      );

      // Write back temperature
      pool.temperature[i] = _thermalState.temperature;

      // HDR brightness from Stefan-Boltzmann, modulated by decay curve
      const decayMod = computeBrightness(fuelRatio, pool.decayCurve[i] as DecayCurveType);
      // Clamp emission to prevent extreme values overwhelming the renderer
      const emission = Math.min(_thermalState.emission, 12.0);
      pool.brightness[i] = emission * decayMod;

      // Write thermal+chemical blended color
      pool.colorR[i] = _thermalState.r;
      pool.colorG[i] = _thermalState.g;
      pool.colorB[i] = _thermalState.b;
    } else {
      // ═══ Legacy: fuel-ratio brightness ═══
      pool.brightness[i] = computeBrightness(fuelRatio, pool.decayCurve[i] as DecayCurveType);

      // Temperature tracks fuel (power law)
      const baseTemp = pool.temperature[i];
      if (fuelRatio < 1.0) {
        pool.temperature[i] = 800 + (baseTemp - 800) * Math.pow(Math.max(0.001, fuelRatio), 0.6);
      }
    }

    // ── Kill particle when fuel exhausted AND brightness negligible ──
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
  for (let i = 0; i < pool.activeCount; i++) {
    if (pool.alive[i] === 0) continue;
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
