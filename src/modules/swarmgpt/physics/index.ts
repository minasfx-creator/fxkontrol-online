/**
 * SwarmGPT Physics — Public surface.
 *
 * Strict module boundary: nothing here imports React, Three.js, or hardware.
 * The module is consumed by:
 *   - planFormationFromAsset (opt-in via flag)
 *   - tests
 *   - future timeline/trajectory exporters
 */
export * from './types';
export * from './adaptiveSampling';
export * from './matchPointsByCost';
export * from './easing';
export * from './compileTrajectory';
export * from './validators';
export * from './altitudeLanes';
export * from './physicsReport';
export * from './repairPhysicalTransition';
