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
