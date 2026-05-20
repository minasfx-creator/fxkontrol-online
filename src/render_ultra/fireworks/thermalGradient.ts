/**
 * thermalGradient — blackbody-derived emissive color for fireworks.
 *
 * Approximates the Planckian Locus for T in [1500K, 9500K] using a smooth
 * piecewise sRGB ramp. Used by trails, sparks and ember tails to keep
 * the visual T-cooling pipeline consistent across renderers without
 * pulling the full shader-side LUT to the CPU.
 *
 * Pure helper, zero-GC: writes into the provided out array.
 */

export type RGBTuple = [number, number, number];

/** Stops at (T, r, g, b) — values in linear [0..1]. */
const STOPS: ReadonlyArray<readonly [number, number, number, number]> = [
  [1500, 1.00, 0.18, 0.02],
  [2200, 1.00, 0.36, 0.07],
  [2800, 1.00, 0.55, 0.18],
  [3400, 1.00, 0.72, 0.36],
  [4200, 1.00, 0.88, 0.62],
  [5500, 1.00, 0.98, 0.92],
  [6500, 0.96, 0.97, 1.00],
  [8000, 0.78, 0.86, 1.00],
  [9500, 0.62, 0.75, 1.00],
] as const;

function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x; }

/** Sample the thermal gradient at temperature T (Kelvin). */
export function thermalRGB(T: number, out: RGBTuple = [0, 0, 0]): RGBTuple {
  if (!Number.isFinite(T)) { out[0] = out[1] = out[2] = 0; return out; }
  if (T <= STOPS[0][0]) { out[0] = STOPS[0][1]; out[1] = STOPS[0][2]; out[2] = STOPS[0][3]; return out; }
  const last = STOPS[STOPS.length - 1];
  if (T >= last[0]) { out[0] = last[1]; out[1] = last[2]; out[2] = last[3]; return out; }
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i], b = STOPS[i + 1];
    if (T >= a[0] && T <= b[0]) {
      const t = (T - a[0]) / (b[0] - a[0]);
      out[0] = clamp01(a[1] + (b[1] - a[1]) * t);
      out[1] = clamp01(a[2] + (b[2] - a[2]) * t);
      out[2] = clamp01(a[3] + (b[3] - a[3]) * t);
      return out;
    }
  }
  out[0] = 1; out[1] = 1; out[2] = 1;
  return out;
}

/**
 * Newton-cooling temperature for an ember at lifeRatio ∈ [0..1].
 * T_start ≈ 5800K (white-hot), T_end ≈ 1800K (deep red).
 * cooling exponent 2.4 matches r_hdr_ember_tail decay curve.
 */
export function emberTemperature(lifeRatio: number, tStart = 5800, tEnd = 1800): number {
  const lr = clamp01(lifeRatio);
  const k = Math.pow(1 - lr, 2.4);
  return tEnd + (tStart - tEnd) * k;
}

/** Convenience: ember RGB directly from lifeRatio. */
export function emberRGB(lifeRatio: number, out?: RGBTuple): RGBTuple {
  return thermalRGB(emberTemperature(lifeRatio), out);
}
