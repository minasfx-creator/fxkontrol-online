/**
 * SwarmGPT Fields — Volumetric field engine for SwarmGPT 2.0.
 *
 * Pipeline:  primitives → combine/blend/mirror → sampleField → DroneFormation
 *
 * Pure, deterministic (seeded), no DOM / no Three.js / no external deps.
 */
export * from "./types";
export * from "./vector";
export * from "./fields";
export * from "./composeFields";
export * from "./sampleField";
export * from "./symmetry";
export * from "./fieldToFormation";
