/**
 * Field factories — beam, radial, wave, spiral, cluster primitives.
 * Each factory returns a pure `VectorField`; compose with `composeFields`.
 */
import type { Vec3 } from "../types";
import type { VectorField } from "./types";
import { clamp01, dot, length, normalize, sub, ZERO_VEC3 } from "./vector";

export function createConeBeamField(args: {
  id: string;
  name: string;
  origin: Vec3;
  direction: Vec3;
  angleRadians: number;
  length: number;
  intensity?: number;
  color?: string;
}): VectorField {
  const dir = normalize(args.direction);
  const cosAngle = Math.cos(args.angleRadians);
  const intensity = args.intensity ?? 1;
  const colorStr = args.color;

  return {
    id: args.id,
    name: args.name,
    density: (point) => {
      const toPoint = sub(point, args.origin);
      const dist = length(toPoint);
      if (dist <= 1e-6 || dist > args.length) return 0;

      const ray = normalize(toPoint);
      const alignment = dot(ray, dir);
      if (alignment < cosAngle) return 0;

      const coneScore = (alignment - cosAngle) / Math.max(1e-6, 1 - cosAngle);
      const falloff = 1 - dist / args.length;
      return clamp01(coneScore * falloff * intensity);
    },
    flow: () => ZERO_VEC3,
    color: colorStr ? () => colorStr : undefined,
    metadata: {
      type: "cone_beam",
      origin: args.origin,
      direction: dir,
      angleRadians: args.angleRadians,
      length: args.length,
    },
  };
}

export function createRadialField(args: {
  id: string;
  name: string;
  center: Vec3;
  radius: number;
  intensity?: number;
  color?: string;
}): VectorField {
  const intensity = args.intensity ?? 1;
  const colorStr = args.color;

  return {
    id: args.id,
    name: args.name,
    density: (point) => {
      const d = length(sub(point, args.center));
      return clamp01((1 - d / args.radius) * intensity);
    },
    flow: (point) => normalize(sub(args.center, point)),
    color: colorStr ? () => colorStr : undefined,
    metadata: { type: "radial", center: args.center, radius: args.radius },
  };
}

export function createWaveField(args: {
  id: string;
  name: string;
  center: Vec3;
  width: number;
  amplitude: number;
  frequency: number;
  intensity?: number;
  color?: string;
}): VectorField {
  const intensity = args.intensity ?? 1;
  const colorStr = args.color;

  return {
    id: args.id,
    name: args.name,
    density: (point) => {
      const localX = point.x - args.center.x;
      const waveZ = args.center.z + Math.sin(localX * args.frequency) * args.amplitude;
      const dz = Math.abs(point.z - waveZ);
      const dx = Math.abs(localX);
      const widthScore = clamp01(1 - dx / args.width);
      const lineScore = clamp01(1 - dz / Math.max(1, args.amplitude));
      return clamp01(widthScore * lineScore * intensity);
    },
    flow: (point, time) => ({
      x: 0,
      y: 0,
      z: Math.sin(time + point.x * args.frequency) * 0.5,
    }),
    color: colorStr ? () => colorStr : undefined,
    metadata: {
      type: "wave",
      center: args.center,
      width: args.width,
      amplitude: args.amplitude,
      frequency: args.frequency,
    },
  };
}

export function createSpiralField(args: {
  id: string;
  name: string;
  center: Vec3;
  radius: number;
  height: number;
  turns: number;
  intensity?: number;
  color?: string;
}): VectorField {
  const intensity = args.intensity ?? 1;
  const colorStr = args.color;

  return {
    id: args.id,
    name: args.name,
    density: (point) => {
      const rel = sub(point, args.center);
      const radial = Math.sqrt(rel.x * rel.x + rel.z * rel.z);
      const angle = Math.atan2(rel.z, rel.x);
      const y01 = clamp01((rel.y + args.height / 2) / args.height);
      const expectedAngle = y01 * Math.PI * 2 * args.turns;
      const angleDiff = Math.abs(Math.sin((angle - expectedAngle) / 2));
      const radialScore = clamp01(1 - Math.abs(radial - args.radius * y01) / args.radius);
      const angleScore = clamp01(1 - angleDiff);
      return clamp01(radialScore * angleScore * intensity);
    },
    flow: (point) => {
      const rel = sub(point, args.center);
      return normalize({ x: -rel.z, y: 0.2, z: rel.x });
    },
    color: colorStr ? () => colorStr : undefined,
    metadata: {
      type: "spiral",
      center: args.center,
      radius: args.radius,
      height: args.height,
      turns: args.turns,
    },
  };
}

export function createClusterField(args: {
  id: string;
  name: string;
  centers: Vec3[];
  radius: number;
  intensity?: number;
  color?: string;
}): VectorField {
  const intensity = args.intensity ?? 1;
  const colorStr = args.color;

  return {
    id: args.id,
    name: args.name,
    density: (point) => {
      let best = 0;
      for (const center of args.centers) {
        const d = length(sub(point, center));
        best = Math.max(best, clamp01(1 - d / args.radius));
      }
      return clamp01(best * intensity);
    },
    flow: (point) => {
      let bestCenter: Vec3 | null = null;
      let bestDistance = Infinity;
      for (const center of args.centers) {
        const d = length(sub(point, center));
        if (d < bestDistance) {
          bestDistance = d;
          bestCenter = center;
        }
      }
      return bestCenter ? normalize(sub(bestCenter, point)) : ZERO_VEC3;
    },
    color: colorStr ? () => colorStr : undefined,
    metadata: { type: "cluster", centers: args.centers, radius: args.radius },
  };
}
