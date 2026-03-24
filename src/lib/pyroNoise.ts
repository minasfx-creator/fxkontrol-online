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
export function thermalColorRamp(
  baseR: number,
  baseG: number,
  baseB: number,
  lifeRatio: number,
  hdrBoost = 1.5,
): { r: number; g: number; b: number } {
  // Clamp lifeRatio
  const t = Math.max(0, Math.min(1, lifeRatio));

  if (t < 0.04) {
    // White-hot birth phase
    const p = t / 0.04;
    return {
      r: (1.4 + (1 - p) * 0.6) * hdrBoost,
      g: (1.2 + (1 - p) * 0.3) * hdrBoost,
      b: (0.85 + (1 - p) * 0.15) * hdrBoost,
    };
  }
  if (t < 0.15) {
    // White-hot → saturated
    const p = (t - 0.04) / 0.11;
    return {
      r: 1.4 * hdrBoost * (1 - p) + baseR * 1.5 * p,
      g: 1.2 * hdrBoost * (1 - p) + baseG * 1.5 * p,
      b: 0.85 * hdrBoost * (1 - p) + baseB * 1.5 * p,
    };
  }
  if (t < 0.55) {
    // Saturated → base color
    const p = (t - 0.15) / 0.4;
    return {
      r: baseR * 1.5 * (1 - p) + baseR * 1.2 * p,
      g: baseG * 1.5 * (1 - p) + baseG * 1.2 * p,
      b: baseB * 1.5 * (1 - p) + baseB * 1.2 * p,
    };
  }
  if (t < 0.80) {
    // Base → ember (warm orange-red)
    const p = (t - 0.55) / 0.25;
    return {
      r: baseR * 1.2 * (1 - p) + (baseR * 0.5 + 0.25) * p,
      g: baseG * 1.2 * (1 - p) + (baseG * 0.15 + 0.05) * p,
      b: baseB * 1.2 * (1 - p) + (baseB * 0.05) * p,
    };
  }
  // Ember → charcoal
  const p = (t - 0.80) / 0.20;
  return {
    r: (baseR * 0.5 + 0.25) * (1 - p) + 0.12 * p,
    g: (baseG * 0.15 + 0.05) * (1 - p) + 0.06 * p,
    b: (baseB * 0.05) * (1 - p) + 0.02 * p,
  };
}
