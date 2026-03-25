/**
 * VVIZ Importer — Parses .vviz (Finale 3D) JSON files into project data.
 * Spec: https://finale3d.com/documentation/vviz-file-format/
 * Coordinate system: X (right), Y (up), Z (into screen) — same as our internal system.
 *
 * Optimised for 300+ drone files:
 *  - Uses counter-based IDs (no Date.now() collisions)
 *  - Provides chunked async API with progress callback
 */

import type { Position, Trajectory, Waypoint } from '@/store/useProjectStore';

// ── VVIZ types ──────────────────────────────────────────────

interface VVIZTraversalSample {
  dx: number; dy: number; dz: number; dh?: number; dt?: number;
}

interface VVIZColorSample { r: number; g: number; b: number; frames?: number; }

interface VVIZLightPayload {
  id: number; type: 'Light'; payloadActions: VVIZColorSample[];
}

interface VVIZPyroPayload {
  id: number; type: 'Pyro'; eventTime: number; vdl: string;
  partNumber?: string; tilt?: number; pan?: number;
}

type VVIZPayload = VVIZLightPayload | VVIZPyroPayload;

interface VVIZPerformance {
  id: number;
  agentDescription: {
    homeX: number; homeY: number; homeZ: number; homeH: number;
    agentTraversal: VVIZTraversalSample[];
  };
  payloadDescription: VVIZPayload[];
}

interface VVIZFile {
  version: string;
  defaultPositionRate: number;
  defaultColorRate?: number;
  timeOffsetSecs?: number;
  performanceName?: string;
  coordinateFrame?: string;
  performances: VVIZPerformance[];
}

// ── Result type ─────────────────────────────────────────────

export interface VVIZImportResult {
  projectName: string;
  droneCount: number;
  duration: number;
  positions: Position[];
  trajectories: Trajectory[];
  errors: string[];
}

// ── Helpers ─────────────────────────────────────────────────

let _idCounter = 0;
function uid(prefix: string): string {
  return `${prefix}-${++_idCounter}-${(Math.random() * 0xffff) | 0}`;
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function resolveTraversal(
  home: { x: number; y: number; z: number; h: number },
  samples: VVIZTraversalSample[],
  defaultRate: number,
): { t: number; x: number; y: number; z: number; h: number }[] {
  const keyframes: { t: number; x: number; y: number; z: number; h: number }[] = [];
  let x = home.x, y = home.y, z = home.z, h = home.h;
  let t = 0;
  const defaultDt = 1 / defaultRate;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const dt = s.dt ?? defaultDt;
    x += s.dx; y += s.dy; z += s.dz; h += s.dh ?? 0;
    t += dt;
    keyframes.push({ t, x, y, z, h });
  }
  return keyframes;
}

function extractColor(payloads: VVIZPayload[]): string {
  for (const p of payloads) {
    if (p.type === 'Light') {
      const actions = (p as VVIZLightPayload).payloadActions;
      let best = { r: 0, g: 180, b: 216 };
      let maxB = 0;
      for (const a of actions) {
        const b = a.r + a.g + a.b;
        if (b > maxB) { maxB = b; best = a; }
      }
      if (maxB > 0) return rgbToHex(best.r, best.g, best.b);
    }
  }
  return '#00B4D8';
}

// ── Process a single performance ────────────────────────────

