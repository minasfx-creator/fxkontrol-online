/**
 * ─── CalibrationLayer ───────────────────────────────────────────────
 * Per-family effect profiles with physically calibrated parameters.
 * 
 * Each family defines energy distribution, mass, drag, persistence,
 * trail behavior, smoke yield, and temporal shape.
 * 
 * Includes validation metrics for comparing profiles.
 */

import type { DecayCurveType } from './ParticleStateModel';

export interface EffectFamilyProfile {
  name: string;
  description: string;

  // Energy
  energyTotal: number;          // joules (normalized scale)
  releaseCurve: 'explosive' | 'gradual' | 'hybrid';
  releaseDuration: number;      // seconds

  // Particle physics
  starCount: number;            // base particle count
  particleMass: number;         // kg per star
  dragCoefficient: number;      // base Cd
  burstVelocity: number;        // m/s initial radial velocity
  gravityMultiplier: number;    // 1.0 = normal, 4.5 = willow droop
  decayCurve: DecayCurveType;

  // Trails
  trailLength: number;          // 0-1 relative
  trailDrag: number;            // additional drag on trail particles
  trailBrightness: number;      // 0-1

  // Smoke
  smokeYield: number;           // 0-1 (how much smoke per unit energy)
  smokeDensity: number;         // 0-1 initial density
  smokeTemperature: number;     // K at spawn

  // Thermal
  initialTemperature: number;   // K at ignition
  thermalDecayRate: number;     // K/s

  // Combustion
  fuelMass: number;             // kg total fuel per star
  burnRate: number;             // kg/s
  flickerIntensity: number;     // 0-1

  // Visual
  flashIntensity: number;       // HDR multiplier at burst moment
  emberPersistence: number;     // seconds of dim ember afterglow
  turbulenceFactor: number;     // 0-1 angular instability
}

export interface ValidationMetrics {
  riseTime: number;           // seconds (shell ascent)
  maxHeight: number;          // meters
  avgExpansionRate: number;   // m/s radial
  peakBrightness: number;    // relative
  brightnessAt50pct: number; // brightness when 50% life elapsed
  windDrift: number;          // meters at 5m/s wind
  smokeVolume: number;        // relative
}

/**
 * Calibrated effect family profiles.
 * Based on real pyrotechnic behavior patterns.
 */
