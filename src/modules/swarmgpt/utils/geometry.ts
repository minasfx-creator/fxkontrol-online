/**
 * SwarmGPT 2.0 — Pure geometry helpers (no THREE, no DOM, no allocations in hot path).
 */
import type { SwarmGPTBounds, Vec3 } from '../types';

export function distance3(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function clampPoint(point: Vec3, bounds: SwarmGPTBounds): Vec3 {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, point.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, point.y)),
    z: Math.min(bounds.maxZ, Math.max(bounds.minZ, point.z)),
  };
}

export function isInsideBounds(point: Vec3, bounds: SwarmGPTBounds): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY &&
    point.z >= bounds.minZ &&
    point.z <= bounds.maxZ
  );
}
