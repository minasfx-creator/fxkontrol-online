import type { Vec3, Bounds } from "../types";

export function distance3(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.hypot(dx, dy, dz);
}

export function isInsideBounds(p: Vec3, b: Bounds): boolean {
  return (
    p.x >= b.minX && p.x <= b.maxX &&
    p.y >= b.minY && p.y <= b.maxY &&
    p.z >= b.minZ && p.z <= b.maxZ
  );
}
