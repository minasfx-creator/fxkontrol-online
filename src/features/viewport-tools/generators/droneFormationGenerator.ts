/**
 * Drone Formation Generator (parametric)
 * ────────────────────────────────────────────────────────────
 * Builds a `DroneFormation` payload (Circle / Grid / Heart / Spiral / Wave)
 * with control over count, radius, height and timing. Pure function.
 *
 * The plugin command later pushes the result to the store via
 * `addDroneFormation`, so undo simply removes by id.
 */

import type { DroneFormation } from '@/types/projectTypes';

export type FormationShape = 'circle' | 'grid' | 'heart' | 'spiral' | 'wave';

export interface FormationParams {
  shape: FormationShape;
  droneCount: number;
  height: number;        // m
  radius: number;        // m
  spacing: number;       // m (used for grid)
  rotation?: number;     // deg
  startTime: number;
  transitionDuration?: number;
  holdDuration?: number;
  color?: string;
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildPoints(shape: FormationShape, n: number, radius: number, spacing: number) {
  const pts: { x: number; z: number }[] = [];
  switch (shape) {
    case 'circle': {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push({ x: Math.cos(a) * radius, z: Math.sin(a) * radius });
      }
      break;
    }
    case 'grid': {
      const side = Math.ceil(Math.sqrt(n));
      const half = ((side - 1) * spacing) / 2;
      for (let i = 0; i < n; i++) {
        const r = Math.floor(i / side);
        const c = i % side;
        pts.push({ x: c * spacing - half, z: r * spacing - half });
      }
      break;
    }
    case 'heart': {
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        pts.push({ x: (x / 16) * radius, z: (y / 16) * radius });
      }
      break;
    }
    case 'spiral': {
      const turns = 3;
      for (let i = 0; i < n; i++) {
        const t = i / Math.max(1, n - 1);
        const a = t * turns * Math.PI * 2;
        const r = t * radius;
        pts.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
      }
      break;
    }
    case 'wave': {
      for (let i = 0; i < n; i++) {
        const t = i / Math.max(1, n - 1);
        const x = (t - 0.5) * radius * 2;
        const z = Math.sin(t * Math.PI * 2) * (radius / 3);
        pts.push({ x, z });
      }
      break;
    }
  }
  return pts;
}

export function generateDroneFormation(params: FormationParams): DroneFormation {
  const droneCount = Math.max(1, Math.min(2000, Math.floor(params.droneCount)));
  const points = buildPoints(params.shape, droneCount, params.radius, params.spacing);
  return {
    id: uid('form'),
    formationType: params.shape,
    droneCount,
    height: params.height,
    radius: params.radius,
    spacing: params.spacing,
    rotation: params.rotation ?? 0,
    startTime: params.startTime,
    transitionDuration: params.transitionDuration ?? 4,
    holdDuration: params.holdDuration ?? 6,
    color: params.color ?? '#00e5ff',
    points,
  };
}
