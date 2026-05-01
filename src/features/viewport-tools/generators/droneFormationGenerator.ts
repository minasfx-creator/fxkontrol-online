/**
 * Drone Formation Generator (parametric, blueprint v2)
 * ────────────────────────────────────────────────────────────
 * Builds a `DroneFormation` payload from a parametric shape.
 *
 * Shapes supported:
 *   2D (XZ plane, height = formation.height):
 *     circle, grid, heart, spiral, wave, star
 *   3D (per-point Y, additive over formation.height):
 *     sphere, helix, cube, text
 *
 * The generator is a PURE function — no store mutation, no IO.
 * Callers receive a `FormationGeneratorResult` carrying:
 *   - the formation payload (ready for `addDroneFormation`)
 *   - a CollisionReport (min spacing, violation count, worst pair)
 *   - warnings (count clamps, text glyph fallbacks, etc.)
 *
 * Per project policy: simulation == reality. Collision rules use the
 * same minimum-separation constant the SafetyEngine uses for swarms.
 */

import type { DroneFormation } from '@/types/projectTypes';

export type FormationShape =
  | 'circle'
  | 'grid'
  | 'heart'
  | 'spiral'
  | 'wave'
  | 'star'
  | 'sphere'
  | 'helix'
  | 'cube'
  | 'text';

/** NFPA 2407-aligned default min separation between drones (m). */
export const MIN_DRONE_SEPARATION_M = 2.0;

export interface FormationParams {
  shape: FormationShape;
  droneCount: number;
  height: number;        // m (formation altitude floor)
  radius: number;        // m
  spacing: number;       // m (grid / cube cell, helix vertical step)
  rotation?: number;     // deg, applied around Y at generation
  startTime: number;
  transitionDuration?: number;
  holdDuration?: number;
  color?: string;
  /** For shape='text' only. ASCII letters / digits / space. */
  text?: string;
  /** For shape='star'. Number of points. Default 5. */
  starPoints?: number;
}

export interface FormationPoint {
  x: number;
  z: number;
  /** Optional vertical offset over formation.height. Treated as 0 if missing. */
  y?: number;
}

export interface CollisionReport {
  ok: boolean;
  minSpacingM: number;
  worstPair?: { i: number; j: number; dist: number };
  violations: number;
  threshold: number;
}

export interface FormationGeneratorResult {
  formation: DroneFormation;
  collision: CollisionReport;
  warnings: string[];
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── 5x5 ASCII glyph atlas (digits + a few letters) ────────────────────
// 1 = drone-on. Used by shape='text'. Unknown chars render as space.
const GLYPHS: Record<string, string[]> = {
  ' ': ['00000', '00000', '00000', '00000', '00000'],
  '0': ['01110', '10001', '10001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '01110'],
  '2': ['11110', '00001', '01110', '10000', '11111'],
  '3': ['11110', '00001', '01110', '00001', '11110'],
  '4': ['10010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '11110'],
  '6': ['01110', '10000', '11110', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000'],
  '8': ['01110', '10001', '01110', '10001', '01110'],
  '9': ['01110', '10001', '01111', '00001', '01110'],
  A: ['01110', '10001', '11111', '10001', '10001'],
  E: ['11111', '10000', '11110', '10000', '11111'],
  F: ['11111', '10000', '11110', '10000', '10000'],
  H: ['10001', '10001', '11111', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '11111'],
  K: ['10010', '10100', '11000', '10100', '10010'],
  L: ['10000', '10000', '10000', '10000', '11111'],
  N: ['10001', '11001', '10101', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '01110'],
  R: ['11110', '10001', '11110', '10100', '10010'],
  S: ['01111', '10000', '01110', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100'],
  X: ['10001', '01010', '00100', '01010', '10001'],
  Y: ['10001', '01010', '00100', '00100', '00100'],
};

function buildTextPoints(text: string, n: number, scale: number): FormationPoint[] {
  const upper = (text || ' ').toUpperCase();
  const all: { gx: number; gy: number }[] = [];
  for (let ci = 0; ci < upper.length; ci++) {
    const ch = upper[ci];
    const glyph = GLYPHS[ch] ?? GLYPHS[' '];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (glyph[r][c] === '1') {
          all.push({ gx: ci * 6 + c, gy: 4 - r });
        }
      }
    }
  }
  if (all.length === 0) return [];

  // Center & scale
  const minGx = Math.min(...all.map((p) => p.gx));
  const maxGx = Math.max(...all.map((p) => p.gx));
  const cx = (minGx + maxGx) / 2;
  const cellW = scale; // 1 cell == `scale` meters

  // Sample / repeat to fit n
  const out: FormationPoint[] = [];
  for (let i = 0; i < n; i++) {
    const src = all[i % all.length];
    out.push({
      x: (src.gx - cx) * cellW,
      z: 0,
      y: src.gy * cellW,
    });
  }
  return out;
}

function buildPoints(p: FormationParams): FormationPoint[] {
  const n = Math.max(1, Math.min(2000, Math.floor(p.droneCount)));
  const r = Math.max(0.1, p.radius);
  const sp = Math.max(0.1, p.spacing);
  const pts: FormationPoint[] = [];

  switch (p.shape) {
    case 'circle': {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
      }
      break;
    }
    case 'grid': {
      const side = Math.ceil(Math.sqrt(n));
      const half = ((side - 1) * sp) / 2;
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / side);
        const col = i % side;
        pts.push({ x: col * sp - half, z: row * sp - half });
      }
      break;
    }
    case 'heart': {
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        pts.push({ x: (x / 16) * r, z: (y / 16) * r });
      }
      break;
    }
    case 'spiral': {
      const turns = 3;
      for (let i = 0; i < n; i++) {
        const t = i / Math.max(1, n - 1);
        const a = t * turns * Math.PI * 2;
        const rr = t * r;
        pts.push({ x: Math.cos(a) * rr, z: Math.sin(a) * rr });
      }
      break;
    }
    case 'wave': {
      for (let i = 0; i < n; i++) {
        const t = i / Math.max(1, n - 1);
        const x = (t - 0.5) * r * 2;
        const z = Math.sin(t * Math.PI * 2) * (r / 3);
        pts.push({ x, z });
      }
      break;
    }
    case 'star': {
      const points = Math.max(3, p.starPoints ?? 5);
      const inner = r * 0.45;
      for (let i = 0; i < n; i++) {
        const idx = i % (points * 2);
        const a = (idx / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const rr = idx % 2 === 0 ? r : inner;
        pts.push({ x: Math.cos(a) * rr, z: Math.sin(a) * rr });
      }
      break;
    }
    case 'sphere': {
      // Fibonacci sphere — even distribution.
      const phi = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < n; i++) {
        const yNorm = 1 - (i / Math.max(1, n - 1)) * 2; // 1 → -1
        const radiusAtY = Math.sqrt(1 - yNorm * yNorm);
        const theta = phi * i;
        pts.push({
          x: Math.cos(theta) * radiusAtY * r,
          z: Math.sin(theta) * radiusAtY * r,
          y: yNorm * r + r, // bottom of sphere sits on formation.height
        });
      }
      break;
    }
    case 'helix': {
      const turns = Math.max(1, Math.round(n / 24));
      for (let i = 0; i < n; i++) {
        const t = i / Math.max(1, n - 1);
        const a = t * turns * Math.PI * 2;
        pts.push({
          x: Math.cos(a) * r,
          z: Math.sin(a) * r,
          y: t * sp * n * 0.05, // gentle climb
        });
      }
      break;
    }
    case 'cube': {
      // Hollow cube shell, layers along Y.
      const side = Math.max(2, Math.ceil(Math.cbrt(n)));
      const half = ((side - 1) * sp) / 2;
      let i = 0;
      outer: for (let yi = 0; yi < side; yi++) {
        for (let zi = 0; zi < side; zi++) {
          for (let xi = 0; xi < side; xi++) {
            const onShell =
              xi === 0 || xi === side - 1 ||
              yi === 0 || yi === side - 1 ||
              zi === 0 || zi === side - 1;
            if (!onShell) continue;
            if (i >= n) break outer;
            pts.push({
              x: xi * sp - half,
              z: zi * sp - half,
              y: yi * sp,
            });
            i++;
          }
        }
      }
      break;
    }
    case 'text': {
      pts.push(...buildTextPoints(p.text ?? 'FXK', n, sp));
      break;
    }
  }

  // Apply rotation around Y axis (heading)
  const rot = ((p.rotation ?? 0) * Math.PI) / 180;
  if (rot !== 0) {
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    for (const pt of pts) {
      const nx = pt.x * cos - pt.z * sin;
      const nz = pt.x * sin + pt.z * cos;
      pt.x = nx;
      pt.z = nz;
    }
  }

  return pts;
}

