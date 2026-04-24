/**
 * gpuFieldEngine — High-level entry point.
 *
 * Tries WebGPU first (massive candidate generation + density evaluation),
 * then does the final top-density / minDistance filter on CPU. If WebGPU is
 * unavailable OR fails for any reason, falls back transparently to the
 * deterministic CPU sampler in `../fields/sampleField.ts`.
 *
 * NEVER use this for safety-critical drone command paths — sampling and
 * preview only.
 */
import type { Vec3 } from "../types";
import { sampleField } from "../fields/sampleField";
import {
  createConeBeamField,
  createClusterField,
  createRadialField,
  createSpiralField,
  createWaveField,
} from "../fields/fields";
import type { VectorField } from "../fields/types";
import { distance } from "../fields/vector";
import { createGpuDevice } from "./createGpuDevice";
import { sampleFieldGpu } from "./sampleFieldGpu";
import { isWebGPUSupported } from "./webgpuSupport";
import { recordSampleRun } from "./diagnosticsStore";
import type {
  GpuBounds,
  GpuFieldEngineResult,
  GpuFieldType,
} from "./types";

export type SampleFieldUltraOptions = {
  fieldType: GpuFieldType;
  bounds: GpuBounds;
  /** Candidates to generate on GPU. Will be clamped to engine ceiling. */
  candidateCount: number;
  /** Final point count after filtering. */
  droneCount: number;
  /** Optional minimum distance between accepted points (CPU filter). */
  minDistance?: number;
  seed: number;
  /** Field-specific params; see fieldSample.wgsl.ts for layout per type. */
  params: {
    center?: Vec3;
    radius?: number;
    amplitude?: number;
    frequency?: number;
    width?: number;
    height?: number;
    turns?: number;
    direction?: Vec3;
    cosHalfAngle?: number;
    length?: number;
    /** Multi-center cluster — forces CPU fallback (GPU shader handles 1 center only). */
    clusterCenters?: Vec3[];
  };
};

export async function sampleFieldUltra(
  options: SampleFieldUltraOptions,
): Promise<GpuFieldEngineResult<Vec3>> {
  const t0 = nowMs();
  const webgpuAvailable = isWebGPUSupported();
  const multiCluster = options.params.clusterCenters && options.params.clusterCenters.length > 1;
  let fallbackReason: string | undefined;
  if (!webgpuAvailable) fallbackReason = "WebGPU not supported in this environment";
  else if (multiCluster) fallbackReason = "Multi-center cluster — GPU shader handles 1 center only";

  // ── Try GPU path ───────────────────────────────────────────────────
  if (webgpuAvailable && !multiCluster) {
    try {
      const device = await createGpuDevice();
      try {
        const params = packParams(options);
        const candidates = await sampleFieldGpu(device, {
          bounds: options.bounds,
          candidateCount: options.candidateCount,
          seed: options.seed,
          fieldType: options.fieldType,
          params,
        });
        const points = filterCandidatesByDensity(
          candidates.data,
          candidates.count,
          options.droneCount,
          options.minDistance ?? 0,
        );
        const result: GpuFieldEngineResult<Vec3> = {
          mode: "gpu",
          points,
          diagnostics: {
            candidateCount: candidates.count,
            durationMs: nowMs() - t0,
            webgpuAvailable: true,
          },
        };
        recordSampleRun({
          mode: "gpu",
          fieldType: options.fieldType,
          droneCount: options.droneCount,
          diagnostics: result.diagnostics,
        });
        return result;
      } finally {
        device.destroy();
      }
    } catch (err) {
      fallbackReason = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn("[swarmgpt/gpu] GPU path failed, falling back to CPU:", err);
    }
  }

  // ── CPU fallback ────────────────────────────────────────────────────
  const field = buildCpuField(options);
  const cpuPoints = sampleField(field, {
    bounds: {
      minX: options.bounds.minX,
      maxX: options.bounds.maxX,
      minY: options.bounds.minY,
      maxY: options.bounds.maxY,
      minZ: options.bounds.minZ,
      maxZ: options.bounds.maxZ,
    },
    count: options.droneCount,
    seed: options.seed,
    minDistance: options.minDistance,
    minDensity: 0.03,
  });

  const result: GpuFieldEngineResult<Vec3> = {
    mode: "cpu",
    points: cpuPoints,
    diagnostics: {
      candidateCount: options.droneCount,
      durationMs: nowMs() - t0,
      webgpuAvailable,
    },
  };
  recordSampleRun({
    mode: "cpu",
    fieldType: options.fieldType,
    droneCount: options.droneCount,
    diagnostics: result.diagnostics,
    fallbackReason,
  });
  return result;
}

