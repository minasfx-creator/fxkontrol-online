/**
 * SwarmGPT GPU layer — Shared types.
 *
 * The GPU layer is OPTIONAL. Every entry point must degrade gracefully to
 * the CPU sampler in `../fields/sampleField.ts` when WebGPU is unavailable.
 */

export type GpuVec3Buffer = {
  /** Packed xyz, padded to vec4 (stride = 4 floats = 16 bytes per point). */
  data: Float32Array;
  count: number;
};

export type GpuFieldType = "radial" | "wave" | "spiral" | "cone" | "cluster";

export type GpuBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

export type GpuFieldSampleInput = {
  bounds: GpuBounds;
  /** Total candidates to generate on the GPU (typically 100k–500k). */
  candidateCount: number;
  seed: number;
  fieldType: GpuFieldType;
  /** Up to 8 floats. Layout depends on fieldType (see fieldSample.wgsl.ts). */
  params: Float32Array;
};

export type GpuDistanceValidationInput = {
  /** Packed xyz padded to vec4 (stride = 16 bytes). */
  points: Float32Array;
  count: number;
  minDistance: number;
};

export type GpuDistanceValidationResult = {
  ok: boolean;
  minDistanceObserved: number;
  violationCount: number;
};

export type GpuFieldEngineDiagnostics = {
  candidateCount: number;
  durationMs: number;
  webgpuAvailable: boolean;
};

export type GpuFieldEngineResult<T> = {
  mode: "gpu" | "cpu";
  points: T[];
  diagnostics: GpuFieldEngineDiagnostics;
};
