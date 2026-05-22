/**
 * GPU buffer helpers — small wrappers around the raw WebGPU buffer API.
 *
 * Pattern for readback:
 *   1. createStorageBuffer(..., COPY_SRC) — shader writes to it.
 *   2. createReadbackBuffer(size) — staging buffer (MAP_READ | COPY_DST).
 *   3. encoder.copyBufferToBuffer(storage, 0, readback, 0, size).
 *   4. await readback.mapAsync(GPUMapMode.READ).
 *   5. new Float32Array(readback.getMappedRange()).slice() — copy out.
 *   6. readback.unmap(); destroyBufferSafe(readback); destroyBufferSafe(storage);
 */

export function createStorageBuffer(
  device: GPUDevice,
  byteLength: number,
  extraUsage: GPUBufferUsageFlags = 0,
): GPUBuffer {
  return device.createBuffer({
    size: alignTo(byteLength, 4),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | extraUsage,
  });
}

export function createReadbackBuffer(device: GPUDevice, byteLength: number): GPUBuffer {
  return device.createBuffer({
    size: alignTo(byteLength, 4),
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });
}

export function createUniformBuffer(
  device: GPUDevice,
  byteLength: number,
): GPUBuffer {
  return device.createBuffer({
    size: alignTo(byteLength, 16),
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}

export function writeFloat32Buffer(
  device: GPUDevice,
  buffer: GPUBuffer,
  data: Float32Array,
): void {
  device.queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength);
}

/**
 * Read a Float32Array from a readback buffer that has already been the target
 * of a copyBufferToBuffer. Returns a detached copy; the buffer is unmapped.
 */
export async function readBufferFloat32(buffer: GPUBuffer): Promise<Float32Array> {
  await buffer.mapAsync(GPUMapMode.READ);
  const range = buffer.getMappedRange();
  const out = new Float32Array(range.slice(0));
  buffer.unmap();
  return out;
}

/** Destroy a buffer; swallow errors so cleanup paths never throw. */
export function destroyBufferSafe(buffer: GPUBuffer | null | undefined): void {
  if (!buffer) return;
  try {
    buffer.destroy();
  } catch {
    // device may already be destroyed; ignore
  }
}

function alignTo(n: number, a: number): number {
  return Math.ceil(n / a) * a;
}
