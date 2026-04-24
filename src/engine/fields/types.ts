/**
 * Fields engine — Core type definitions.
 *
 * A `Field` is a continuous spatial function: at any point `p` it tells you
 *   - how dense / "present" the swarm should be (density, normalized to [0,1])
 *   - which direction it should flow at time `t` (flow vector)
 *   - optionally, what color to render at that point
 *
 * Cenes are composed by summing/blending multiple Fields. Drone positions are
 * extracted by importance-sampling the combined density field.
 */
import type { Vec3 } from './vec3';

/** Axis-aligned bounding box in world space. */
export interface Bounds {
  min: Vec3;
  max: Vec3;
}

/** A continuous spatial field. Pure functions; no internal state. */
export interface Field {
  /** Returns density at point `p`. Should be in [0, 1] for predictable sampling. */
  density: (p: Vec3) => number;
  /** Returns flow vector at `p` and time `t` (seconds). */
  flow: (p: Vec3, t: number) => Vec3;
  /** Optional color in `#rrggbb` or any valid CSS color. */
  color?: (p: Vec3) => string;
}

/** Output of the field sampler — a sampled point with field metadata. */
export interface FieldSample {
  position: Vec3;
  density: number;
  color?: string;
}

/** Deterministic pseudo-random source. Returns numbers in [0, 1). */
export type RNG = () => number;
