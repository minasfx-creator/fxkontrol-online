/**
 * Deterministic field sampling.
 *
 * Strategy: rejection sampling weighted by density, with optional minimum
 * distance and a deterministic fallback fill so the caller always receives
 * exactly `count` points (useful for fixed drone counts).
 */
import type { Vec3 } from "../types";
import type { Bounds3D, FieldSampleOptions, VectorField } from "./types";
import { distance } from "./vector";

function createSeededRandom(seed = 1): () => number {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function randomPoint(random: () => number, bounds: Bounds3D): Vec3 {
  return {
    x: bounds.minX + random() * (bounds.maxX - bounds.minX),
    y: bounds.minY + random() * (bounds.maxY - bounds.minY),
    z: bounds.minZ + random() * (bounds.maxZ - bounds.minZ),
  };
}

export function sampleField(
  field: VectorField,
  options: FieldSampleOptions & { minDistance?: number },
): Vec3[] {
  const random = createSeededRandom(options.seed ?? 1);
  const maxAttempts = options.maxAttempts ?? options.count * 300;
  const minDensity = options.minDensity ?? 0.05;
  const minDistance = options.minDistance ?? 0;
  const points: Vec3[] = [];

  let attempts = 0;
  while (points.length < options.count && attempts < maxAttempts) {
    attempts++;
    const point = randomPoint(random, options.bounds);
    const density = field.density(point);
    if (density < minDensity) continue;
    if (random() > density) continue;

    if (
      minDistance > 0 &&
      points.some((existing) => distance(existing, point) < minDistance)
    ) {
      continue;
    }

    points.push(point);
  }

  // Deterministic fallback fill — caller always receives `count` points.
  while (points.length < options.count) {
    points.push(randomPoint(random, options.bounds));
  }

  return points;
}
