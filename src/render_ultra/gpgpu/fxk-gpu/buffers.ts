/**
 * FXK GPU — Buffer allocation layer.
 * Wraps webgpuBuffers with a unified creation API.
 * Zero-GC: all buffers pre-allocated at init.
 */

import {
  createParticleBuffers,
  createSimUniformBuffer,
  createSortUniformBuffer,
  createSmokeUniformBuffer,
  ParticlePingPong,
  PARTICLE_STRIDE,
  SIM_UNIFORM_BYTES,
  SORT_UNIFORM_BYTES,
  SMOKE_UNIFORM_BYTES,
} from '../webgpuBuffers';
import {
  createLightScatterUniformBuffer,
  LIGHT_SCATTER_UNIFORM_BYTES,
} from '../webgpuLightScatter';

/** Camera uniform: mat4(64) + right(16) + up(16) = 96, rounded to 128 for alignment */
export const CAMERA_UNIFORM_BYTES = 128;

export interface FXKBufferSet {
  pingPong: ParticlePingPong;
  simUniform: GPUBuffer;
  sortUniform: GPUBuffer;
  smokeUniform: GPUBuffer;
  cameraUniform: GPUBuffer;
  lightScatterUniform: GPUBuffer;
}

/** Pre-allocated staging arrays (zero-GC in frame loop). */
export interface FXKStagingArrays {
  sim: Float32Array;
  sort: Uint32Array;
  smoke: Float32Array;
  camera: Float32Array;
  lightScatter: Float32Array;
}

/**
 * Create all GPU buffers needed by the FXK engine.
 */
export function createFXKBuffers(device: GPUDevice, maxParticles: number): FXKBufferSet {
  const pair = createParticleBuffers(device, maxParticles);
  return {
    pingPong: new ParticlePingPong(pair),
    simUniform: createSimUniformBuffer(device),
    sortUniform: createSortUniformBuffer(device),
    smokeUniform: createSmokeUniformBuffer(device),
    lightScatterUniform: createLightScatterUniformBuffer(device),
    cameraUniform: device.createBuffer({
      size: CAMERA_UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'fxk-camera-uniform',
    }),
  };
}

/**
 * Create pre-allocated staging arrays — written each frame, never re-allocated.
 */
export function createFXKStagingArrays(): FXKStagingArrays {
  return {
    sim: new Float32Array(SIM_UNIFORM_BYTES / 4),
    sort: new Uint32Array(SORT_UNIFORM_BYTES / 4),
    smoke: new Float32Array(SMOKE_UNIFORM_BYTES / 4),
    camera: new Float32Array(CAMERA_UNIFORM_BYTES / 4),
    lightScatter: new Float32Array(LIGHT_SCATTER_UNIFORM_BYTES / 4),
  };
}

/**
 * Dispose all GPU buffers.
 */
export function disposeFXKBuffers(buffers: FXKBufferSet): void {
  buffers.pingPong.dispose();
  buffers.simUniform.destroy();
  buffers.sortUniform.destroy();
  buffers.smokeUniform.destroy();
  buffers.cameraUniform.destroy();
  buffers.lightScatterUniform.destroy();
}

export { PARTICLE_STRIDE, SIM_UNIFORM_BYTES, SORT_UNIFORM_BYTES, SMOKE_UNIFORM_BYTES, LIGHT_SCATTER_UNIFORM_BYTES };
