/**
 * sampleFieldGpu — Run the field-sample compute shader and return raw
 * candidate points with density. Caller is expected to do the final
 * top-density / Poisson filter on CPU.
 *
 * Caller is responsible for calling `device.destroy()` if it owns the device.
 */
import {
  createReadbackBuffer,
  createStorageBuffer,
  createUniformBuffer,
  destroyBufferSafe,
  readBufferFloat32,
  writeFloat32Buffer,
} from "./gpuBuffers";
import { FIELD_SAMPLE_WGSL } from "./shaders/fieldSample.wgsl";
import type { GpuFieldSampleInput, GpuFieldType, GpuVec3Buffer } from "./types";

const FIELD_TYPE_INDEX: Record<GpuFieldType, number> = {
  radial: 0,
  wave: 1,
  spiral: 2,
  cone: 3,
  cluster: 4,
};

/** Hard ceiling — protects against out-of-memory crashes on weak GPUs. */
const MAX_CANDIDATES = 1_000_000;

export async function sampleFieldGpu(
  device: GPUDevice,
  input: GpuFieldSampleInput,
): Promise<GpuVec3Buffer> {
  const count = Math.min(Math.max(64, input.candidateCount), MAX_CANDIDATES);
  // Round up to multiple of workgroup size (64).
  const dispatchCount = Math.ceil(count / 64) * 64;
  const outputBytes = dispatchCount * 16; // vec4f stride

  // ── Uniform buffer (16 floats, 64 bytes — already 16-aligned). ──────
  const uniform = new Float32Array(16);
  uniform[0] = input.bounds.minX;
  uniform[1] = input.bounds.maxX;
  uniform[2] = input.bounds.minY;
  uniform[3] = input.bounds.maxY;
  uniform[4] = input.bounds.minZ;
  uniform[5] = input.bounds.maxZ;
  uniform[6] = input.seed;
  uniform[7] = FIELD_TYPE_INDEX[input.fieldType];
  for (let i = 0; i < 8; i++) uniform[8 + i] = input.params[i] ?? 0;

  const uniformBuf = createUniformBuffer(device, uniform.byteLength);
  const outputBuf = createStorageBuffer(device, outputBytes);
  const readbackBuf = createReadbackBuffer(device, outputBytes);

  writeFloat32Buffer(device, uniformBuf, uniform);

  const module = device.createShaderModule({ code: FIELD_SAMPLE_WGSL });
  const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module, entryPoint: "main" },
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuf } },
      { binding: 1, resource: { buffer: outputBuf } },
    ],
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(dispatchCount / 64);
  pass.end();
  encoder.copyBufferToBuffer(outputBuf, 0, readbackBuf, 0, outputBytes);
  device.queue.submit([encoder.finish()]);

  try {
    const data = await readBufferFloat32(readbackBuf);
    // Trim padding workgroup slots back to requested `count`.
    const trimmed = count === dispatchCount ? data : data.slice(0, count * 4);
    return { data: trimmed, count };
  } finally {
    destroyBufferSafe(uniformBuf);
    destroyBufferSafe(outputBuf);
    destroyBufferSafe(readbackBuf);
  }
}