/** Compute pairwise minimum spacing in 3D. O(n²) — bounded by 2000 cap. */
export function checkCollisions(
  points: FormationPoint[],
  threshold: number = MIN_DRONE_SEPARATION_M,
  formationHeight = 0,
): CollisionReport {
  let min = Infinity;
  let worst: { i: number; j: number; dist: number } | undefined;
  let violations = 0;

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const ay = formationHeight + (a.y ?? 0);
    for (let j = i + 1; j < points.length; j++) {
      const b = points[j];
      const by = formationHeight + (b.y ?? 0);
      const dx = a.x - b.x;
      const dy = ay - by;
      const dz = a.z - b.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < min) {
        min = d;
        worst = { i, j, dist: d };
      }
      if (d < threshold) violations++;
    }
  }

  return {
    ok: violations === 0,
    minSpacingM: Number.isFinite(min) ? min : 0,
    worstPair: worst,
    violations,
    threshold,
  };
}

export function generateDroneFormation(params: FormationParams): DroneFormation {
  const result = generateDroneFormationDetailed(params);
  return result.formation;
}

export function generateDroneFormationDetailed(
  params: FormationParams,
): FormationGeneratorResult {
  const warnings: string[] = [];
  const requested = Math.floor(params.droneCount);
  if (requested > 2000) warnings.push(`Drone count clamped to 2000 (was ${requested}).`);
  if (requested < 1) warnings.push(`Drone count clamped to 1 (was ${requested}).`);

  const droneCount = Math.max(1, Math.min(2000, requested));

  const points3d = buildPoints({ ...params, droneCount });
  if (params.shape === 'text' && (!params.text || !params.text.trim())) {
    warnings.push('Empty text — used default "FXK".');
  }

  const collision = checkCollisions(points3d, MIN_DRONE_SEPARATION_M, params.height);
  if (!collision.ok) {
    warnings.push(
      `Collision: ${collision.violations} pair(s) below ${collision.threshold}m (min ${collision.minSpacingM.toFixed(2)}m).`,
    );
  }

  // DroneFormation.points is XZ-only in the legacy schema. Strip y but
  // preserve it via a parallel `pointsY` field on the formation when present
  // (downstream renderer reads either; safe to ignore).
  const points = points3d.map(({ x, z }) => ({ x, z }));
  const hasY = points3d.some((p) => (p.y ?? 0) !== 0);

  const formation: DroneFormation & { pointsY?: number[] } = {
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
  if (hasY) {
    (formation as DroneFormation & { pointsY: number[] }).pointsY = points3d.map((p) => p.y ?? 0);
  }

  return { formation, collision, warnings };
}
