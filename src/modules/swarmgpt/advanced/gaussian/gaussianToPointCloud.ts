import type { Vec3 } from "../../types";

export type GaussianSplatPoint = {
  position: Vec3;
  scale?: Vec3;
  opacity?: number;
  color?: string;
};

export function gaussianSplatsToPointCloud(
  splats: GaussianSplatPoint[],
  options?: {
    minOpacity?: number;
    maxPoints?: number;
  },
): Vec3[] {
  if (!Array.isArray(splats) || splats.length === 0) return [];
  const minOpacity = options?.minOpacity ?? 0.15;
  const maxPoints = Math.max(1, Math.floor(options?.maxPoints ?? 10000));

  return splats
    .filter((splat) => (splat.opacity ?? 1) >= minOpacity)
    .slice(0, maxPoints)
    .map((splat) => splat.position);
}

