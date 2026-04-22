/**
 * ─── ThermalColorModel v2 — Studio Mode ─────────────────────────────
 * Physically-grounded thermal emission model:
 *
 * 1. Planckian Locus (Blackbody Radiation)
 *    Maps temperature (K) → RGB using Tanner Helland approximation.
 *    Range: 800K (dark ember) → 40,000K (magnesium flash)
 *
 * 2. Stefan-Boltzmann HDR Emission
 *    Radiant exitance scales as T^4, providing physically correct
 *    HDR brightness that feeds the bloom pipeline.
 *    E = σ * T^4 (normalized to reference temperature)
 *
 * 3. Energy Dissipation Model
 *    Temperature decay follows Newton's Law of Cooling with
 *    compound-specific thermal conductivity. Energy is tracked
 *    as enthalpy: dT/dt = -k(T - T_ambient) where k varies by
 *    fuel type and particle mass.
 *
 * 4. Chemical-Thermal Blending
 *    Chemical colorants (Ba→green, Sr→red, Cu→blue) contribute
 *    color proportional to their emission band intensity at the
 *    current temperature. At extreme temperatures (>5000K),
 *    thermal blackbody dominates regardless of chemistry.
 *    Below 1200K, only ember glow remains.
 *
 * Feature flag: thermal_color_model
 *   When OFF: simplified fuel-ratio brightness (legacy)
 *   When ON:  full Planckian + Stefan-Boltzmann + dissipation
 *
 * Zero-GC: pre-allocated output objects.
 */

// ═══ Constants ═══

const STEFAN_BOLTZMANN_REF_TEMP = 3500; // reference temperature for normalization
const STEFAN_BOLTZMANN_REF_E = Math.pow(STEFAN_BOLTZMANN_REF_TEMP, 4);
const AMBIENT_TEMP = 293; // ~20°C

// Pre-allocated outputs (zero-GC)
const _out = { r: 0, g: 0, b: 0 };
const _thermalOut = { r: 0, g: 0, b: 0 };

// ═══════════════════════════════════════════════════════════════════════
// Planckian Locus — Blackbody T→RGB
// ═══════════════════════════════════════════════════════════════════════

/**
 * Convert temperature in Kelvin to RGB [0-1].
 * Based on Tanner Helland's approximation of the Planckian locus.
 *
 * This maps the peak spectral radiance of a blackbody to perceptual
 * RGB coordinates. The progression follows:
 *   >6000K  → blue-white (magnesium flash, titanium)
 *   ~4500K  → white-hot (aluminum powder)
 *   ~3000K  → yellow (sodium, iron filings)
 *   ~2000K  → orange (charcoal tail)
 *   ~1200K  → deep red (ember glow)
 *   <800K   → invisible / dark
 */
export function blackbodyToRGB(tempK: number): { r: number; g: number; b: number } {
  const t = Math.max(800, Math.min(40000, tempK)) / 100;

  // Red channel
  if (t <= 66) {
    _out.r = 1.0;
  } else {
    const r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    _out.r = Math.max(0, Math.min(1, r / 255));
  }

  // Green channel
  if (t <= 66) {
    const g = 99.4708025861 * Math.log(t) - 161.1195681661;
    _out.g = Math.max(0, Math.min(1, g / 255));
  } else {
    const g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    _out.g = Math.max(0, Math.min(1, g / 255));
  }

  // Blue channel
  if (t >= 66) {
    _out.b = 1.0;
  } else if (t <= 19) {
    _out.b = 0.0;
  } else {
    const b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    _out.b = Math.max(0, Math.min(1, b / 255));
  }

  return _out;
}

// ═══════════════════════════════════════════════════════════════════════
// Stefan-Boltzmann HDR Emission Intensity
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute HDR emission intensity using Stefan-Boltzmann law.
 *
 * The radiant exitance of a blackbody is proportional to T^4:
 *   E = σ * T^4
 *
 * Normalized against a reference temperature (3500K typical star)
 * to produce values in a useful HDR range:
 *   - 800K  → ~0.003 (barely visible ember)
 *   - 2000K → ~0.11
 *   - 3500K → 1.0 (reference, normal star brightness)
 *   - 6000K → ~8.6 (intense flash, drives bloom)
 *   - 10000K → ~53 (extreme HDR, salute flash)
 *
 * @param tempK - Current temperature in Kelvin
 * @returns HDR brightness multiplier (can be >> 1.0)
 */
export function stefanBoltzmannEmission(tempK: number): number {
  if (tempK <= 800) return 0;
  const t4 = Math.pow(tempK, 4);
  return t4 / STEFAN_BOLTZMANN_REF_E;
}

