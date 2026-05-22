/**
 * SwarmGPT Fields — Volumetric field engine for SwarmGPT 2.0.
 *
 * Pipeline:  primitives → combine/blend/mirror → sampleField → DroneFormation
 *
 * Pure, deterministic (seeded), no DOM / no Three.js / no external deps.
 */
export * from "./types";
// Vector helpers — `clamp01` collides with `../advanced`; import it directly
// from `./vector` if you need it outside this module.
export {
  ZERO_VEC3, add, sub, scale, dot, length, normalize, distance,
} from "./vector";
export * from "./fields";
export * from "./composeFields";
export * from "./sampleField";
export * from "./symmetry";
export * from "./fieldToFormation";
