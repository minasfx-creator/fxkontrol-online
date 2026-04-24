/**
 * SwarmGPT Advanced — Quality Analysis color ramp.
 * Maps a normalized score [0..1] to an RGB triplet in [0..1].
 *
 * Mirrors the RealityScan 2.0 visual convention:
 *   0.0 → red    (poor coverage)
 *   0.5 → yellow (marginal)
 *   1.0 → green  (good coverage)
 *
 * Pure, deterministic, no allocations beyond the returned tuple.
 */

export type RGB01 = readonly [number, number, number];

export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * Green→Red ramp via two linear segments through yellow.
 * Inputs outside [0..1] are clamped.
 */
export function qualityToRgb(score: number): RGB01 {
  const s = clamp01(score);
  if (s < 0.5) {
    // red → yellow
    const t = s / 0.5;
    return [1, t, 0];
  }
  // yellow → green
  const t = (s - 0.5) / 0.5;
  return [1 - t, 1, 0];
}

/**
 * Pack an RGB01 triplet into a 0xRRGGBB integer (useful for THREE.Color.setHex).
 */
export function qualityToHex(score: number): number {
  const [r, g, b] = qualityToRgb(score);
  return (
    (Math.round(r * 255) << 16) |
    (Math.round(g * 255) << 8) |
    Math.round(b * 255)
  );
}
