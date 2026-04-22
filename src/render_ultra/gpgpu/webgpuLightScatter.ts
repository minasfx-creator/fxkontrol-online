/**
 * WebGPU Light Scattering — Pipeline, Uniform, Pass
 * 
 * Fullscreen triangle pass with additive low-intensity blend.
 * Simulates radial fire light warming nearby smoke.
 */

/** LightScatterParams: 4 scalars + 4 × vec4 lights = 16 + 64 = 80 bytes → round to 96 for alignment */
export const LIGHT_SCATTER_UNIFORM_BYTES = 96;

/**
 * Create light scatter uniform buffer.
 */
export function createLightScatterUniformBuffer(device: GPUDevice): GPUBuffer {
  return device.createBuffer({
    size: LIGHT_SCATTER_UNIFORM_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    label: 'light-scatter-params',
  });
}

/**
 * Create light scatter render pipeline — fullscreen triangle, additive blend.
 */
export function createLightScatterPipeline(
  device: GPUDevice,
  format: GPUTextureFormat,
  wgslCode: string,
): GPURenderPipeline {
  const module = device.createShaderModule({ code: wgslCode, label: 'light-scatter' });
  return device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs_scatter',
      buffers: [], // fullscreen triangle — no vertex buffers
    },
    fragment: {
      module,
      entryPoint: 'fs_scatter',
      targets: [{
        format,
        blend: {
          // Low-intensity additive blend
          color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
          alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' },
        },
        writeMask: GPUColorWrite.ALL,
      }],
    },
    primitive: { topology: 'triangle-list' },
    depthStencil: undefined,
  });
}

/**
 * Create light scatter bind group: binding(0) = uniform.
 */
export function createLightScatterBindGroup(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  uniformBuffer: GPUBuffer,
): GPUBindGroup {
  return device.createBindGroup({
    layout,
    label: 'light-scatter-bind',
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
    ],
  });
}

/**
 * Run fullscreen light scatter pass (loads existing framebuffer).
 */
export function runLightScatterPass(
  encoder: GPUCommandEncoder,
  view: GPUTextureView,
  pipeline: GPURenderPipeline,
  bindGroup: GPUBindGroup,
): void {
  const pass = encoder.beginRenderPass({
    label: 'light-scatter-pass',
    colorAttachments: [{
      view,
      loadOp: 'load' as GPULoadOp,
      storeOp: 'store' as GPUStoreOp,
    }],
  });

  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.draw(3); // fullscreen triangle
  pass.end();
}
