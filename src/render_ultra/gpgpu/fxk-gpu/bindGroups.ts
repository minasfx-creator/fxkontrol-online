/**
 * FXK GPU — Bind Group factory.
 * Creates all bind groups for compute and render passes.
 */

import { createComputeBindGroup, createSortBindGroup, createSmokeComputeBindGroup } from '../webgpuBindGroups';
import { createLightScatterBindGroup } from '../webgpuLightScatter';
import type { FXKPipelineSet } from './pipelines';
import type { FXKBufferSet } from './buffers';

export interface FXKBindGroupSet {
  computeA: GPUBindGroup;
  computeB: GPUBindGroup;
  sortA: GPUBindGroup | null;
  sortB: GPUBindGroup | null;
  smokeComputeA: GPUBindGroup | null;
  smokeComputeB: GPUBindGroup | null;
  fire: GPUBindGroup;
  smoke: GPUBindGroup;
  lightScatter: GPUBindGroup | null;
}

/**
 * Create all bind groups for the FXK engine.
 */
export function createAllBindGroups(
  device: GPUDevice,
  pipelines: FXKPipelineSet,
  buffers: FXKBufferSet,
): FXKBindGroupSet {
  const bufA = buffers.pingPong.current;
  const bufB = buffers.pingPong.next;

  // Compute
  const computeLayout = pipelines.compute.getBindGroupLayout(0);
  const computeA = createComputeBindGroup(device, computeLayout, buffers.simUniform, bufA);
  const computeB = createComputeBindGroup(device, computeLayout, buffers.simUniform, bufB);

  // Sort
  let sortA: GPUBindGroup | null = null;
  let sortB: GPUBindGroup | null = null;
  if (pipelines.sort) {
    const sortLayout = pipelines.sort.getBindGroupLayout(0);
    sortA = createSortBindGroup(device, sortLayout, bufA, buffers.sortUniform);
    sortB = createSortBindGroup(device, sortLayout, bufB, buffers.sortUniform);
  }

  // Smoke compute
  let smokeComputeA: GPUBindGroup | null = null;
  let smokeComputeB: GPUBindGroup | null = null;
  if (pipelines.smokeCompute) {
    const smokeLayout = pipelines.smokeCompute.getBindGroupLayout(0);
    smokeComputeA = createSmokeComputeBindGroup(device, smokeLayout, buffers.smokeUniform, bufA);
    smokeComputeB = createSmokeComputeBindGroup(device, smokeLayout, buffers.smokeUniform, bufB);
  }

  // Render bind groups (camera + particle storage)
  const fireLayout = pipelines.fire.getBindGroupLayout(0);
  const fire = device.createBindGroup({
    layout: fireLayout,
    label: 'fxk-fire-bind',
    entries: [
      { binding: 0, resource: { buffer: buffers.cameraUniform } },
      { binding: 1, resource: { buffer: bufA } },
    ],
  });

  const smokeLayout = pipelines.smoke.getBindGroupLayout(0);
  const smoke = device.createBindGroup({
    layout: smokeLayout,
    label: 'fxk-smoke-bind',
    entries: [
      { binding: 0, resource: { buffer: buffers.cameraUniform } },
      { binding: 1, resource: { buffer: bufA } },
    ],
  });

  // Light scatter
  let lightScatter: GPUBindGroup | null = null;
  if (pipelines.light) {
    const lsLayout = pipelines.light.getBindGroupLayout(0);
    lightScatter = createLightScatterBindGroup(device, lsLayout, buffers.lightScatterUniform);
  }

  return { computeA, computeB, sortA, sortB, smokeComputeA, smokeComputeB, fire, smoke, lightScatter };
}
