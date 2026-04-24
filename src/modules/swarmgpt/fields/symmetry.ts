/**
 * Post-sample symmetry helpers — bilateral and radial replication.
 * Cheaper than mirroring the field itself when you've already sampled.
 */
import type { Vec3 } from "../types";

export function mirrorPointsX(points: Vec3[]): Vec3[] {
  return points.map((point) => ({ ...point, x: -point.x }));
}

export function mirrorPointsZ(points: Vec3[]): Vec3[] {
  return points.map((point) => ({ ...point, z: -point.z }));
}

export function applyBilateralSymmetryX(points: Vec3[], targetCount: number): Vec3[] {
  const half = Math.ceil(targetCount / 2);
  const base = points.slice(0, half);
  const mirrored = mirrorPointsX(base);
  return [...base, ...mirrored].slice(0, targetCount);
}

export function applyRadialSymmetryY(
  points: Vec3[],
  copies: number,
  center: Vec3,
  targetCount: number,
): Vec3[] {
  if (copies <= 1) return points.slice(0, targetCount);

  const output: Vec3[] = [];
  for (const point of points) {
    const relX = point.x - center.x;
    const relZ = point.z - center.z;
    for (let i = 0; i < copies; i++) {
      const angle = (i / copies) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      output.push({
        x: center.x + relX * cos - relZ * sin,
        y: point.y,
        z: center.z + relX * sin + relZ * cos,
      });
      if (output.length >= targetCount) return output;
    }
  }
  return output.slice(0, targetCount);
}
