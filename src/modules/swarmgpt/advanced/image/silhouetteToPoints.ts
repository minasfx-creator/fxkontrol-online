import type { Vec3 } from "../../types";

export type SilhouettePixel = {
  x: number;
  y: number;
  intensity?: number;
};

export function silhouetteToPoints(
  pixels: SilhouettePixel[],
  options?: {
    center?: Vec3;
    scale?: number;
    minIntensity?: number;
  },
): Vec3[] {
  if (!Array.isArray(pixels) || pixels.length === 0) return [];
  const minIntensity = options?.minIntensity ?? 0;
  const filtered = pixels.filter((p) => (p.intensity ?? 1) >= minIntensity);
  if (filtered.length === 0) return [];

  const center = options?.center ?? { x: 0, y: 30, z: 0 };
  const scale = options?.scale ?? 50;
  const minX = Math.min(...filtered.map((p) => p.x));
  const maxX = Math.max(...filtered.map((p) => p.x));
  const minY = Math.min(...filtered.map((p) => p.y));
  const maxY = Math.max(...filtered.map((p) => p.y));
  const width = Math.max(1e-6, maxX - minX);
  const height = Math.max(1e-6, maxY - minY);
  const maxAxis = Math.max(width, height);

  return filtered.map((pixel) => ({
    x: center.x + ((pixel.x - (minX + width / 2)) / maxAxis) * scale,
    y: center.y,
    z: center.z - ((pixel.y - (minY + height / 2)) / maxAxis) * scale,
  }));
}

