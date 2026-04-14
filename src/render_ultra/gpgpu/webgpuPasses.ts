/**
 * WebGPU Render & Compute Pass Execution
 * Zero-alloc frame dispatch helpers.
 */

/**
 * Run a compute pass dispatching ceil(count/256) workgroups.
 */
export function runComputePass(
  encoder: GPUCommandEncoder,
  pipeline: GPUComputePipeline,
  bindGroup: GPUBindGroup,
  particleCount: number,
): void {
  const pass = encoder.beginComputePass({ label: 'particle-compute' });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(particleCount / 256));
  pass.end();
}

/**
 * Run fire render pass with additive blend.
 * First pass in frame → clears to black.
 * Draws 6 vertices (billboard quad) × instanceCount.
 */
export function runFireRenderPass(
  encoder: GPUCommandEncoder,
  view: GPUTextureView,
  pipeline: GPURenderPipeline,
  bindGroup: GPUBindGroup,
  vertexBuffer: GPUBuffer,
  instanceCount: number,
): void {
  const pass = encoder.beginRenderPass({
    label: 'fire-pass',
    colorAttachments: [{
      view,
      loadOp: 'clear' as GPULoadOp,
      storeOp: 'store' as GPUStoreOp,
      clearValue: { r: 0, g: 0, b: 0, a: 0 },
    }],
  });

  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.setVertexBuffer(0, vertexBuffer);
  pass.draw(6, instanceCount); // 6 verts per billboard quad
  pass.end();
}

/**
 * Run smoke render pass with alpha blend.
 * Loads existing framebuffer (no clear) — composites over fire.
 */
export function runSmokeRenderPass(
  encoder: GPUCommandEncoder,
  view: GPUTextureView,
  pipeline: GPURenderPipeline,
  bindGroup: GPUBindGroup,
  vertexBuffer: GPUBuffer,
  instanceCount: number,
): void {
  const pass = encoder.beginRenderPass({
    label: 'smoke-pass',
    colorAttachments: [{
      view,
      loadOp: 'load' as GPULoadOp,
      storeOp: 'store' as GPUStoreOp,
    }],
  });

  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.setVertexBuffer(0, vertexBuffer);
  pass.draw(6, instanceCount);
  pass.end();
}

/**
 * Run a single bitonic sort pass.
 */
export function runSortPass(
  encoder: GPUCommandEncoder,
  pipeline: GPUComputePipeline,
  bindGroup: GPUBindGroup,
  particleCount: number,
): void {
  const pass = encoder.beginComputePass({ label: 'sort-pass' });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(particleCount / 256));
  pass.end();
}
