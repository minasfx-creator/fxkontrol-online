/**
 * Macro → per-drone trajectory expander.
 *
 * - Distributes drones across groups proportional to `num_drones` per keyframe.
 * - Generates each shape's local point set, then interpolates between consecutive
 *   keyframes with the requested easing.
 * - Reports min-separation collisions and observed peak speed for QA.
 *
 * Pure, deterministic, no DOM/React. Safe to call from UI or workers.
 */
import type {
  MacroChoreography,
  MacroFormation,
  MacroGroup,
  ExpandedShow,
  DroneFrame,
} from './types';

const DEFAULT_MIN_SEP = 2.0;

function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function applyEasing(t: number, kind: string): number {
  switch (kind) {
    case 'ease-in-out':
    case 'bezier':
    case 'spline':
      return easeInOut(t);
    default:
      return t;
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Generate `count` local points for a given shape, centered at (0,0,0). */
function shapePoints(shape: MacroGroup['shape'], radius: number, count: number): Array<[number, number, number]> {
  const pts: Array<[number, number, number]> = [];
  const r = Math.max(0.5, radius);
  if (count <= 0) return pts;
  switch (shape) {
    case 'circle':
    case 'wave': {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const wave = shape === 'wave' ? Math.sin(a * 3) * r * 0.2 : 0;
        pts.push([Math.cos(a) * r, wave, Math.sin(a) * r]);
      }
      break;
    }
    case 'sphere': {
      // Fibonacci sphere
      const phi = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < count; i++) {
        const y = 1 - (i / Math.max(1, count - 1)) * 2;
        const rr = Math.sqrt(1 - y * y);
        const th = phi * i;
        pts.push([Math.cos(th) * rr * r, y * r, Math.sin(th) * rr * r]);
      }
      break;
    }
    case 'line': {
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
        pts.push([t * r, 0, 0]);
      }
      break;
    }
    case 'grid': {
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      const sx = (2 * r) / Math.max(1, cols - 1);
      const sz = (2 * r) / Math.max(1, rows - 1);
      let i = 0;
      for (let row = 0; row < rows && i < count; row++) {
        for (let col = 0; col < cols && i < count; col++, i++) {
          pts.push([-r + col * sx, 0, -r + row * sz]);
        }
      }
      break;
    }
    case 'heart': {
      for (let i = 0; i < count; i++) {
        const t = (i / count) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        pts.push([(x / 17) * r, (y / 17) * r, 0]);
      }
      break;
    }
    case 'spiral': {
      const turns = 3;
      for (let i = 0; i < count; i++) {
        const t = i / Math.max(1, count - 1);
        const a = t * Math.PI * 2 * turns;
        pts.push([Math.cos(a) * r * t, t * r * 1.5, Math.sin(a) * r * t]);
      }
      break;
    }
    default: {
      // text / logo / custom → fall back to grid for safe placement
      return shapePoints('grid', radius, count);
    }
  }
  return pts;
}

interface DronePosKey {
  t: number;
  x: number; y: number; z: number;
  r: number; g: number; b: number;
}

/** Build the absolute position keys for each drone at every macro formation. */
function buildPositionKeys(macro: MacroChoreography, totalDrones: number): DronePosKey[][] {
  const keys: DronePosKey[][] = Array.from({ length: totalDrones }, () => []);
  const sortedFormations: MacroFormation[] = [...macro.formations].sort((a, b) => a.timestamp - b.timestamp);

  for (const f of sortedFormations) {
    // Normalize requested counts → total drones
    const requested = f.groups.reduce((s, g) => s + Math.max(0, g.num_drones), 0);
    const scale = requested > 0 ? totalDrones / requested : 0;

    const allocations: number[] = f.groups.map(g => Math.floor(g.num_drones * scale));
    let allocated = allocations.reduce((s, n) => s + n, 0);
    // Distribute remainder to largest groups
    let i = 0;
    while (allocated < totalDrones && f.groups.length > 0) {
      allocations[i % allocations.length] += 1;
      allocated += 1; i += 1;
    }

    let droneIdx = 0;
    for (let gi = 0; gi < f.groups.length; gi++) {
      const g = f.groups[gi];
      const n = Math.min(allocations[gi], totalDrones - droneIdx);
      if (n <= 0) continue;
      const pts = shapePoints(g.shape, g.radius, n);
      const [cx, cy, cz] = g.center;
      const [r, gC, b] = hexToRgb(g.color || '#00B4D8');
      for (let k = 0; k < n; k++) {
        const [lx, ly, lz] = pts[k];
        keys[droneIdx].push({
          t: f.timestamp,
          x: cx + lx,
          y: Math.max(10, cy + ly), // safety floor
          z: cz + lz,
          r, g: gC, b,
        });
        droneIdx++;
      }
    }
  }
  return keys;
}

