/**
 * Volumetric Voxel System — barrel exports
 */
export { VoxelGrid } from './VoxelGrid';
export type { VoxelGridConfig } from './VoxelGrid';

export { injectSources } from './DensityInjection';
export type { InjectionSource } from './DensityInjection';

export { simulateVolume, DEFAULT_SIM_CONFIG } from './VolumeSimulation';
export type { SimulationConfig } from './VolumeSimulation';

export { RaymarchRenderer, DEFAULT_RAYMARCH_CONFIG } from './RaymarchRenderer';
export type { RaymarchConfig } from './RaymarchRenderer';

export { WebGPURaymarchPipeline } from './WebGPURaymarchPipeline';
export type { VolumeParamsGPU } from './WebGPURaymarchPipeline';

export { VolumetricCompositor } from './VolumetricCompositor';
export type { VolumeInstance, VolumePhase, CompositorConfig } from './VolumetricCompositor';

export { FXK_VOXEL_RAYMARCH_WGSL } from './shaders/fxk_voxel_raymarch.wgsl';
