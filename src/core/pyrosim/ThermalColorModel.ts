/**
 * ─── ThermalColorModel ──────────────────────────────────────────────
 * Simplified blackbody radiation: maps temperature (K) → RGB.
 * Uses Planckian locus approximation for continuous thermal color.
 * 
 * Temperature ranges:
 *   >6000K  → blue-white (magnesium flash)
 *   ~4500K  → white-hot
 *   ~3000K  → yellow
 *   ~2000K  → orange
 *   ~1200K  → red
 *   <800K   → dark ember / invisible
 */

// Pre-allocated output to avoid GC
const _out = { r: 0, g: 0, b: 0 };

/**
 * Convert temperature in Kelvin to RGB [0-1].
 * Based on Tanner Helland's approximation of the Planckian locus.
 */
export function blackbodyToRGB(tempK: number): { r: number; g: number; b: number } {
  const t = Math.max(800, Math.min(40000, tempK)) / 100;

  // Red
  if (t <= 66) {
    _out.r = 1.0;
  } else {
    const r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    _out.r = Math.max(0, Math.min(1, r / 255));
  }

  // Green
  if (t <= 66) {
    const g = 99.4708025861 * Math.log(t) - 161.1195681661;
    _out.g = Math.max(0, Math.min(1, g / 255));
  } else {
    const g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    _out.g = Math.max(0, Math.min(1, g / 255));
  }

  // Blue
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

/**
 * Calculate current temperature from fuel state.
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

/**
 * Blend thermal color with chemical emission color.
 * At high temperatures, thermal dominates. As it cools, chemical color shows.
 * Below ~1500K, chemical contribution fades entirely (just ember glow).
 */
export function blendThermalChemical(
  thermalR: number, thermalG: number, thermalB: number,
  chemR: number, chemG: number, chemB: number,
  temperature: number,
): { r: number; g: number; b: number } {
  // Chemical color contribution peaks between 2000-3500K
  const chemWeight = temperature > 5000
    ? 0.1  // very hot = mostly white thermal
    : temperature > 2000
      ? 0.6 * ((5000 - temperature) / 3000)  // fade chemical in
      : temperature > 1200
        ? 0.6 * ((temperature - 1200) / 800)  // fade chemical back out at low temp
        : 0.0;  // too cold, just ember glow

  const thermalWeight = 1.0 - chemWeight;
  _out.r = thermalR * thermalWeight + chemR * chemWeight;
  _out.g = thermalG * thermalWeight + chemG * chemWeight;
  _out.b = thermalB * thermalWeight + chemB * chemWeight;
  return _out;
}

/**
 * Get HDR brightness multiplier from temperature.
 * Very hot = super bright (HDR), cooling = dim.
 */
export function temperatureToBrightness(tempK: number): number {
  if (tempK < 800) return 0;
  if (tempK < 1200) return 0.05 * ((tempK - 800) / 400);
  if (tempK < 3000) return 0.05 + 0.45 * ((tempK - 1200) / 1800);
  if (tempK < 6000) return 0.5 + 0.5 * ((tempK - 3000) / 3000);
  return 1.0 + 0.5 * Math.min(1, (tempK - 6000) / 4000); // HDR >1.0
}
