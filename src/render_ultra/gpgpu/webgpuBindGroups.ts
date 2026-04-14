/**
 * WebGPU Bind Group Factories
 * Creates bind groups for compute (sim + particles) and sort (particles + sort params).
 */

/**
 * Create compute bind group: binding(0) = uniform, binding(1) = particle storage.
 */
export function createComputeBindGroup(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  uniformBuffer: GPUBuffer,
  particleBuffer: GPUBuffer,
): GPUBindGroup {
  return device.createBindGroup({
    layout,
    label: 'compute-bind',
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: particleBuffer } },
    ],
  });
}

/**
 * Create sort bind group: binding(0) = particle storage (read_write), binding(1) = sort uniform.
 */
export function createSortBindGroup(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  particleBuffer: GPUBuffer,
  sortUniformBuffer: GPUBuffer,
): GPUBindGroup {
  return device.createBindGroup({
    layout,
    label: 'sort-bind',
    entries: [
      { binding: 0, resource: { buffer: particleBuffer } },
      { binding: 1, resource: { buffer: sortUniformBuffer } },
    ],
  });
}

/**
 * Create render bind group: binding(0) = camera/projection uniform.
 */
export function createRenderBindGroup(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  uniformBuffer: GPUBuffer,
): GPUBindGroup {
  return device.createBindGroup({
    layout,
    label: 'render-bind',
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
    ],
  });
}

/**
 * Create smoke compute bind group: binding(0) = smoke uniform, binding(1) = particle storage.
 */
export function createSmokeComputeBindGroup(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  uniformBuffer: GPUBuffer,
  particleBuffer: GPUBuffer,
): GPUBindGroup {
  return device.createBindGroup({
    layout,
    label: 'smoke-compute-bind',
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: particleBuffer } },
    ],
  });
}