export const EFFECT_FAMILIES: Record<string, EffectFamilyProfile> = {
  peony: {
    name: 'Peony',
    description: 'Classic spherical burst with many visible stars. Clean, defined bloom.',
    energyTotal: 1.0,
    releaseCurve: 'explosive',
    releaseDuration: 0.08,
    starCount: 250,
    particleMass: 0.003,
    dragCoefficient: 0.08,
    burstVelocity: 45,
    gravityMultiplier: 1.0,
    decayCurve: 0,
    trailLength: 0.3,
    trailDrag: 0.12,
    trailBrightness: 0.5,
    smokeYield: 0.4,
    smokeDensity: 0.5,
    smokeTemperature: 1800,
    initialTemperature: 3500,
    thermalDecayRate: 400,
    fuelMass: 0.002,
    burnRate: 0.0008,
    flickerIntensity: 0.12,
    flashIntensity: 2.5,
    emberPersistence: 0.4,
    turbulenceFactor: 0.1,
  },

  chrysanthemum: {
    name: 'Chrysanthemum',
    description: 'Long-trailing stars with tip-curl. Elegant, flowing motion.',
    energyTotal: 1.2,
    releaseCurve: 'explosive',
    releaseDuration: 0.06,
    starCount: 200,
    particleMass: 0.004,
    dragCoefficient: 0.06,
    burstVelocity: 50,
    gravityMultiplier: 1.2,
    decayCurve: 2, // hybrid — long plateau then accelerating fade
    trailLength: 0.9,
    trailDrag: 0.15, // progressive drag increase = tip-curl
    trailBrightness: 0.7,
    smokeYield: 0.5,
    smokeDensity: 0.6,
    smokeTemperature: 2000,
    initialTemperature: 3800,
    thermalDecayRate: 350,
    fuelMass: 0.003,
    burnRate: 0.0006,
    flickerIntensity: 0.10,
    flashIntensity: 2.0,
    emberPersistence: 0.8,
    turbulenceFactor: 0.08,
  },

  willow: {
    name: 'Willow',
    description: 'Extreme droop with long-lived charcoal trails. Weeping effect.',
    energyTotal: 0.9,
    releaseCurve: 'gradual',
    releaseDuration: 0.15,
    starCount: 180,
    particleMass: 0.005,
    dragCoefficient: 0.04,
    burstVelocity: 40,
    gravityMultiplier: 4.5, // extreme droop
    decayCurve: 0,
    trailLength: 1.0,
    trailDrag: 0.08, // heavy charcoal — low drag
    trailBrightness: 0.4,
    smokeYield: 0.6,
    smokeDensity: 0.7,
    smokeTemperature: 1600,
    initialTemperature: 2800,
    thermalDecayRate: 250,
    fuelMass: 0.004,
    burnRate: 0.0004,
    flickerIntensity: 0.08,
    flashIntensity: 1.5,
    emberPersistence: 1.5,
    turbulenceFactor: 0.05,
  },

  brocade: {
    name: 'Brocade',
    description: 'Slow gold shimmer with high smoke yield. Rich, warm appearance.',
    energyTotal: 0.8,
    releaseCurve: 'gradual',
    releaseDuration: 0.12,
    starCount: 220,
    particleMass: 0.006,
    dragCoefficient: 0.05,
    burstVelocity: 35,
    gravityMultiplier: 2.0,
    decayCurve: 2,
    trailLength: 0.7,
    trailDrag: 0.10,
    trailBrightness: 0.6,
    smokeYield: 0.8, // high smoke
    smokeDensity: 0.8,
    smokeTemperature: 1400,
    initialTemperature: 2500,
    thermalDecayRate: 200,
    fuelMass: 0.005,
    burnRate: 0.0005,
    flickerIntensity: 0.20, // shimmer
    flashIntensity: 1.2,
    emberPersistence: 1.2,
    turbulenceFactor: 0.12,
  },

  salute: {
    name: 'Salute',
    description: 'Massive flash-bang with near-zero stars. Shockwave and heavy smoke.',
    energyTotal: 2.5,
    releaseCurve: 'explosive',
    releaseDuration: 0.02, // near-instant
    starCount: 20, // minimal stars
    particleMass: 0.008,
    dragCoefficient: 0.03,
    burstVelocity: 80,
    gravityMultiplier: 1.0,
    decayCurve: 0,
    trailLength: 0.1,
    trailDrag: 0.06,
    trailBrightness: 0.3,
    smokeYield: 1.0, // maximum smoke
    smokeDensity: 0.9,
    smokeTemperature: 3000,
    initialTemperature: 6000, // extreme flash
    thermalDecayRate: 1500, // very fast cooldown
    fuelMass: 0.001,
    burnRate: 0.005, // burns instantly
    flickerIntensity: 0.02,
    flashIntensity: 5.0, // HDR flash
    emberPersistence: 0.1,
    turbulenceFactor: 0.3, // shockwave scatter
  },
};

/**
 * Compute validation metrics for a family profile.
 * Simulates one burst to extract measurable characteristics.
 */
export function computeValidationMetrics(
  profile: EffectFamilyProfile,
  caliberInches: number = 4,
): ValidationMetrics {
  const GRAVITY = 9.81;

  // Rise time (from pyroPhysics calibration)
  const riseTime = 0.8 + caliberInches * 0.35;

  // Max height
  const maxHeight = 50 + caliberInches * 40;

  // Average expansion rate
  const avgExpansionRate = profile.burstVelocity * 0.6; // accounting for drag

  // Peak brightness (flash intensity × energy)
  const peakBrightness = profile.flashIntensity * profile.energyTotal;

  // Brightness at 50% life
  const halfLife = profile.fuelMass / (profile.burnRate * 2);
  const fuelAt50 = 0.5;
  let brightnessAt50 = 0;
  switch (profile.decayCurve) {
    case 0: brightnessAt50 = Math.exp(-3.0 * 0.5); break;
    case 1: brightnessAt50 = 0.5; break;
    case 2: brightnessAt50 = 0.85 * Math.exp(-4.0 * 0.2); break;
  }

  // Wind drift at 5 m/s wind over star lifetime
  const starLife = profile.fuelMass / profile.burnRate;
  const windDrift = 5 * starLife * 0.6; // 60% wind influence on stars

  // Smoke volume (relative)
  const smokeVolume = profile.smokeYield * profile.energyTotal;

  return {
    riseTime,
    maxHeight,
    avgExpansionRate,
    peakBrightness,
    brightnessAt50pct: brightnessAt50,
    windDrift,
    smokeVolume,
  };
}

/**
 * Get a family profile by name (case-insensitive).
 */
export function getFamily(name: string): EffectFamilyProfile | undefined {
  return EFFECT_FAMILIES[name.toLowerCase()];
}

/**
 * List all available family names.
 */
export function listFamilies(): string[] {
  return Object.keys(EFFECT_FAMILIES);
}
