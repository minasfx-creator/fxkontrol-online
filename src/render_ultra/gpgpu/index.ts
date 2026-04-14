/**
 * WebGPU Native Particle Pipeline — Public API
 */

// Device
export { initWebGPU, isWebGPUSupported } from './webgpuDevice';
export type { WebGPUContext } from './webgpuDevice';

// Buffers
export { createParticleBuffers, createSimUniformBuffer, createSortUniformBuffer, ParticlePingPong, PARTICLE_STRIDE, SIM_UNIFORM_BYTES, SORT_UNIFORM_BYTES } from './webgpuBuffers';
export type { ParticleBufferPair } from './webgpuBuffers';

// Bind Groups
export { createComputeBindGroup, createSortBindGroup, createRenderBindGroup } from './webgpuBindGroups';

// Pipelines
export { createComputePipeline, createSortPipeline, createFireRenderPipeline, createSmokeRenderPipeline } from './webgpuPipelines';

// Passes
export { runComputePass, runFireRenderPass, runSmokeRenderPass, runSortPass } from './webgpuPasses';

// Loop
export { WebGPUParticleLoop } from './webgpuLoop';
export type { LoopConfig } from './webgpuLoop';

// Legacy WebGL fallback
export { ParticleGPGPU } from './ParticleGPGPU';
