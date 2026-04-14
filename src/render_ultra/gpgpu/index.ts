/**
 * WebGPU Native Particle Pipeline — Public API
 */

// Device
export { initWebGPU, isWebGPUSupported } from './webgpuDevice';
export type { WebGPUContext } from './webgpuDevice';

// Buffers
export { createParticleBuffers, createSimUniformBuffer, createSortUniformBuffer, createSmokeUniformBuffer, ParticlePingPong, PARTICLE_STRIDE, SIM_UNIFORM_BYTES, SORT_UNIFORM_BYTES, SMOKE_UNIFORM_BYTES } from './webgpuBuffers';
export type { ParticleBufferPair } from './webgpuBuffers';

// Bind Groups
export { createComputeBindGroup, createSortBindGroup, createRenderBindGroup, createSmokeComputeBindGroup } from './webgpuBindGroups';

// Pipelines
export { createComputePipeline, createSortPipeline, createSmokeComputePipeline, createFireRenderPipeline, createSmokeRenderPipeline } from './webgpuPipelines';

// Passes
export { runComputePass, runFireRenderPass, runSmokeRenderPass, runSortPass, runSmokeComputePass } from './webgpuPasses';

// Light Scattering
export { createLightScatterPipeline, createLightScatterBindGroup, createLightScatterUniformBuffer, runLightScatterPass, LIGHT_SCATTER_UNIFORM_BYTES } from './webgpuLightScatter';

// WGSL Shaders
export { SMOKE_COMPUTE_WGSL, RENDER_WGSL, LIGHT_SCATTER_WGSL } from './wgsl';

// Loop
export { WebGPUParticleLoop } from './webgpuLoop';
export type { LoopConfig } from './webgpuLoop';

// Legacy WebGL fallback
export { ParticleGPGPU } from './ParticleGPGPU';
