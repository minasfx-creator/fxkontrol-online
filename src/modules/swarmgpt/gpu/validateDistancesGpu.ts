/**
 * validateDistancesGpu — Approximate parallel min-distance validation.
 * See `distanceValidate.wgsl.ts` for the algorithmic caveat (window-based
 * comparison, not exhaustive O(N²)).
 */
import {
  createReadbackBuffer,
  createStorageBuffer,
  createUniformBuffer,
  destroyBufferSafe,
  readBufferFloat32,
  writeFloat32Buffer,
} from "./gpuBuffers";
import { DISTANCE_VALIDATE_WGSL } from "./shaders/distanceValidate.wgsl";
import type { GpuDistanceValidationInput, GpuDistanceValidationResult } from "./types";

const DEFAULT_WINDOW = 32;
const MAX_POINTS = 200_000;

export async function validateDistancesGpu(
  device: GPUDevice,
  input: GpuDistanceValidationInput,
  options: { window?: number } = {},
): Promise<GpuDistanceValidationResult> {
  const count = Math.min(input.count, MAX_POINTS);
  if (count < 2) {
    return { ok: true, minDistanceObserved: Infinity, violationCount: 0 };
  }
  const windowK = Math.min(options.window ?? DEFAULT_WINDOW, count - 1);

  // ── Buffers ────────────────────────────────────────────────────────
  const paramsArr = new Uint32Array(4);
  const paramsView = new DataView(paramsArr.buffer);
  paramsView.setUint32(0, count, true);
  paramsView.setFloat32(4, input.minDistance, true);
  paramsView.setUint32(8, windowK, true);
  paramsView.setUint32(12, 0, true);

  const uniformBuf = createUniformBuffer(device, paramsArr.byteLength);
  device.queue.writeBuffer(uniformBuf, 0, paramsArr.buffer, 0, paramsArr.byteLength);

  const pointsBytes = count * 16;
  const pointsBuf = createStorageBuffer(device, pointsBytes);
  // Zero-fill if input is shorter than expected slot count.
  const pointsData = input.points.length >= count * 4
    ? input.points.subarray(0, count * 4)
    : input.points;
  writeFloat32Buffer(device, pointsBuf, pointsData as Float32Array);

  // Result: [violationCount, minDistanceFixed] as u32. Init [0, 0xFFFFFFFF].
  const resultInit = new Uint32Array([0, 0xffffffff]);
  const resultBuf = createStorageBuffer(device, resultInit.byteLength);
  device.queue.writeBuffer(resultBuf, 0, resultInit.buffer, 0, resultInit.byteLength);

  const readbackBuf = createReadbackBuffer(device, resultInit.byteLength);

  const module = device.createShaderModule({ code: DISTANCE_VALIDATE_WGSL });
  const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module, entryPoint: "main" },
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuf } },
      { binding: 1, resource: { buffer: pointsBuf } },
      { binding: 2, resource: { buffer: resultBuf } },
    ],
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(count / 64));
  pass.end();
  encoder.copyBufferToBuffer(resultBuf, 0, readbackBuf, 0, resultInit.byteLength);
  device.queue.submit([encoder.finish()]);

  try {
    const raw = await readBufferFloat32(readbackBuf);
    const u32 = new Uint32Array(raw.buffer);
    const violationCount = u32[0];
    const minFixed = u32[1];
    const minDistanceObserved = minFixed === 0xffffffff ? Infinity : minFixed / 1000;
    return {
      ok: violationCount === 0,
      minDistanceObserved,
      violationCount,
    };
  } finally {
    destroyBufferSafe(uniformBuf);
    destroyBufferSafe(pointsBuf);
    destroyBufferSafe(resultBuf);
    destroyBufferSafe(readbackBuf);
  }
}
