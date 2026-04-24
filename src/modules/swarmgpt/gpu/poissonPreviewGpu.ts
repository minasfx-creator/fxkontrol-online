/**
 * poissonPreviewGpu — GPU-assisted Poisson-disk *preview* downsampling.
 *
 * Runs two compute passes against the candidate buffer produced by
 * `sampleFieldGpu`:
 *
 *   1. claim:  each candidate hashes into a voxel grid (cellSize = minDistance)
 *              and proposes itself via atomicMax (density+index packed).
 *   2. select: each candidate accepts itself iff it is its cell's winner AND
 *              no neighbor winner sits within minDistance.
 *
 * Returns the *indices* of accepted candidates (sorted by density desc) so
 * the caller can resolve them against the original Float32Array.
 *
 * IMPORTANT: This is a PREVIEW pass. The final safety filter MUST run on CPU
 * (`filterCandidatesByDensity` in gpuFieldEngine.ts). GPU produces
 * approximate Poisson — boundary cases between cells can let two points sit
 * <minDistance apart. The CPU final pass is the authority.
 */
import {
  createReadbackBuffer,
  createStorageBuffer,
  createUniformBuffer,
  destroyBufferSafe,
  readBufferFloat32,
  writeFloat32Buffer,
} from "./gpuBuffers";
import { POISSON_PREVIEW_WGSL } from "./shaders/poissonPreview.wgsl";
import type { GpuBounds, GpuVec3Buffer } from "./types";

/** Hard ceiling on grid cells — protects against OOM with huge bounds + tiny minDist. */
const MAX_GRID_CELLS = 4_000_000; // ~16 MB for atomic<u32> winner buffer

export type PoissonPreviewInput = {
  candidates: GpuVec3Buffer;
  bounds: GpuBounds;
  minDistance: number;
};

export type PoissonPreviewResult = {
  /** Indices into the original candidate buffer that survived GPU Poisson. */
  acceptedIndices: Uint32Array;
  /** Cell grid stats, for diagnostics overlay. */
  grid: { cellsX: number; cellsY: number; cellsZ: number; cellSize: number };
};

export async function poissonPreviewGpu(
  device: GPUDevice,
  input: PoissonPreviewInput,
): Promise<PoissonPreviewResult> {
  const { candidates, bounds, minDistance } = input;
  if (minDistance <= 0) {
    // Nothing to filter — return all indices as accepted.
    const all = new Uint32Array(candidates.count);
    for (let i = 0; i < candidates.count; i++) all[i] = i;
    return { acceptedIndices: all, grid: { cellsX: 0, cellsY: 0, cellsZ: 0, cellSize: 0 } };
  }

  // ── Choose cell size & dimensions, capped to avoid OOM ────────────
  let cellSize = minDistance;
  let cellsX = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cellSize));
  let cellsY = Math.max(1, Math.ceil((bounds.maxY - bounds.minY) / cellSize));
  let cellsZ = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / cellSize));
  let total = cellsX * cellsY * cellsZ;
  if (total > MAX_GRID_CELLS) {
    // Scale cellSize up uniformly so the grid fits.
    const scale = Math.cbrt(total / MAX_GRID_CELLS);
    cellSize *= scale;
    cellsX = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cellSize));
    cellsY = Math.max(1, Math.ceil((bounds.maxY - bounds.minY) / cellSize));
    cellsZ = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / cellSize));
    total = cellsX * cellsY * cellsZ;
  }

  // ── Buffers ───────────────────────────────────────────────────────
  // Uniform: 12 floats laid out per WGSL struct (padded to 48 bytes).
  const uni = new Float32Array(12);
  uni[0] = minDistance;
  uni[1] = cellSize;
  // u32 candidateCount written via reinterpret in slot 2:
  new Uint32Array(uni.buffer, uni.byteOffset, uni.length)[2] = candidates.count;
  new Uint32Array(uni.buffer, uni.byteOffset, uni.length)[3] = cellsX;
  new Uint32Array(uni.buffer, uni.byteOffset, uni.length)[4] = cellsY;
  new Uint32Array(uni.buffer, uni.byteOffset, uni.length)[5] = cellsZ;
  uni[6] = bounds.minX;
  uni[7] = bounds.minY;
  uni[8] = bounds.minZ;
  // uni[9..11] = padding (zeros)

  const uniBuf = createUniformBuffer(device, uni.byteLength);
  // Candidates: read-only storage of vec4f.
  const candBytes = candidates.data.byteLength;
  const candBuf = device.createBuffer({
    size: candBytes,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const winnerBuf = createStorageBuffer(device, total * 4); // atomic<u32>
  const acceptedBuf = createStorageBuffer(device, candidates.count * 4); // u32 per candidate
  const acceptedReadback = createReadbackBuffer(device, candidates.count * 4);

  try {
    writeFloat32Buffer(device, uniBuf, uni);
    device.queue.writeBuffer(candBuf, 0, candidates.data);

    // Zero-init winner buffer (sentinel "no winner" = densityQ=0).
    const zero = new Uint32Array(total);
    device.queue.writeBuffer(winnerBuf, 0, zero);

    const module = device.createShaderModule({ code: POISSON_PREVIEW_WGSL });
    const claimPipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module, entryPoint: "claim" },
    });
    const selectPipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module, entryPoint: "select" },
    });

    const bindings: GPUBindGroupEntry[] = [
      { binding: 0, resource: { buffer: uniBuf } },
      { binding: 1, resource: { buffer: candBuf } },
      { binding: 2, resource: { buffer: winnerBuf } },
      { binding: 3, resource: { buffer: acceptedBuf } },
    ];
    // Each pipeline gets its own auto-derived layout, so build two bind groups.
    const claimBg = device.createBindGroup({ layout: claimPipeline.getBindGroupLayout(0), entries: bindings });
    const selectBg = device.createBindGroup({ layout: selectPipeline.getBindGroupLayout(0), entries: bindings });

    const groups = Math.ceil(candidates.count / 64);
    const encoder = device.createCommandEncoder();
    {
      const pass = encoder.beginComputePass();
      pass.setPipeline(claimPipeline);
      pass.setBindGroup(0, claimBg);
      pass.dispatchWorkgroups(groups);
      pass.end();
    }
    {
      const pass = encoder.beginComputePass();
      pass.setPipeline(selectPipeline);
      pass.setBindGroup(0, selectBg);
      pass.dispatchWorkgroups(groups);
      pass.end();
    }
    encoder.copyBufferToBuffer(acceptedBuf, 0, acceptedReadback, 0, candidates.count * 4);
    device.queue.submit([encoder.finish()]);

    // Reuse Float32 readback helper, then reinterpret as Uint32.
    const acceptedF32 = await readBufferFloat32(acceptedReadback);
    const acceptedU32 = new Uint32Array(acceptedF32.buffer, acceptedF32.byteOffset, acceptedF32.length);

    // Collect accepted indices.
    let n = 0;
    for (let i = 0; i < candidates.count; i++) if (acceptedU32[i] === 1) n++;
    const out = new Uint32Array(n);
    let w = 0;
    for (let i = 0; i < candidates.count; i++) if (acceptedU32[i] === 1) out[w++] = i;

    return { acceptedIndices: out, grid: { cellsX, cellsY, cellsZ, cellSize } };
  } finally {
    destroyBufferSafe(uniBuf);
    destroyBufferSafe(candBuf);
    destroyBufferSafe(winnerBuf);
    destroyBufferSafe(acceptedBuf);
    destroyBufferSafe(acceptedReadback);
  }
}