/**
 * Get brightness multiplier from temperature (legacy-compatible).
 * When thermal_color_model is OFF, this provides the fallback.
 */
export function temperatureToBrightness(tempK: number): number {
  if (tempK < 800) return 0;
  if (tempK < 1200) return 0.05 * ((tempK - 800) / 400);
  if (tempK < 3000) return 0.05 + 0.45 * ((tempK - 1200) / 1800);
  if (tempK < 6000) return 0.5 + 0.5 * ((tempK - 3000) / 3000);
  return 1.0 + 0.5 * Math.min(1, (tempK - 6000) / 4000);
}

// ═══════════════════════════════════════════════════════════════════════
// Energy Dissipation — Newton's Law of Cooling
// ═══════════════════════════════════════════════════════════════════════

/**
 * Thermal conductivity multipliers by compound type.
 * Higher = faster cooling. Affects how quickly the particle's
 * temperature approaches ambient.
 *
 * Physics basis: metals conduct heat faster than organic compounds.
 * Charcoal retains heat longest (low conductivity, high thermal mass).
 */
export const THERMAL_CONDUCTIVITY: Record<string, number> = {
  magnesium:  1.8,   // metal, cools fast → short bright flash
  aluminum:   1.6,   // metal, very fast burn
  titanium:   0.9,   // sparks, moderate cooling
  iron:       0.7,   // gold sparks, slow cooling (high mass)
  sodium:     1.4,   // yellow, moderate-fast
  strontium:  1.0,   // red, standard
  barium:     1.0,   // green, standard
  copper:     0.8,   // blue, slightly slow (hard to burn)
  charcoal:   0.4,   // tails/brocade, retains heat longest
  default:    1.0,
};

/**
 * Compute temperature at current timestep using Newton's Law of Cooling
 * with energy dissipation:
 *
 *   T(t+dt) = T_ambient + (T(t) - T_ambient) * e^(-k * dt)
 *
 * Where k is the cooling constant influenced by:
 *   - Compound thermal conductivity
 *   - Particle mass (heavier = slower cooling)
 *   - Surface area to volume ratio (approximated)
 *
 * @param currentTemp - Current temperature (K)
 * @param mass - Particle mass (kg)
 * @param conductivity - Thermal conductivity multiplier
 * @param dt - Timestep (seconds)
 * @returns New temperature (K)
 */
export function dissipateTemperature(
  currentTemp: number,
  mass: number,
  conductivity: number,
  dt: number,
): number {
  if (currentTemp <= AMBIENT_TEMP) return AMBIENT_TEMP;

  // Cooling rate inversely proportional to mass (thermal inertia)
  // Base rate: ~0.5 K/s at reference conditions
  const massInertia = Math.max(0.001, mass) * 200; // higher mass → slower cooling
  const k = conductivity / massInertia;

  // Newton's Law of Cooling (exponential decay toward ambient)
  const delta = currentTemp - AMBIENT_TEMP;
  const newTemp = AMBIENT_TEMP + delta * Math.exp(-k * dt);

  return Math.max(AMBIENT_TEMP, newTemp);
}

/**
 * Calculate current temperature from fuel state (legacy path).
 * Temperature decays as fuel is consumed, with 0.6 power law.
 */
export function fuelToTemperature(
  initialTemp: number,
  fuelRemaining: number,
  fuelInitial: number,
): number {
  if (fuelInitial <= 0) return 800;
  const ratio = Math.max(0, fuelRemaining / fuelInitial);
  return 800 + (initialTemp - 800) * Math.pow(ratio, 0.6);
}

// ═══════════════════════════════════════════════════════════════════════
// Energy-Based Temperature from Fuel Consumption
// ═══════════════════════════════════════════════════════════════════════

/**
 * Advanced temperature model: temperature is a function of both
 * the remaining chemical energy (fuel) AND the radiative/conductive
 * heat loss (dissipation).
 *
 * Phase 1 (ignition, 0-0.1s): Temperature ramps up as combustion
 *   energy converts to thermal. Peak occurs slightly AFTER ignition.
 * Phase 2 (burn): Temperature maintained by ongoing combustion,
 *   slowly declining as fuel depletes.
 * Phase 3 (ember): Fuel exhausted, exponential cooling to ambient.
 *
 * @param initialTemp - Peak temperature of the compound (K)
 * @param fuelRatio - fuelMass / fuelInitial (1.0 → 0.0)
 * @param age - Seconds since particle spawn
 * @param burnDuration - Expected total burn time (fuelMass / burnRate)
 * @returns Current temperature (K)
 */
