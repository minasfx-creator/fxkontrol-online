/**
 * SwarmGPT Advanced — RealityScan / RealityCapture mesh → Vec3 point cloud.
 * Deterministic stride downsampling when vertex count exceeds maxVertices.
 */
import type { Vec3 } from '../../types';

export interface RealityScanMeshLike {
  vertices: Vec3[];
  name?: string;
}

export interface RealityScanAdapterOptions {
  maxVertices?: number;
}

export function realityScanMeshToPointCloud(
  mesh: RealityScanMeshLike,
  options?: RealityScanAdapterOptions,
): Vec3[] {
  if (!mesh || !mesh.vertices || mesh.vertices.length === 0) return [];
  const maxVertices = Math.max(0, options?.maxVertices ?? 20000);
  if (maxVertices === 0) return [];

  const verts = mesh.vertices;
  if (verts.length <= maxVertices) return verts.slice();

  const result: Vec3[] = new Array(maxVertices);
  for (let i = 0; i < maxVertices; i++) {
    const idx = Math.floor((i / maxVertices) * verts.length);
    result[i] = verts[idx];
  }
  return result;
}
