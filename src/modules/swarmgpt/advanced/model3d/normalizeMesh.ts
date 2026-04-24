/**
 * SwarmGPT Advanced — Mesh normalization to a target bounding sphere.
 * Recenters on origin, uniform-scales so max extent equals `scale`, swaps
 * Y↔Z when mesh is Z-up, then translates to `center`. Pure.
 */
import type { Vec3 } from '../../types';

export interface NormalizeOptions {
  scale?: number;
  center?: Vec3;
  yUp?: boolean;
}

export interface NormalizedMesh {
  vertices: Vec3[];
  boundingBox: { min: Vec3; max: Vec3 };
}

const DEFAULT_CENTER: Vec3 = { x: 0, y: 50, z: 0 };

export function normalizeMeshToBounds(
  vertices: Vec3[],
  options: NormalizeOptions = {},
): NormalizedMesh {
  const { scale = 60, center = DEFAULT_CENTER, yUp = true } = options;
  if (!vertices || vertices.length === 0) {
    return {
      vertices: [],
      boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
    };
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
    if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  const factor = extent > 0 ? scale / extent : 1;

  const out: Vec3[] = new Array(vertices.length);
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    const nx = (v.x - cx) * factor;
    const ny = (v.y - cy) * factor;
    const nz = (v.z - cz) * factor;
    // Swap Y↔Z when source mesh is Z-up so the formation rises along world Y.
    out[i] = yUp
      ? { x: nx + center.x, y: ny + center.y, z: nz + center.z }
      : { x: nx + center.x, y: nz + center.y, z: ny + center.z };
  }

  return {
    vertices: out,
    boundingBox: {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    },
  };
}
