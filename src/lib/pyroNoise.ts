export function hash01(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/**
 * Flicker temporal determinístico (sem Math.random por frame).
 * Mantém cintilação orgânica com picos ocasionais de brilho.
 */
export function temporalFlicker(
  seed: number,
  time: number,
  base = 0.62,
  amplitude = 0.38,
  popStrength = 0.32,
): number {
  const n = hash01(seed + 1.37);
  const w1 = 7 + n * 15;
  const w2 = 19 + n * 31;
  const w3 = 37 + n * 43;

  const slow = Math.sin(time * w1 + seed * 3.1);
  const mid = Math.sin(time * w2 + seed * 7.7);
  const fast = Math.sin(time * w3 + seed * 13.9);

  const pulse = Math.max(0, Math.sin(time * (3 + n * 6) + seed * 2.7));
  const pop = Math.pow(pulse, 18) * popStrength;

  const mixed = slow * 0.45 + mid * 0.35 + fast * 0.2;
  return Math.max(0.08, base + mixed * amplitude + pop);
}

export function attackReleaseEnvelope(
  progress: number,
  attack = 0.06,
  releaseStart = 0.85,
  releasePower = 2,
): number {
  const inRamp = Math.min(1, progress / Math.max(attack, 0.001));
  if (progress <= releaseStart) return inRamp;
  const out = Math.max(0, 1 - (progress - releaseStart) / Math.max(1 - releaseStart, 0.001));
  return inRamp * Math.pow(out, releasePower);
}

/**
 * Combustion flicker — aggressive high-frequency noise modeling
 * chemical combustion spikes (titanium/charcoal ignition irregularity).
 * Sharper peaks and faster oscillation than temporalFlicker.
 * Used for mine column heads, comet head glow, muzzle flashes.
 */
export function combustionFlicker(
  seed: number,
  time: number,
  intensity = 1.0,
): number {
  const n = hash01(seed + 2.91);

  // 5 overlapping high-frequency sine waves
  const w1 = 23 + n * 37;
  const w2 = 47 + n * 61;
  const w3 = 89 + n * 53;
  const w4 = 131 + n * 79;
  const w5 = 211 + n * 97;

  const s1 = Math.sin(time * w1 + seed * 5.3);
  const s2 = Math.sin(time * w2 + seed * 11.7);
  const s3 = Math.sin(time * w3 + seed * 17.1);
  const s4 = Math.sin(time * w4 + seed * 23.9);
  const s5 = Math.sin(time * w5 + seed * 31.3);

  // Weighted mix: higher frequencies contribute more for sharp peaks
  const mixed = s1 * 0.15 + s2 * 0.2 + s3 * 0.25 + s4 * 0.2 + s5 * 0.2;

  // Burst probability: sharp combustion spikes
  const burstPhase = Math.max(0, Math.sin(time * (7 + n * 11) + seed * 4.1));
  const spike = Math.pow(burstPhase, 12) * 0.6;

  // Base at 0.5, modulated by intensity
  const raw = 0.5 + mixed * 0.4 * intensity + spike * intensity;
  return Math.max(0.05, Math.min(1.5, raw));
}

/**
 * Shared thermal color ramp: white-hot → saturated → ember → charcoal.
 * Used across all pyro effects for consistent star cooling behavior.
 * @param baseR/G/B - base effect color (0-1)
 * @param lifeRatio - 0 = just born, 1 = dead
 * @param hdrBoost - multiplier for initial white-hot phase (default 1.5)
 * @returns {r, g, b} color values (may exceed 1.0 for HDR)
 */
/**
 * Chemical-compound-specific flicker parameters.
 * Models real combustion irregularity per pyrotechnic compound.
 */
export interface FlickerParams {
  base: number;
  amplitude: number;
  popStrength: number;
}

const FLICKER_BY_COMPOUND: Record<string, FlickerParams> = {
  // Strontium (red) — SrCO3 10-23%, KClO4, PVC 7%, Shellac 5%
  // Slow burn rate due to PVC/shellac binders; irregular combustion from SrCO3 decomposition
  strontium: { base: 0.50, amplitude: 0.42, popStrength: 0.48 },
  // Barium (green) — BaCO3-based, stable chlorate oxidizer
  barium: { base: 0.70, amplitude: 0.25, popStrength: 0.20 },
  // Copper (blue) — CuCO3/CuO → CuCl2 blue emission, requires Cl donor (PVC/Parlon)
  copper: { base: 0.60, amplitude: 0.35, popStrength: 0.38 },
  // Sodium (yellow/gold) — NaHCO3/Na₂C₂O₄, relatively stable
  sodium: { base: 0.68, amplitude: 0.28, popStrength: 0.22 },
  // Titanium (white/brocade) — Ti 25%, Rice Flour 2% (FFIC laudo)
  // Extremely irregular sparking from Ti particle combustion, high heat capacity
  titanium: { base: 0.45, amplitude: 0.50, popStrength: 0.55 },
  // Magnesium — fast burn, bright white, irregular. Combustion heat 6000 kcal/g
  magnesium: { base: 0.48, amplitude: 0.45, popStrength: 0.52 },
  // Charcoal (gold tails) — slow smoldering, organic carbon fuel
  charcoal: { base: 0.72, amplitude: 0.20, popStrength: 0.15 },
  // Lampblack — "extremely fine, finely dispersed orange sparks" (Pyrotechnic Chemicals)
  lampblack: { base: 0.65, amplitude: 0.28, popStrength: 0.20 },
  // Iron (gold sparks) — moderate, Fe particle combustion, linseed oil coating
  iron: { base: 0.62, amplitude: 0.32, popStrength: 0.30 },
  // KClO4 flash — KClO4 66-70% + Al 30-34% (stoichiometric, Chemistry of Pyrotechnics)
  // Burns in milliseconds, TNT equivalence ~75%. Combustion heat Al=7400 kcal/g
  flash: { base: 0.30, amplitude: 0.60, popStrength: 0.70 },
  // Aluminum — Al 30% in break charge, bright intense sparks. 7400 kcal/g
  aluminum: { base: 0.42, amplitude: 0.48, popStrength: 0.55 },
  // Phenolic resin binder — slows combustion, smooths flicker (6-8% in PIROEX reds)
  phenolic: { base: 0.75, amplitude: 0.18, popStrength: 0.12 },
  // Magnalium — 50/50 Al/Mg alloy, mp ~460°C, SG 2.0. Dragon eggs, strobe stars.
  // Extremely reactive, combines Mg fast ignition + Al high heat output
  magnalium: { base: 0.40, amplitude: 0.52, popStrength: 0.58 },
  // Zinc — bluish-green "electric" sparks, moderate burn (Chemistry of Pyrotechnics)
  zinc: { base: 0.55, amplitude: 0.38, popStrength: 0.35 },
  // Antimony trisulfide (Sb2S3) — bengal fire sensitizer, bright light with blue tinge
  antimony: { base: 0.58, amplitude: 0.40, popStrength: 0.42 },
  // Sulfur — low ignition temp (223°C), steady burn, used as fuel/sensitizer
  sulfur: { base: 0.65, amplitude: 0.30, popStrength: 0.25 },
  // Calcium — CaCO3, "rojo claro" distinct from strontium carmesí, irregular burn
  calcium: { base: 0.55, amplitude: 0.38, popStrength: 0.40 },
  // Black powder — KNO3 75% + C 15% + S 10%, moderate steady burn
  black_powder: { base: 0.60, amplitude: 0.35, popStrength: 0.30 },
  // Lead oxide (PbO) — dragon eggs, violent oscillatory combustion with magnalium
  lead: { base: 0.35, amplitude: 0.55, popStrength: 0.65 },
  // Bismuth (Bi2O3) — dragon egg substitute, similarly violent oscillation
  bismuth: { base: 0.38, amplitude: 0.52, popStrength: 0.60 },
  // Potassium perchlorate (KClO4) — strong oxidizer, moderate flicker
  potassium_perchlorate: { base: 0.50, amplitude: 0.42, popStrength: 0.50 },
};

/**
 * Get flicker parameters calibrated to a specific chemical compound.
 * Falls back to generic middle-ground params for unknown compounds.
 */
export function getFlickerParams(compound: string): FlickerParams {
  const key = compound.toLowerCase().replace(/[^a-z]/g, '');
  for (const [k, v] of Object.entries(FLICKER_BY_COMPOUND)) {
    if (key.includes(k)) return v;
  }
  // Default — generic moderate flicker
  return { base: 0.62, amplitude: 0.32, popStrength: 0.32 };
}

/**
 * Strobe oscillatory flicker — models real chemical strobe combustion.
 * Alternates between "smolder" phase (near-dark) and "intense burn" phase.
 * Based on Chemistry of Pyrotechnics: strobe stars use oscillatory combustion
 * where a dark/smolder layer alternates with a bright flash layer.
 * 
 * Recommended frequency ranges:
 * - Magnalium strobe: 8-12Hz → smolder=0.06-0.08, burn=0.03-0.05
 * - Dragon egg: 6-8Hz → smolder=0.08-0.10, burn=0.04-0.06
 * - Generic strobe: 3-6Hz → smolder=0.12-0.20, burn=0.05-0.10
 * 
 * @param seed - per-particle seed
 * @param time - elapsed time in seconds
 * @param smolderDuration - avg duration of dark phase
 * @param burnDuration - avg duration of bright phase
 * @returns brightness 0.02-1.4
 */
export function strobeFlicker(
  seed: number,
  time: number,
  smolderDuration = 0.5,
  burnDuration = 0.1,
): number {
  const n = hash01(seed + 4.73);
  // Per-particle variation in cycle timing
  const smolder = smolderDuration * (0.7 + n * 0.6);
  const burn = burnDuration * (0.6 + n * 0.8);
  const cycle = smolder + burn;

  // Phase offset per particle for desync
  const phase = hash01(seed + 9.31) * cycle;
  const tInCycle = ((time + phase) % cycle);

  if (tInCycle < smolder) {
    // Smolder phase — near dark with tiny fluctuations
    const microNoise = Math.sin(time * (80 + n * 40) + seed * 7.3) * 0.03;
    return 0.02 + Math.abs(microNoise);
  }
  // Burn phase — intense flash with rapid flutter
  const burnProgress = (tInCycle - smolder) / burn;
  const envelope = Math.sin(burnProgress * Math.PI); // smooth rise-fall within burn
  const flutter = 1 + Math.sin(time * (200 + n * 100)) * 0.15;
  return (0.9 + envelope * 0.5) * flutter;
}

export function thermalColorRamp(
  baseR: number,
  baseG: number,
  baseB: number,
  lifeRatio: number,
  hdrBoost = 1.5,
  isFlash = false,
): { r: number; g: number; b: number } {
  const t = Math.max(0, Math.min(1, lifeRatio));

  // Flash powder special path: burns in milliseconds, almost entirely white-hot
  // TNT equivalence ~75%, Al combustion 7400 kcal/g — extreme HDR
  if (isFlash) {
    const flashBoost = hdrBoost * 3.0;
    if (t < 0.80) {
      // 80% of life is white-hot burn (milliseconds in real life)
      const fadeIn = Math.min(1, t / 0.02);
      return {
        r: 2.0 * flashBoost * fadeIn,
        g: 1.8 * flashBoost * fadeIn,
        b: 1.5 * flashBoost * fadeIn,
      };
    }
    // Instant collapse to charcoal — no ember phase
    const p = (t - 0.80) / 0.20;
    return {
      r: 2.0 * flashBoost * (1 - p) + 0.05 * p,
      g: 1.8 * flashBoost * (1 - p) + 0.03 * p,
      b: 1.5 * flashBoost * (1 - p) + 0.01 * p,
    };
  }

  if (t < 0.04) {
    const p = t / 0.04;
    return {
      r: (1.4 + (1 - p) * 0.6) * hdrBoost,
      g: (1.2 + (1 - p) * 0.3) * hdrBoost,
      b: (0.85 + (1 - p) * 0.15) * hdrBoost,
    };
  }
  if (t < 0.15) {
    const p = (t - 0.04) / 0.11;
    return {
      r: 1.4 * hdrBoost * (1 - p) + baseR * 1.5 * p,
      g: 1.2 * hdrBoost * (1 - p) + baseG * 1.5 * p,
      b: 0.85 * hdrBoost * (1 - p) + baseB * 1.5 * p,
    };
  }
  if (t < 0.55) {
    const p = (t - 0.15) / 0.4;
    return {
      r: baseR * 1.5 * (1 - p) + baseR * 1.2 * p,
      g: baseG * 1.5 * (1 - p) + baseG * 1.2 * p,
      b: baseB * 1.5 * (1 - p) + baseB * 1.2 * p,
    };
  }
  if (t < 0.80) {
    const p = (t - 0.55) / 0.25;
    return {
      r: baseR * 1.2 * (1 - p) + (baseR * 0.5 + 0.25) * p,
      g: baseG * 1.2 * (1 - p) + (baseG * 0.15 + 0.05) * p,
      b: baseB * 1.2 * (1 - p) + (baseB * 0.05) * p,
    };
  }
  const p = (t - 0.80) / 0.20;
  return {
    r: (baseR * 0.5 + 0.25) * (1 - p) + 0.12 * p,
    g: (baseG * 0.15 + 0.05) * (1 - p) + 0.06 * p,
    b: (baseB * 0.05) * (1 - p) + 0.02 * p,
  };
}

/**
 * Combustion heat per gram (kcal/g) for common pyrotechnic metals.
 * Source: Chemistry of Pyrotechnics + Complete Book of Flash Powder.
 * Use as HDR boost multiplier: normalize to aluminum (max) → 0-1 scale.
 */
export const COMBUSTION_HEAT_KCAL: Record<string, number> = {
  aluminum: 7400,
  magnesium: 6000,
  magnalium: 6700, // weighted avg of Al+Mg
  titanium: 4700,
  iron: 1600,
  charcoal: 7800, // as carbon
  sulfur: 2200,
  zinc: 1300,
  antimony: 1800, // Sb2S3 decomposition
};

/**
 * Get HDR boost multiplier based on metal combustion heat.
 * Normalized: aluminum = 1.0, others proportionally lower.
 */
export function getCombustionHdrBoost(compound: string): number {
  const key = compound.toLowerCase().replace(/[^a-z]/g, '');
  for (const [k, heat] of Object.entries(COMBUSTION_HEAT_KCAL)) {
    if (key.includes(k)) return heat / 7400; // normalize to Al
  }
  return 0.7; // default moderate
}