function processPerformance(
  perf: VVIZPerformance,
  index: number,
  defaultRate: number,
): { pos: Position; traj: Trajectory | null; maxT: number; error: string | null } {
  const agent = perf.agentDescription;

  if (!agent) {
    return { pos: null as any, traj: null, maxT: 0, error: `Performance ${perf.id}: sem agentDescription` };
  }

  const home = {
    x: agent.homeX || 0, y: agent.homeY || 0,
    z: agent.homeZ || 0, h: agent.homeH || 0,
  };

  const color = extractColor(perf.payloadDescription || []);
  const posId = uid('vp');

  const pos: Position = {
    id: posId,
    name: `Drone ${index + 1}`,
    type: 'drone-pad',
    x: home.x, y: home.y, z: home.z,
    heading: home.h, pitch: 0, roll: 0,
    color,
  };

  const keyframes = resolveTraversal(home, agent.agentTraversal || [], defaultRate);
  let traj: Trajectory | null = null;
  let maxT = 0;

  if (keyframes.length > 0) {
    maxT = keyframes[keyframes.length - 1].t;

    const waypoints: Waypoint[] = [];
    for (const kf of keyframes) {
      const dist = Math.sqrt(
        (kf.x - home.x) ** 2 + (kf.y - home.y) ** 2 + (kf.z - home.z) ** 2,
      );
      if (dist < 0.01 && waypoints.length === 0) continue;

      waypoints.push({
        id: uid('vw'),
        position: { x: kf.x, y: kf.y, z: kf.z },
        time: kf.t,
      });
    }

    if (waypoints.length > 0) {
      traj = {
        id: uid('vt'),
        positionId: posId,
        name: `Traj ${index + 1}`,
        waypoints,
      };
    }
  }

  return { pos, traj, maxT, error: null };
}

// ── Synchronous full parse (kept for small files) ───────────

export function importVVIZ(jsonString: string): VVIZImportResult {
  const errors: string[] = [];
  let vviz: VVIZFile;

  try { vviz = JSON.parse(jsonString); } catch {
    return { projectName: 'Import Error', droneCount: 0, duration: 0, positions: [], trajectories: [], errors: ['Arquivo VVIZ inválido — não é JSON válido.'] };
  }

  if (!vviz.performances?.length) {
    return { projectName: 'Import Error', droneCount: 0, duration: 0, positions: [], trajectories: [], errors: ['Arquivo VVIZ não contém "performances".'] };
  }

  const defaultRate = vviz.defaultPositionRate || 2;
  const positions: Position[] = [];
  const trajectories: Trajectory[] = [];
  let maxTime = 0;

  for (let i = 0; i < vviz.performances.length; i++) {
    const r = processPerformance(vviz.performances[i], i, defaultRate);
    if (r.error) { errors.push(r.error); continue; }
    positions.push(r.pos);
    if (r.traj) trajectories.push(r.traj);
    if (r.maxT > maxTime) maxTime = r.maxT;
  }

  return {
    projectName: vviz.performanceName || 'VVIZ Import',
    droneCount: vviz.performances.length,
    duration: Math.ceil(maxTime) + 5,
    positions, trajectories, errors,
  };
}

// ── Async chunked parse with progress (for 100+ drones) ─────

const CHUNK_SIZE = 40; // drones per microtask

export async function importVVIZAsync(
  jsonString: string,
  onProgress?: (processed: number, total: number) => void,
): Promise<VVIZImportResult> {
  const errors: string[] = [];
  let vviz: VVIZFile;

  try { vviz = JSON.parse(jsonString); } catch {
    return { projectName: 'Import Error', droneCount: 0, duration: 0, positions: [], trajectories: [], errors: ['Arquivo VVIZ inválido — não é JSON válido.'] };
  }

  if (!vviz.performances?.length) {
    return { projectName: 'Import Error', droneCount: 0, duration: 0, positions: [], trajectories: [], errors: ['Arquivo VVIZ não contém "performances".'] };
  }

  const defaultRate = vviz.defaultPositionRate || 2;
  const total = vviz.performances.length;
  const positions: Position[] = [];
  const trajectories: Trajectory[] = [];
  let maxTime = 0;

  for (let start = 0; start < total; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE, total);

    for (let i = start; i < end; i++) {
      const r = processPerformance(vviz.performances[i], i, defaultRate);
      if (r.error) { errors.push(r.error); continue; }
      positions.push(r.pos);
      if (r.traj) trajectories.push(r.traj);
      if (r.maxT > maxTime) maxTime = r.maxT;
    }

    onProgress?.(end, total);

    // Yield to the event loop so UI can repaint between chunks
    if (end < total) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }

  return {
    projectName: vviz.performanceName || 'VVIZ Import',
    droneCount: total,
    duration: Math.ceil(maxTime) + 5,
    positions, trajectories, errors,
  };
}
