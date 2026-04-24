import type { Vec3 } from "../../types";

export type SvgSamplePoint = {
  x: number;
  y: number;
};

export function svgPointsToDronePoints(
  points: SvgSamplePoint[],
  options: {
    scale: number;
    center: Vec3;
  },
): Vec3[] {
  if (!Array.isArray(points) || points.length === 0) return [];
  const scale = Number.isFinite(options?.scale) ? options.scale : 1;
  const center = options?.center ?? { x: 0, y: 30, z: 0 };

  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const width = Math.max(1e-6, maxX - minX);
  const height = Math.max(1e-6, maxY - minY);
  const maxAxis = Math.max(width, height);

  return points.map((point) => ({
    x: center.x + ((point.x - (minX + width / 2)) / maxAxis) * scale,
    y: center.y,
    z: center.z - ((point.y - (minY + height / 2)) / maxAxis) * scale,
  }));
}

