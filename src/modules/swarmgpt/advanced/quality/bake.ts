/**
 * SwarmGPT Advanced — Quality "bake" helpers.
 *
 * Two outputs, both pure:
 *   1. bakeVertexColors  → Float32Array (RGB per vertex), THREE-compatible.
 *   2. bakeQualityTexture → Uint8ClampedArray (RGBA grid) suitable for
 *      `new ImageData(...)` in the browser. We avoid touching DOM here so
 *      the module stays test-friendly under Vitest.
 *
 * Mirrors RealityScan 2.0 CLI: `calculateQualityColors` / `calculateQualityTexture`.
 */
import { qualityToRgb } from './qualityColorRamp';

export function bakeVertexColors(vertexScores: Float32Array): Float32Array {
  const out = new Float32Array(vertexScores.length * 3);
  for (let i = 0; i < vertexScores.length; i++) {
    const [r, g, b] = qualityToRgb(vertexScores[i]);
    out[i * 3] = r;
    out[i * 3 + 1] = g;
    out[i * 3 + 2] = b;
  }
  return out;
}

export interface QualityTextureResult {
  width: number;
  height: number;
  /** RGBA byte grid, length = width * height * 4. */
  pixels: Uint8ClampedArray;
}

/**
 * Lay per-triangle scores out as a square texture (row-major), padding the
 * tail with zero-alpha pixels. Width is chosen as the next power of two ≥
 * sqrt(triCount); useful for 1:1 lookup by triangle index.
 */
export function bakeQualityTexture(triangleScores: Float32Array): QualityTextureResult {
  const n = triangleScores.length;
  if (n === 0) {
    return { width: 1, height: 1, pixels: new Uint8ClampedArray(4) };
  }
  let side = 1;
  while (side * side < n) side <<= 1;
  const pixels = new Uint8ClampedArray(side * side * 4);
  for (let i = 0; i < n; i++) {
    const [r, g, b] = qualityToRgb(triangleScores[i]);
    const o = i * 4;
    pixels[o] = Math.round(r * 255);
    pixels[o + 1] = Math.round(g * 255);
    pixels[o + 2] = Math.round(b * 255);
    pixels[o + 3] = 255;
  }
  return { width: side, height: side, pixels };
}

/**
 * Histogram bins for the panel UI. Always returns `binCount` entries,
 * each in [0..1] of the max bin height (so the UI doesn't need to renormalize).
 */
export function qualityHistogram(scores: Float32Array, binCount = 12): number[] {
  const bins = new Array<number>(binCount).fill(0);
  if (scores.length === 0) return bins;
  for (let i = 0; i < scores.length; i++) {
    const s = Math.max(0, Math.min(0.9999, scores[i]));
    const b = Math.min(binCount - 1, Math.floor(s * binCount));
    bins[b]++;
  }
  const peak = bins.reduce((m, v) => (v > m ? v : m), 0) || 1;
  return bins.map((v) => v / peak);
}
