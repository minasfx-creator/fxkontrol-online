/**
 * SwarmGPT — Deterministic PRNG utilities (mulberry32).
 * Same seed → same sequence. Used by advanced sampling/shuffle to keep the
 * pipeline reproducible (no Math.random in advanced/).
 */

export function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic Fisher–Yates shuffle. Returns a new array, never mutates input. */
export function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const out = arr.slice();
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Derive a stable 32-bit seed from a point cloud — uses length and the first/last
 * points so identical inputs produce identical seeds, but different formations
 * still get well-separated seeds.
 */
export function seedFromPoints(points: { x: number; y: number; z: number }[]): number {
  if (!points || points.length === 0) return 0x9e3779b1;
  const f = points[0];
  const l = points[points.length - 1];
  // Mix length with quantized coords. Quantization avoids tiny float jitter
  // producing different seeds for visually identical inputs.
  const q = (v: number) => Math.round(v * 1000) | 0;
  let h = points.length | 0;
  h = Math.imul(h ^ q(f.x), 0x85ebca6b);
  h = Math.imul(h ^ q(f.y), 0xc2b2ae35);
  h = Math.imul(h ^ q(f.z), 0x27d4eb2f);
  h = Math.imul(h ^ q(l.x), 0x85ebca6b);
  h = Math.imul(h ^ q(l.y), 0xc2b2ae35);
  h = Math.imul(h ^ q(l.z), 0x27d4eb2f);
  return h >>> 0;
}
