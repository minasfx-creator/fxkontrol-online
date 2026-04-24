/**
 * SwarmGPT Advanced — SVG sample points → drone Vec3 points.
 * Pure, deterministic. Maps SVG Y → world Z (negated), keeps Y = center.y.
 */
import type { Vec3 } from '../../types';

export type SvgSamplePoint = { x: number; y: number };

export interface SvgToDronePointsOptions {
  scale: number;
  center: Vec3;
}

export function svgPointsToDronePoints(
  points: SvgSamplePoint[],
  options: SvgToDronePointsOptions,
): Vec3[] {
  if (!points || points.length === 0) return [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const width = Math.max(1e-6, maxX - minX);
  const height = Math.max(1e-6, maxY - minY);
  const maxAxis = Math.max(width, height);
  const cx = minX + width / 2;
  const cy = minY + height / 2;

  return points.map((p) => ({
    x: options.center.x + ((p.x - cx) / maxAxis) * options.scale,
    y: options.center.y,
    z: options.center.z - ((p.y - cy) / maxAxis) * options.scale,
  }));
}
