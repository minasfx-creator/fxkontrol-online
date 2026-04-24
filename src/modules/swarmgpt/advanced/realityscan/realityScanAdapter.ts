import type { Vec3 } from "../../types";

export type RealityScanMeshLike = {
  vertices: Vec3[];
  name?: string;
};

export function realityScanMeshToPointCloud(
  mesh: RealityScanMeshLike,
  options?: {
    maxVertices?: number;
  },
): Vec3[] {
  const vertices = Array.isArray(mesh?.vertices) ? mesh.vertices : [];
  if (vertices.length === 0) return [];

  const maxVertices = Math.max(1, Math.floor(options?.maxVertices ?? 20000));
  if (vertices.length <= maxVertices) return [...vertices];

  const result: Vec3[] = [];
  for (let i = 0; i < maxVertices; i++) {
    const index = Math.floor((i / maxVertices) * vertices.length);
    result.push(vertices[index]);
  }
  return result;
}

