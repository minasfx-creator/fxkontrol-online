/**
 * FXK GPU — Pipeline factory.
 * Creates all compute + render pipelines from WGSL shader sources.
 */

import {
  createComputePipeline,
  createSortPipeline,
  createSmokeComputePipeline,
  createFireRenderPipeline,
  createSmokeRenderPipeline,
} from '../webgpuPipelines';
import { createLightScatterPipeline } from '../webgpuLightScatter';

export interface FXKShaders {
  compute: string;
  sort: string;
  render: string;
  smokeCompute: string;
  lightScatter: string;
}

export interface FXKPipelineSet {
  compute: GPUComputePipeline;
  sort: GPUComputePipeline | null;
  smokeCompute: GPUComputePipeline | null;
  fire: GPURenderPipeline;
  smoke: GPURenderPipeline;
  light: GPURenderPipeline | null;
}

export interface FXKPipelineConfig {
  enableSort: boolean;
  enableSmokeSim: boolean;
  enableLightScatter: boolean;
}

/**
 * Create the full set of GPU pipelines for FXK.
 */
export function createAllPipelines(
  device: GPUDevice,
  format: GPUTextureFormat,
  shaders: FXKShaders,
  config: FXKPipelineConfig,
): FXKPipelineSet {
  return {
    compute: createComputePipeline(device, shaders.compute),
    sort: config.enableSort ? createSortPipeline(device, shaders.sort) : null,
    smokeCompute: config.enableSmokeSim ? createSmokeComputePipeline(device, shaders.smokeCompute) : null,
    fire: createFireRenderPipeline(device, format, shaders.render),
    smoke: createSmokeRenderPipeline(device, format, shaders.render),
    light: config.enableLightScatter ? createLightScatterPipeline(device, format, shaders.lightScatter) : null,
  };
}
