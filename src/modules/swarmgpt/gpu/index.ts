/**
 * SwarmGPT GPU layer — public barrel.
 *
 * The `gpu/` module is OPTIONAL acceleration for sampling and validation.
 * It is NOT used for safety-critical drone command paths — preview/sim only.
 * CPU fallback is always available via `gpuFieldEngine.sampleFieldUltra`.
 */
export * from "./types";
export * from "./webgpuSupport";
export * from "./createGpuDevice";
export * from "./gpuBuffers";
export * from "./sampleFieldGpu";
export * from "./validateDistancesGpu";
export * from "./gpuFieldEngine";
export { FIELD_SAMPLE_WGSL } from "./shaders/fieldSample.wgsl";
export { DISTANCE_VALIDATE_WGSL } from "./shaders/distanceValidate.wgsl";
export * from "./diagnosticsStore";
