/**
 * WebGPU Pipeline Factories
 * Compute (physics), Fire render (additive), Smoke render (alpha blend).
 */

import { PARTICLE_STRIDE } from './webgpuBuffers';

// ── Vertex buffer layout: 64 bytes per instance, 4 attributes ──
const PARTICLE_VERTEX_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: PARTICLE_STRIDE,
  stepMode: 'instance',
  attributes: [
    { shaderLocation: 0, offset: 0,  format: 'float32x4' as GPUVertexFormat },  // pos (xyz, age)
    { shaderLocation: 1, offset: 16, format: 'float32x4' as GPUVertexFormat },  // vel (xyz, life)
    { shaderLocation: 2, offset: 32, format: 'float32x4' as GPUVertexFormat },  // color (rgb, brightness)
    { shaderLocation: 3, offset: 48, format: 'float32x4' as GPUVertexFormat },  // misc (temp, size, smoke, type)
  ],
};

/**
 * Create compute pipeline from WGSL code with entry point `cs_update`.
 */
export function createComputePipeline(device: GPUDevice, wgslCode: string): GPUComputePipeline {
  const module = device.createShaderModule({ code: wgslCode, label: 'compute-update' });
  return device.createComputePipeline({
    layout: 'auto',
    compute: { module, entryPoint: 'cs_update' },
  });
}

/**
 * Create sort compute pipeline with entry point `cs_sort`.
 */
export function createSortPipeline(device: GPUDevice, wgslCode: string): GPUComputePipeline {
  const module = device.createShaderModule({ code: wgslCode, label: 'compute-sort' });
  return device.createComputePipeline({
    layout: 'auto',
    compute: { module, entryPoint: 'cs_sort' },
  });
}

/**
 * Fire render pipeline — additive blend (one/one) for emissive particles.
 * Billboard quads generated in vertex shader (6 verts per instance).
 */
export function createFireRenderPipeline(
  device: GPUDevice,
  format: GPUTextureFormat,
  wgslCode: string,
): GPURenderPipeline {
  const module = device.createShaderModule({ code: wgslCode, label: 'fire-render' });
  return device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs_fire',
      buffers: [PARTICLE_VERTEX_LAYOUT],
    },
    fragment: {
      module,
      entryPoint: 'fs_fire',
      targets: [{
        format,
        blend: {
          color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
        },
        writeMask: GPUColorWrite.ALL,
      }],
    },
    primitive: { topology: 'triangle-list' },
    depthStencil: undefined,
  });
}

/**
 * Smoke render pipeline — alpha blend (src-alpha / one-minus-src-alpha).
 */
export function createSmokeRenderPipeline(
  device: GPUDevice,
  format: GPUTextureFormat,
  wgslCode: string,
): GPURenderPipeline {
  const module = device.createShaderModule({ code: wgslCode, label: 'smoke-render' });
  return device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs_smoke',
      buffers: [PARTICLE_VERTEX_LAYOUT],
    },
    fragment: {
      module,
      entryPoint: 'fs_smoke',
      targets: [{
        format,
        blend: {
          color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
        },
        writeMask: GPUColorWrite.ALL,
      }],
    },
    primitive: { topology: 'triangle-list' },
    depthStencil: undefined,
  });
}
