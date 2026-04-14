/**
 * WebGPU Particle Buffers — Ping-pong storage + uniform buffers.
 * 64 bytes per particle (4 × vec4<f32>).
 */

/** Particle struct size in bytes: 4 × vec4<f32> = 64 */
export const PARTICLE_STRIDE = 64;
/** SimParams uniform: 16 floats = 64 bytes */
export const SIM_UNIFORM_BYTES = 64;
/** Sort uniform: 4 × u32 = 16 bytes */
export const SORT_UNIFORM_BYTES = 16;
/** Smoke uniform: 8 floats = 32 bytes */
export const SMOKE_UNIFORM_BYTES = 32;

export interface ParticleBufferPair {
  bufferA: GPUBuffer;
  bufferB: GPUBuffer;
  count: number;
  byteSize: number;
}

/**
 * Create ping-pong particle buffers (STORAGE | VERTEX | COPY_DST).
 */
export function createParticleBuffers(device: GPUDevice, count: number): ParticleBufferPair {
  const byteSize = count * PARTICLE_STRIDE;
  const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;

  const bufferA = device.createBuffer({ size: byteSize, usage, label: 'particles-A' });
  const bufferB = device.createBuffer({ size: byteSize, usage, label: 'particles-B' });

  return { bufferA, bufferB, count, byteSize };
}

/**
 * Create SimParams uniform buffer (64 bytes).
 */
export function createSimUniformBuffer(device: GPUDevice): GPUBuffer {
  return device.createBuffer({
    size: SIM_UNIFORM_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    label: 'sim-params',
  });
}

/**
 * Create Sort uniform buffer (16 bytes).
 */
export function createSortUniformBuffer(device: GPUDevice): GPUBuffer {
  return device.createBuffer({
    size: SORT_UNIFORM_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    label: 'sort-params',
  });
}

/**
 * Create Smoke uniform buffer (32 bytes).
 */
export function createSmokeUniformBuffer(device: GPUDevice): GPUBuffer {
  return device.createBuffer({
    size: SMOKE_UNIFORM_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    label: 'smoke-params',
  });
}

/**
 * Ping-pong manager — swaps current/next each frame.
 * Zero allocations on swap.
 */
export class ParticlePingPong {
  current: GPUBuffer;
  next: GPUBuffer;
  private _index = 0;

  constructor(private pair: ParticleBufferPair) {
    this.current = pair.bufferA;
    this.next = pair.bufferB;
  }

  swap(): void {
    this._index = 1 - this._index;
    this.current = this._index === 0 ? this.pair.bufferA : this.pair.bufferB;
    this.next = this._index === 0 ? this.pair.bufferB : this.pair.bufferA;
  }

  get count(): number { return this.pair.count; }
  get byteSize(): number { return this.pair.byteSize; }

  dispose(): void {
    this.pair.bufferA.destroy();
    this.pair.bufferB.destroy();
  }
}
