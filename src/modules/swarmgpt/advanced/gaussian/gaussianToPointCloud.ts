/**
 * SwarmGPT Advanced — Gaussian Splat centers → Vec3 point cloud.
 * Filter by opacity then cap by maxPoints. No rendering, no fetching.
 */
import type { Vec3 } from '../../types';

export interface GaussianSplatPoint {
  position: Vec3;
  scale?: Vec3;
  opacity?: number;
  color?: string;
}

export interface GaussianToPointCloudOptions {
  minOpacity?: number;
  maxPoints?: number;
}

export function gaussianSplatsToPointCloud(
  splats: GaussianSplatPoint[],
  options?: GaussianToPointCloudOptions,
): Vec3[] {
  if (!splats || splats.length === 0) return [];
  const minOpacity = options?.minOpacity ?? 0.15;
  const maxPoints = Math.max(0, options?.maxPoints ?? 10000);

  const out: Vec3[] = [];
  for (const splat of splats) {
    if (out.length >= maxPoints) break;
    const op = splat.opacity ?? 1;
    if (op >= minOpacity) out.push(splat.position);
  }
  return out;
}
