/**
 * SwarmGPT Advanced — Mesh Quality.
 *
 * Mirrors RealityScan 2.0 "Mesh Quality": per-triangle coverage based on the
 * number of cameras that can "see" the triangle (camera in front of the
 * triangle's plane and within range). Optionally projects per-triangle scores
 * to per-vertex scores via area-weighted averaging — used by the vertex-color
 * bake path.
 *
 * Pure module — no THREE, no DOM.
 */
import type { Vec3 } from '../../types';
import type { CameraView } from './tiePointQuality';
import { clamp01 } from './qualityColorRamp';

export interface MeshQualityOptions {
  /** Cameras beyond this distance to the centroid don't count. Default 200. */
  maxDistance?: number;
  /** Score saturates at this many visible cameras. Default 6. */
  saturationCount?: number;
  /** Whether to require front-facing cameras (dot(normal, viewDir) > 0). Default true. */
  requireFrontFacing?: boolean;
}

export interface MeshQualityResult {
  /** Per-triangle score [0..1], length = indices.length / 3. */
  triangleScores: Float32Array;
  /** Per-vertex score [0..1], area-weighted from triangles. */
  vertexScores: Float32Array;
  min: number;
  max: number;
  mean: number;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function length(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

export function computeMeshQuality(
  vertices: Vec3[],
  indices: number[],
  cameras: CameraView[],
  options: MeshQualityOptions = {},
): MeshQualityResult {
  const maxDistance = Math.max(1e-6, options.maxDistance ?? 200);
  const saturationCount = Math.max(1, options.saturationCount ?? 6);
  const requireFrontFacing = options.requireFrontFacing ?? true;

  const triCount = Math.floor(indices.length / 3);
  const triangleScores = new Float32Array(triCount);
  const vertexScores = new Float32Array(vertices.length);
  const vertexWeights = new Float32Array(vertices.length);

  if (triCount === 0 || vertices.length === 0) {
    return { triangleScores, vertexScores, min: 0, max: 0, mean: 0 };
  }

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;

  for (let t = 0; t < triCount; t++) {
    const i0 = indices[t * 3];
    const i1 = indices[t * 3 + 1];
    const i2 = indices[t * 3 + 2];
    const a = vertices[i0];
    const b = vertices[i1];
    const c = vertices[i2];
    if (!a || !b || !c) continue;

    const ab = sub(b, a);
    const ac = sub(c, a);
    const n = cross(ab, ac);
    const nLen = length(n) || 1;
    const normal: Vec3 = { x: n.x / nLen, y: n.y / nLen, z: n.z / nLen };
    const area = 0.5 * nLen;
    const centroid: Vec3 = {
      x: (a.x + b.x + c.x) / 3,
      y: (a.y + b.y + c.y) / 3,
      z: (a.z + b.z + c.z) / 3,
    };

    let visible = 0;
    for (const cam of cameras) {
      const view = sub(cam.position, centroid);
      const d = length(view);
      if (d > maxDistance || d === 0) continue;
      if (requireFrontFacing) {
        const facing = dot(normal, { x: view.x / d, y: view.y / d, z: view.z / d });
        if (facing <= 0) continue;
      }
      visible++;
    }

    const score = clamp01(visible / saturationCount);
    triangleScores[t] = score;
    if (score < min) min = score;
    if (score > max) max = score;
    sum += score;

    // Splat to vertices weighted by triangle area.
    for (const vi of [i0, i1, i2]) {
      vertexScores[vi] += score * area;
      vertexWeights[vi] += area;
    }
  }

  for (let v = 0; v < vertexScores.length; v++) {
    if (vertexWeights[v] > 0) vertexScores[v] /= vertexWeights[v];
  }

  return {
    triangleScores,
    vertexScores,
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 0,
    mean: triCount > 0 ? sum / triCount : 0,
  };
}
