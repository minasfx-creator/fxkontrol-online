/**
 * Field samplers — extract discrete drone positions from a continuous Field.
 *
 * Two strategies:
 * - `importanceSample`: rejection sampling weighted by density. Fast; may cluster.
 * - `poissonDiskSample`: blue-noise distribution with min-distance constraint.
 *   Slower but produces visually pleasing, evenly-spaced formations.
 *
 * Both are deterministic given the same seed.
 */
import type { Bounds, Field, FieldSample, RNG } from './types';
import { mulberry32, randomPointIn } from './rng';
import { distance2, type Vec3 } from './vec3';

export interface SampleOptions {
  /** Target number of points. */
  count: number;
  /** Sampling region. */
  bounds: Bounds;
  /** PRNG seed (deterministic output). Default: 1. */
  seed?: number;
  /** Max attempts before giving up (rejection samplers). Default: count * 50. */
  maxAttempts?: number;
  /** Density values are normalized so the maximum is treated as `1`. Default true. */
  autoNormalize?: boolean;
}

/**
 * importanceSample — Rejection sample `count` points where acceptance ∝ density.
 * Fast: O(count / averageDensity). Best for soft, smooth fields.
 */
export function importanceSample(field: Field, opts: SampleOptions): FieldSample[] {
  const { count, bounds } = opts;
  const seed = opts.seed ?? 1;
  const maxAttempts = opts.maxAttempts ?? count * 50;
  const rng: RNG = mulberry32(seed);

  // Estimate peak density for normalization (random probe).
  let peak = 1;
  if (opts.autoNormalize !== false) {
    peak = estimatePeak(field, bounds, rng);
  }
  const invPeak = 1 / Math.max(peak, 1e-9);

  const out: FieldSample[] = [];
  let attempts = 0;
  while (out.length < count && attempts < maxAttempts) {
    attempts++;
    const p = randomPointIn(rng, bounds);
    const d = field.density(p) * invPeak;
    if (d <= 0) continue;
    if (rng() < d) {
      out.push({
        position: p,
        density: d,
        color: field.color?.(p),
      });
    }
  }
  return out;
}

/**
 * poissonDiskSample — Blue-noise sample with a minimum distance between points,
 * weighted by density (regions with density 0 are excluded).
 *
 * Implementation: dart-throwing with spatial hash for O(1) neighbour queries.
 * Not guaranteed to reach `count` if the field is too sparse for the radius;
 * caller can lower `minDistance` and retry.
 */
export interface PoissonOptions extends SampleOptions {
  /** Minimum world-space distance between any two accepted points. */
  minDistance: number;
}

export function poissonDiskSample(field: Field, opts: PoissonOptions): FieldSample[] {
  const { count, bounds, minDistance } = opts;
  const seed = opts.seed ?? 1;
  const maxAttempts = opts.maxAttempts ?? count * 80;
  const rng: RNG = mulberry32(seed);

  const peak = opts.autoNormalize === false ? 1 : estimatePeak(field, bounds, rng);
  const invPeak = 1 / Math.max(peak, 1e-9);

  const cellSize = minDistance / Math.SQRT2;
  const grid = new SpatialHash(bounds, cellSize);
  const minDist2 = minDistance * minDistance;

  const accepted: FieldSample[] = [];
  let attempts = 0;
  while (accepted.length < count && attempts < maxAttempts) {
    attempts++;
    const p = randomPointIn(rng, bounds);
    const d = field.density(p) * invPeak;
    if (d <= 0) continue;
    if (rng() > d) continue; // density-weighted acceptance
    if (grid.hasNeighborWithin(p, minDist2)) continue;

    grid.insert(p);
    accepted.push({ position: p, density: d, color: field.color?.(p) });
  }
  return accepted;
}

// ─── helpers ──────────────────────────────────────────────────────────────

function estimatePeak(field: Field, bounds: Bounds, rng: RNG): number {
  let peak = 0;
  for (let i = 0; i < 256; i++) {
    const p = randomPointIn(rng, bounds);
    const d = field.density(p);
    if (d > peak) peak = d;
  }
  return peak;
}

/** Uniform-grid spatial hash for fast neighbour queries during dart-throwing. */
class SpatialHash {
  private readonly cells = new Map<string, Vec3[]>();
  private readonly cellSize: number;
  private readonly origin: Vec3;

  constructor(bounds: Bounds, cellSize: number) {
    this.cellSize = cellSize;
    this.origin = { ...bounds.min };
  }

  private key(ix: number, iy: number, iz: number): string {
    return `${ix},${iy},${iz}`;
  }

  private indexOf(p: Vec3): [number, number, number] {
    return [
      Math.floor((p.x - this.origin.x) / this.cellSize),
      Math.floor((p.y - this.origin.y) / this.cellSize),
      Math.floor((p.z - this.origin.z) / this.cellSize),
    ];
  }

  insert(p: Vec3): void {
    const [ix, iy, iz] = this.indexOf(p);
    const k = this.key(ix, iy, iz);
    const bucket = this.cells.get(k);
    if (bucket) bucket.push(p); else this.cells.set(k, [p]);
  }

  hasNeighborWithin(p: Vec3, minDist2: number): boolean {
    const [ix, iy, iz] = this.indexOf(p);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = this.cells.get(this.key(ix + dx, iy + dy, iz + dz));
          if (!bucket) continue;
          for (let i = 0; i < bucket.length; i++) {
            if (distance2(p, bucket[i]) < minDist2) return true;
          }
        }
      }
    }
    return false;
  }
}