// ─── helpers ─────────────────────────────────────────────────────────

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function packParams(options: SampleFieldUltraOptions): Float32Array {
  const p = new Float32Array(8);
  const center = options.params.center ?? { x: 0, y: 0, z: 0 };
  switch (options.fieldType) {
    case "radial":
    case "cluster":
      p[0] = center.x; p[1] = center.y; p[2] = center.z;
      p[3] = options.params.radius ?? 1;
      break;
    case "wave":
      p[0] = center.x; p[1] = center.y; p[2] = center.z;
      p[3] = options.params.amplitude ?? 10;
      p[4] = options.params.frequency ?? 0.1;
      p[5] = options.params.width ?? 100;
      break;
    case "spiral":
      p[0] = center.x; p[1] = center.y; p[2] = center.z;
      p[3] = options.params.radius ?? 10;
      p[4] = options.params.height ?? 50;
      p[5] = options.params.turns ?? 3;
      break;
    case "cone": {
      p[0] = center.x; p[1] = center.y; p[2] = center.z;
      const dir = options.params.direction ?? { x: 0, y: 1, z: 0 };
      p[3] = dir.x; p[4] = dir.y; p[5] = dir.z;
      p[6] = options.params.cosHalfAngle ?? Math.cos(Math.PI / 6);
      p[7] = options.params.length ?? 100;
      break;
    }
  }
  return p;
}

function buildCpuField(options: SampleFieldUltraOptions): VectorField {
  const center = options.params.center ?? { x: 0, y: 0, z: 0 };
  switch (options.fieldType) {
    case "radial":
      return createRadialField({
        id: "ultra_radial", name: "Radial", center,
        radius: options.params.radius ?? 1,
      });
    case "wave":
      return createWaveField({
        id: "ultra_wave", name: "Wave", center,
        width: options.params.width ?? 100,
        amplitude: options.params.amplitude ?? 10,
        frequency: options.params.frequency ?? 0.1,
      });
    case "spiral":
      return createSpiralField({
        id: "ultra_spiral", name: "Spiral", center,
        radius: options.params.radius ?? 10,
        height: options.params.height ?? 50,
        turns: options.params.turns ?? 3,
      });
    case "cone":
      return createConeBeamField({
        id: "ultra_cone", name: "Cone", origin: center,
        direction: options.params.direction ?? { x: 0, y: 1, z: 0 },
        angleRadians: Math.acos(options.params.cosHalfAngle ?? Math.cos(Math.PI / 6)),
        length: options.params.length ?? 100,
      });
    case "cluster":
      return createClusterField({
        id: "ultra_cluster", name: "Cluster",
        centers: options.params.clusterCenters ?? [center],
        radius: options.params.radius ?? 1,
      });
  }
}

/**
 * Sort GPU candidates by density desc and take the top `droneCount`,
 * optionally enforcing minDistance via greedy rejection. O(N log N) sort
 * + O(K²) min-distance check where K = droneCount (small in practice).
 */
function filterCandidatesByDensity(
  data: Float32Array,
  candidateCount: number,
  droneCount: number,
  minDistance: number,
): Vec3[] {
  // Pack as (index, density) tuples; sort desc by density.
  const indices = new Uint32Array(candidateCount);
  for (let i = 0; i < candidateCount; i++) indices[i] = i;
  // Sort via a side array of densities.
  const densities = new Float32Array(candidateCount);
  for (let i = 0; i < candidateCount; i++) densities[i] = data[i * 4 + 3];

  const sorted = Array.from(indices).sort((a, b) => densities[b] - densities[a]);

  const out: Vec3[] = [];
  const minDist2 = minDistance * minDistance;
  for (let k = 0; k < sorted.length && out.length < droneCount; k++) {
    const idx = sorted[k];
    const d = densities[idx];
    if (d <= 0) break; // remaining candidates have no signal
    const x = data[idx * 4 + 0];
    const y = data[idx * 4 + 1];
    const z = data[idx * 4 + 2];
    const p: Vec3 = { x, y, z };
    if (minDistance > 0) {
      let ok = true;
      for (let j = 0; j < out.length; j++) {
        const q = out[j];
        const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z;
        if (dx * dx + dy * dy + dz * dz < minDist2) { ok = false; break; }
      }
      if (!ok) continue;
    }
    out.push(p);
  }
  // Suppress unused-import lint warning.
  void distance;
  return out;
}
