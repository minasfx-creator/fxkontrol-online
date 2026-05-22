/**
 * SwarmGPT Physics — Easing curves per motion style.
 *
 * Pure scalar functions on t ∈ [0..1] returning a normalized progress on
 * [0..1]. Caller is responsible for interpolating positions using the
 * returned progress (we keep this layer free of Vec3 math so it can be
 * swapped without touching trajectory code).
 */
import type { MotionStyle } from './types';

function clamp01(t: number): number {
  if (Number.isNaN(t)) return 0;
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

/** smoothstep — classic ease in/out, gentle. */
export function easeSmoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/** smootherstep — Ken Perlin's C² easing, very cinematic. */
export function easeSmootherstep(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Fast-out (low ease at start, hard end). */
export function easeFast(t: number): number {
  const x = clamp01(t);
  return 1 - (1 - x) * (1 - x);
}

/** Soft (gentle in/out, biased to slow start). */
export function easeSoft(t: number): number {
  const x = clamp01(t);
  return x * x;
}

/** Snap (constant for most of the duration, then jump). */
export function easeSnap(t: number): number {
  const x = clamp01(t);
  // Sharp transition near t=1 — accelerates only in the last 30%.
  return x < 0.7 ? 0 : (x - 0.7) / 0.3;
}

/** Organic (slight wobble — sin curve, smooth). */
export function easeOrganic(t: number): number {
  const x = clamp01(t);
  // Sigmoid-like with a subtle bias.
  return 0.5 - Math.cos(Math.PI * x) / 2;
}

export function pickEasing(style: MotionStyle): (t: number) => number {
  switch (style) {
    case 'cinematic': return easeSmootherstep;
    case 'fast':      return easeFast;
    case 'soft':      return easeSoft;
    case 'snap':      return easeSnap;
    case 'organic':   return easeOrganic;
    default:          return easeSmoothstep;
  }
}