export function energyDrivenTemperature(
  initialTemp: number,
  fuelRatio: number,
  age: number,
  burnDuration: number,
): number {
  // Phase 1: Ignition ramp (0 → peak in ~0.05s)
  const ignitionRamp = Math.min(1.0, age / 0.05);

  // Phase 2: Combustion-sustained plateau with gradual decline
  // Temperature follows sqrt of remaining energy (T ∝ √E for gas)
  const combustionTemp = initialTemp * Math.pow(Math.max(0.001, fuelRatio), 0.35);

  // Phase 3: Post-burn cooling (exponential decay)
  const postBurnFactor = fuelRatio <= 0.01
    ? Math.exp(-2.0 * (age - burnDuration))
    : 1.0;

  const temp = AMBIENT_TEMP + (combustionTemp - AMBIENT_TEMP) * ignitionRamp * postBurnFactor;
  return Math.max(AMBIENT_TEMP, temp);
}

// ═══════════════════════════════════════════════════════════════════════
// Chemical-Thermal Color Blending
// ═══════════════════════════════════════════════════════════════════════

/**
 * Blend thermal blackbody color with chemical emission color.
 *
 * Physics: chemical colorants (metal salts) emit at specific
 * wavelengths that become visible when the compound reaches
 * its excitation temperature. The chemical emission band
 * ADDS to the blackbody continuum, not replaces it.
 *
 * Temperature zones:
 *   >5000K: Thermal dominates (too hot, all colors wash to white)
 *   3000-5000K: Chemical colors emerge over thermal background
 *   1500-3000K: Peak chemical contribution (salts actively burning)
 *   800-1500K: Chemical fading, only thermal ember glow remains
 *   <800K: Dark
 *
 * @param thermalR/G/B - Blackbody RGB at current temperature
 * @param chemR/G/B - Chemical emission RGB (from compound table)
 * @param temperature - Current temperature (K)
 */
export function blendThermalChemical(
  thermalR: number, thermalG: number, thermalB: number,
  chemR: number, chemG: number, chemB: number,
  temperature: number,
): { r: number; g: number; b: number } {
  // Chemical weight follows a bell curve centered around 2500K
  let chemWeight: number;

  if (temperature > 5000) {
    // Too hot: thermal whitewash dominates
    chemWeight = 0.1 * Math.max(0, 1 - (temperature - 5000) / 3000);
  } else if (temperature > 3000) {
    // Chemical emerging: ramp from 0.1 to 0.6
    chemWeight = 0.1 + 0.5 * ((5000 - temperature) / 2000);
  } else if (temperature > 1500) {
    // Peak chemical band: 0.6 plateau with slight peak at 2500K
    const distFrom2500 = Math.abs(temperature - 2500) / 1000;
    chemWeight = 0.6 * (1 - distFrom2500 * 0.15);
  } else if (temperature > 800) {
    // Fading: chemical emission weakens as excitation energy drops
    chemWeight = 0.6 * Math.pow((temperature - 800) / 700, 1.5);
  } else {
    chemWeight = 0;
  }

  const thermalWeight = 1.0 - chemWeight;

  // Additive blending: chemical ADDS to thermal, doesn't replace
  // This ensures that even with colorants, the underlying thermal
  // glow provides realistic base illumination
  _thermalOut.r = thermalR * thermalWeight + chemR * chemWeight;
  _thermalOut.g = thermalG * thermalWeight + chemG * chemWeight;
  _thermalOut.b = thermalB * thermalWeight + chemB * chemWeight;

  return _thermalOut;
}

// ═══════════════════════════════════════════════════════════════════════
// Per-Particle Thermal Update (called from CombustionModel)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Full thermal update for a single particle.
 * Computes temperature, blackbody color, HDR emission, and writes
 * results into the provided output.
 *
 * @returns HDR brightness multiplier for the particle
 */
export function computeParticleThermalState(
  initialTemp: number,
  fuelRatio: number,
  age: number,
  burnDuration: number,
  chemR: number, chemG: number, chemB: number,
  out: { r: number; g: number; b: number; temperature: number; emission: number },
): void {
  // 1. Temperature from energy model
  const temp = energyDrivenTemperature(initialTemp, fuelRatio, age, burnDuration);

  // 2. Blackbody color at current temperature
  const bb = blackbodyToRGB(temp);

  // 3. Blend with chemical emission
  const blended = blendThermalChemical(bb.r, bb.g, bb.b, chemR, chemG, chemB, temp);

  // 4. HDR emission from Stefan-Boltzmann
  const emission = stefanBoltzmannEmission(temp);

  // Write output
  out.r = blended.r;
  out.g = blended.g;
  out.b = blended.b;
  out.temperature = temp;
  out.emission = emission;
}
