/**
 * VVIZ Importer — Parses .vviz (Finale 3D) JSON files into project data.
 * Spec: https://finale3d.com/documentation/vviz-file-format/
 * Coordinate system: X (right), Y (up), Z (into screen) — same as our internal system.
 */

import type { Position, Trajectory, Waypoint, DroneFormation } from '@/store/useProjectStore';

interface VVIZTraversalSample {
  dx: number;
  dy: number;
  dz: number;
  dh?: number;
  dt?: number;
}

interface VVIZColorSample {
  r: number;
  g: number;
  b: number;
  frames?: number;
}

interface VVIZLightPayload {
  id: number;
  type: 'Light';
  payloadActions: VVIZColorSample[];
}

interface VVIZPyroPayload {
  id: number;
  type: 'Pyro';
  eventTime: number;
  vdl: string;
  partNumber?: string;
  tilt?: number;
  pan?: number;
}

type VVIZPayload = VVIZLightPayload | VVIZPyroPayload;

interface VVIZPerformance {
  id: number;
  agentDescription: {
    homeX: number;
    homeY: number;
    homeZ: number;
    homeH: number;
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

export interface VVIZImportResult {
  projectName: string;
  droneCount: number;
  duration: number;
  positions: Position[];
  trajectories: Trajectory[];
  errors: string[];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Reconstruct absolute keyframes from delta-based traversal samples.
 */
function resolveTraversal(
  home: { x: number; y: number; z: number; h: number },
  samples: VVIZTraversalSample[],
  defaultRate: number,
): { t: number; x: number; y: number; z: number; h: number }[] {
  const keyframes: { t: number; x: number; y: number; z: number; h: number }[] = [];
  let x = home.x, y = home.y, z = home.z, h = home.h;
  let t = 0;
  const defaultDt = 1 / defaultRate;

  for (const sample of samples) {
    const dt = sample.dt ?? defaultDt;
    x += sample.dx;
    y += sample.dy;
    z += sample.dz;
    h += sample.dh ?? 0;
    t += dt;
    keyframes.push({ t, x, y, z, h });
  }

  return keyframes;
}

/**
 * Extract the dominant color from a Light payload.
 */
function extractColor(payloads: VVIZPayload[]): string {
  for (const p of payloads) {
    if (p.type === 'Light') {
      const actions = (p as VVIZLightPayload).payloadActions;
      // Find brightest color
      let best = { r: 0, g: 180, b: 216 }; // default cyan
      let maxBrightness = 0;
      for (const a of actions) {
        const brightness = a.r + a.g + a.b;
        if (brightness > maxBrightness) {
          maxBrightness = brightness;
          best = a;
        }
      }
      if (maxBrightness > 0) return rgbToHex(best.r, best.g, best.b);
    }
  }
  return '#00B4D8';
}

/**
 * Parse a VVIZ JSON string and convert to project-compatible data.
 */
export function importVVIZ(jsonString: string): VVIZImportResult {
  const errors: string[] = [];
  let vviz: VVIZFile;

  try {
    vviz = JSON.parse(jsonString);
  } catch {
    return {
      projectName: 'Import Error',
      droneCount: 0,
      duration: 0,
      positions: [],
      trajectories: [],
      errors: ['Arquivo VVIZ inválido — não é um JSON válido.'],
    };
  }

  if (!vviz.performances || !Array.isArray(vviz.performances)) {
    return {
      projectName: 'Import Error',
      droneCount: 0,
      duration: 0,
      positions: [],
      trajectories: [],
      errors: ['Arquivo VVIZ não contém "performances".'],
    };
  }

  const defaultRate = vviz.defaultPositionRate || 2;
  const projectName = vviz.performanceName || 'VVIZ Import';
  const positions: Position[] = [];
  const trajectories: Trajectory[] = [];
  let maxTime = 0;

  for (let i = 0; i < vviz.performances.length; i++) {
    const perf = vviz.performances[i];
    const agent = perf.agentDescription;

    if (!agent) {
      errors.push(`Performance ${perf.id}: sem agentDescription`);
      continue;
    }

    const home = {
      x: agent.homeX || 0,
      y: agent.homeY || 0,
      z: agent.homeZ || 0,
      h: agent.homeH || 0,
    };

    const color = extractColor(perf.payloadDescription || []);

    // Create drone pad position
    const posId = `vviz-pos-${Date.now()}-${i}`;
    positions.push({
      id: posId,
      name: `Drone ${i + 1}`,
      type: 'drone-pad',
      x: home.x,
      y: home.y,
      z: home.z,
      heading: home.h,
      pitch: 0,
      roll: 0,
      color,
    });

    // Resolve trajectory
    const keyframes = resolveTraversal(home, agent.agentTraversal || [], defaultRate);

    if (keyframes.length > 0) {
      const lastT = keyframes[keyframes.length - 1].t;
      if (lastT > maxTime) maxTime = lastT;

      // Convert to waypoints (skip stationary points at home to reduce clutter)
      const waypoints: Waypoint[] = [];
      for (const kf of keyframes) {
        // Skip if essentially same position as home (launch/land)
        const distFromHome = Math.sqrt(
          (kf.x - home.x) ** 2 + (kf.y - home.y) ** 2 + (kf.z - home.z) ** 2
        );
        if (distFromHome < 0.01 && waypoints.length === 0) continue;

        waypoints.push({
          id: `vviz-wp-${Date.now()}-${i}-${waypoints.length}`,
          position: { x: kf.x, y: kf.y, z: kf.z },
          time: kf.t,
        });
      }

      if (waypoints.length > 0) {
        trajectories.push({
          id: `vviz-traj-${Date.now()}-${i}`,
          positionId: posId,
          name: `Traj ${i + 1}`,
          waypoints,
        });
      }
    }
  }

  return {
    projectName,
    droneCount: vviz.performances.length,
    duration: Math.ceil(maxTime) + 5,
    positions,
    trajectories,
    errors,
  };
}
