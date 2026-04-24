/**
 * src/engine/fields — Volumetric Field Engine.
 *
 * Pipeline:    Field primitives  →  combine / blend / mirror
 *           →  sampler (importance | Poisson disk)
 *           →  attractors (post-shaping)
 *           →  formation point list
 *
 * Used by SwarmGPT (optional pipeline). All functions are pure and deterministic
 * given a seed.
 */

export type { Vec3 } from './vec3';
export {
  vec3, ZERO,
  add, sub, scale, dot, cross,
  length, length2, distance, distance2,
  normalize, lerp, clamp,
} from './vec3';

export type { Field, FieldSample, Bounds, RNG } from './types';

export { mulberry32, randomPointIn } from './rng';

export {
  coneBeamField,
  gaussianClusterField,
  sphereShellField,
  halfSpaceField,
  vortexField,
} from './primitives';

export {
  combineFields,
  blendFields,
  mirrorField,
  scaleField,
} from './composition';

export {
  attractToCenter,
  attractToLine,
  repelFromCenter,
} from './attractors';

export {
  importanceSample,
  poissonDiskSample,
  type SampleOptions,
  type PoissonOptions,
} from './sampler';

export {
  applySymmetry,
  applyRotationalSymmetry,
} from './symmetry';
