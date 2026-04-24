/**
 * SwarmGPT 2.0 — Public surface.
 * Module is isolated from runtime/timeline. UI/edge function wiring lives outside.
 */
export * from './types';
export * from './config';
export * from './schemas';
export * from './pipeline/generateSwarmGPTShow';
export * from './compiler/compilePlanToTimeline';
export * from './validation/validateChoreographyPlan';
export * from './validation/validateTiming';
export * from './validation/validateGeometry';
export * from './adapters/applyToTimeline';
export { extractJsonObject } from './utils/safeJson';
export { makeId } from './utils/ids';
export { distance3, clampPoint, isInsideBounds } from './utils/geometry';
export * from './advanced';
