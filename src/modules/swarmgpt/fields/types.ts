/**
 * SwarmGPT Fields — Volumetric field types.
 *
 * A `VectorField` is a continuous spatial function: at any point it returns
 *   - density ∈ [0,1]: how "present" the swarm should be
 *   - flow: time-varying direction vector
 *   - color: optional per-point color
 *
 * Composed with `combineFields` / `blendFields` / `mirrorFieldX` and sampled
 * via `sampleField` to produce `DroneFormation` point lists.
 */
import type { Vec3 } from "../types";

export type Bounds3D = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

export type FieldColor = string;

export type VectorField = {
  id: string;
  name: string;
  density: (point: Vec3) => number;
  flow: (point: Vec3, time: number) => Vec3;
  color?: (point: Vec3) => FieldColor | undefined;
  metadata?: Record<string, unknown>;
};

export type FieldSampleOptions = {
  bounds: Bounds3D;
  count: number;
  maxAttempts?: number;
  minDensity?: number;
  seed?: number;
};

export type FieldToFormationOptions = {
  id?: string;
  name: string;
  startTime: number;
  duration: number;
  bounds: Bounds3D;
  droneCount: number;
  color?: string;
  seed?: number;
};