function findTransitionEasing(macro: MacroChoreography, fromT: number, toT: number): string {
  const tr = macro.transitions?.find(t => t.from_timestamp <= fromT && t.to_timestamp >= toT);
  return tr?.easing ?? 'ease-in-out';
}

export function expandMacroToTrajectories(
  macro: MacroChoreography,
  options?: { totalDrones?: number; fps?: number; minSeparation?: number },
): ExpandedShow {
  const totalDrones = options?.totalDrones ?? macro.metadata.num_drones;
  const fps = options?.fps ?? macro.metadata.fps ?? 10;
  const minSep = options?.minSeparation ?? macro.safety?.min_separation_m ?? DEFAULT_MIN_SEP;
  const duration = macro.metadata.duration_seconds;
  const totalFrames = Math.max(1, Math.round(duration * fps));

  const keys = buildPositionKeys(macro, totalDrones);

  // Pre-compute per-drone keyframe segments
  const drones = keys.map((kArr, idx) => {
    if (kArr.length === 0) {
      // Place idle drones in a hidden grid at altitude 10
      const cols = Math.ceil(Math.sqrt(totalDrones));
      const x = (idx % cols) * 2 - cols;
      const z = Math.floor(idx / cols) * 2 - cols;
      kArr = [{ t: 0, x, y: 10, z, r: 80, g: 80, b: 80 }];
    }
    kArr.sort((a, b) => a.t - b.t);
    const frames: DroneFrame[] = [];
    for (let f = 0; f < totalFrames; f++) {
      const t = (f / fps);
      // Find surrounding keys
      let lo = kArr[0];
      let hi = kArr[kArr.length - 1];
      for (let i = 0; i < kArr.length - 1; i++) {
        if (kArr[i].t <= t && kArr[i + 1].t >= t) { lo = kArr[i]; hi = kArr[i + 1]; break; }
      }
      if (t <= kArr[0].t) { lo = hi = kArr[0]; }
      else if (t >= kArr[kArr.length - 1].t) { lo = hi = kArr[kArr.length - 1]; }

      const span = hi.t - lo.t;
      const raw = span > 0 ? (t - lo.t) / span : 0;
      const easing = findTransitionEasing(macro, lo.t, hi.t);
      const u = applyEasing(Math.max(0, Math.min(1, raw)), easing);
      frames.push({
        t,
        x: lo.x + (hi.x - lo.x) * u,
        y: lo.y + (hi.y - lo.y) * u,
        z: lo.z + (hi.z - lo.z) * u,
        r: Math.round(lo.r + (hi.r - lo.r) * u),
        g: Math.round(lo.g + (hi.g - lo.g) * u),
        b: Math.round(lo.b + (hi.b - lo.b) * u),
      });
    }
    return { drone_id: idx, frames };
  });

  // QA: peak speed + collision sample (every 1s, or 5 frames if fps>5)
  const sampleStep = Math.max(1, Math.round(fps));
  let maxSpeed = 0;
  const collisions: ExpandedShow['collisions'] = [];
  for (let f = 1; f < totalFrames; f++) {
    const dt = 1 / fps;
    for (const d of drones) {
      const a = d.frames[f - 1], b = d.frames[f];
      const sp = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / dt;
      if (sp > maxSpeed) maxSpeed = sp;
    }
    if (f % sampleStep !== 0) continue;
    // O(n^2) collision sweep; cap at 400 drones to stay reasonable in browser
    const cap = Math.min(drones.length, 400);
    for (let i = 0; i < cap; i++) {
      for (let j = i + 1; j < cap; j++) {
        const a = drones[i].frames[f], b = drones[j].frames[f];
        const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        if (d < minSep) collisions.push({ t: a.t, a: i, b: j, dist: d });
      }
    }
    if (collisions.length > 50) break; // bound report size
  }

  return { metadata: macro.metadata, drones, collisions, maxSpeedObserved: maxSpeed };
}
