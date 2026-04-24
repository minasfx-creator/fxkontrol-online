/**
 * Mulberry32 — small, fast, deterministic PRNG.
 * Used by samplers so identical seeds yield identical drone formations.
 */
import type { RNG } from './types';

export function mulberry32(seed: number): RNG {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns a uniform random point inside `bounds` using `rng`. */
export function randomPointIn(
  rng: RNG,
  bounds: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
) {
  return {
    x: bounds.min.x + (bounds.max.x - bounds.min.x) * rng(),
    y: bounds.min.y + (bounds.max.y - bounds.min.y) * rng(),
    z: bounds.min.z + (bounds.max.z - bounds.min.z) * rng(),
  };
}
