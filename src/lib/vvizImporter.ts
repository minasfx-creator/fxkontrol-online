/**
 * VVIZ Importer — Parses .vviz (Finale 3D) JSON files into project data.
 * Spec: https://finale3d.com/documentation/vviz-file-format/
 * Coordinate system: X (right), Y (up), Z (into screen) — same as our internal system.
 *
 * Performance-focused for large shows:
 *  - Single-pass traversal decoding (no temporary keyframe arrays)
 *  - Adaptive waypoint simplification for long choreographies
 *  - Async parsing with frequent yields to avoid UI freezes
 */

import type { Position, Trajectory, Waypoint } from '@/store/useProjectStore';

interface VVIZTraversalSample {
  dx: number;
  dy: number;
  dz: number;
  dh?: number;
  dt?: number;
}

interface VVIZColorSample {
  r?: number;
  g?: number;
  b?: number;
  red?: number;
  green?: number;
  blue?: number;
  frames?: number;
}

interface VVIZLightPayload {
  id: number;
  type: 'Light' | string;
  payloadActions?: VVIZColorSample[];
}

interface VVIZPyroPayload {
  id: number;
  type: 'Pyro' | string;
  eventTime: number;
  vdl: string;
  partNumber?: string;
  tilt?: number;
  pan?: number;
}

type VVIZPayload = VVIZLightPayload | VVIZPyroPayload;

interface VVIZPerformance {
  id: number;
  agentDescription?: {
    homeX: number;
    homeY: number;
    homeZ: number;
    homeH: number;
    agentTraversal?: VVIZTraversalSample[];
  };
  payloadDescription?: VVIZPayload[];
}

interface VVIZFile {
  version: string;
  defaultPositionRate: number;
  defaultColorRate?: number;
  timeOffsetSecs?: number;
  performanceName?: string;
  coordinateFrame?: string;
  performances?: VVIZPerformance[];
}

export interface VVIZImportStats {
  totalTraversalSamples: number;
  totalWaypoints: number;
  simplifiedTrajectories: number;
  compressionRatio: number;
}

export interface VVIZImportResult {
  projectName: string;
  droneCount: number;
  duration: number;
  positions: Position[];
  trajectories: Trajectory[];
  errors: string[];
  stats?: VVIZImportStats;
}

let _idCounter = 0;
function uid(prefix: string): string {
  return `${prefix}-${++_idCounter}-${(Math.random() * 0xffff) | 0}`;
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function normalizeColorComponent(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  const v = Number(value);
  if (v >= 0 && v <= 1) return Math.round(v * 255);
  return Math.round(v);
}

/**
 * Extract representative LED color.
 * - Supports both 0..255 and 0..1 component ranges.
 * - Uses weighted average by frames for stable color in long choreographies.
 */
function extractColor(payloads: VVIZPayload[]): string {
  let weightedR = 0;
  let weightedG = 0;
  let weightedB = 0;
  let totalWeight = 0;
  let best = { r: 0, g: 180, b: 216 };
  let bestBrightness = 0;

  for (const payload of payloads) {
    if (String((payload as { type?: string }).type || '').toLowerCase() !== 'light') continue;

    const actions = (payload as VVIZLightPayload).payloadActions || [];
    for (const action of actions) {
      const r = normalizeColorComponent(action.r ?? action.red);
      const g = normalizeColorComponent(action.g ?? action.green);
      const b = normalizeColorComponent(action.b ?? action.blue);
      const brightness = r + g + b;

      if (brightness <= 3) continue;

      const weight = Math.max(1, Math.round(action.frames ?? 1));
      weightedR += r * weight;
      weightedG += g * weight;
      weightedB += b * weight;
      totalWeight += weight;

      if (brightness > bestBrightness) {
        bestBrightness = brightness;
        best = { r, g, b };
      }
    }
  }

  if (totalWeight > 0) {
    return rgbToHex(weightedR / totalWeight, weightedG / totalWeight, weightedB / totalWeight);
  }

  if (bestBrightness > 0) return rgbToHex(best.r, best.g, best.b);
  return '#00B4D8';
}

interface SimplifyConfig {
  minTimeStep: number;
  minDistanceSq: number;
  maxGap: number;
}

function getSimplifyConfig(sampleCount: number, defaultDt: number): SimplifyConfig {
  if (sampleCount >= 12000) {
    return {
      minTimeStep: Math.max(defaultDt * 5, 0.20),
      minDistanceSq: 0.18 * 0.18,
      maxGap: 0.90,
    };
  }
  if (sampleCount >= 4000) {
    return {
      minTimeStep: Math.max(defaultDt * 3, 0.12),
      minDistanceSq: 0.10 * 0.10,
      maxGap: 0.70,
    };
  }
  if (sampleCount >= 1500) {
    return {
      minTimeStep: Math.max(defaultDt * 2, 0.08),
      minDistanceSq: 0.06 * 0.06,
      maxGap: 0.60,
    };
  }
  return {
    minTimeStep: Math.max(defaultDt, 0.02),
    minDistanceSq: 0.02 * 0.02,
    maxGap: 0.45,
  };
}

function downsampleWaypoints(waypoints: Waypoint[], limit: number): Waypoint[] {
  if (waypoints.length <= limit) return waypoints;
  if (limit <= 2) return [waypoints[0], waypoints[waypoints.length - 1]];

  const sampled: Waypoint[] = [waypoints[0]];
  const lastIndex = waypoints.length - 1;
  const step = lastIndex / (limit - 1);
  let prev = 0;

  for (let i = 1; i < limit - 1; i++) {
    let idx = Math.round(i * step);
    if (idx <= prev) idx = prev + 1;
    if (idx >= lastIndex) idx = lastIndex - 1;
    sampled.push(waypoints[idx]);
    prev = idx;
  }

  sampled.push(waypoints[lastIndex]);
  return sampled;
}

interface TraversalBuildResult {
  waypoints: Waypoint[];
  maxT: number;
  inputSamples: number;
  outputWaypoints: number;
  simplified: boolean;
}

const START_HOME_SKIP_SQ = 0.01 * 0.01;
const MAX_WAYPOINTS_PER_TRAJECTORY = 3500;

function buildWaypointsFromTraversal(
  home: { x: number; y: number; z: number; h: number },
  samples: VVIZTraversalSample[],
  defaultRate: number,
): TraversalBuildResult {
  const inputSamples = samples.length;
  if (inputSamples === 0) {
    return { waypoints: [], maxT: 0, inputSamples: 0, outputWaypoints: 0, simplified: false };
  }

  const defaultDt = 1 / defaultRate;
  const simplify = getSimplifyConfig(inputSamples, defaultDt);

  let x = home.x;
  let y = home.y;
  let z = home.z;
  let h = home.h;
  let t = 0;

  let hasStarted = false;
  let lastAcceptedX = home.x;
  let lastAcceptedY = home.y;
  let lastAcceptedZ = home.z;
  let lastAcceptedT = 0;

  const waypoints: Waypoint[] = [];

  for (let i = 0; i < inputSamples; i++) {
    const s = samples[i];
    const dt = s.dt ?? defaultDt;

    x += s.dx;
    y += s.dy;
    z += s.dz;
    h += s.dh ?? 0;
    t += dt;

    if (!hasStarted) {
      const fromHomeSq = (x - home.x) ** 2 + (y - home.y) ** 2 + (z - home.z) ** 2;
      if (fromHomeSq < START_HOME_SKIP_SQ && i < inputSamples - 1) continue;

      waypoints.push({
        id: uid('vw'),
        position: { x, y, z },
        time: t,
      });

      hasStarted = true;
      lastAcceptedX = x;
      lastAcceptedY = y;
      lastAcceptedZ = z;
      lastAcceptedT = t;
      continue;
    }

    const dtSinceLast = t - lastAcceptedT;
    const movedSq = (x - lastAcceptedX) ** 2 + (y - lastAcceptedY) ** 2 + (z - lastAcceptedZ) ** 2;
    const isLast = i === inputSamples - 1;

    if (isLast || dtSinceLast >= simplify.maxGap || (dtSinceLast >= simplify.minTimeStep && movedSq >= simplify.minDistanceSq)) {
      waypoints.push({
        id: uid('vw'),
        position: { x, y, z },
        time: t,
      });

      lastAcceptedX = x;
      lastAcceptedY = y;
      lastAcceptedZ = z;
      lastAcceptedT = t;
    }
  }

  const trimmed = downsampleWaypoints(waypoints, MAX_WAYPOINTS_PER_TRAJECTORY);
  const simplified = trimmed.length < inputSamples;

  return {
    waypoints: trimmed,
    maxT: t,
    inputSamples,
    outputWaypoints: trimmed.length,
    simplified,
  };
}

interface ProcessPerformanceResult {
  pos: Position | null;
  traj: Trajectory | null;
  maxT: number;
  error: string | null;
  inputSamples: number;
  outputWaypoints: number;
  simplified: boolean;
}

function processPerformance(perf: VVIZPerformance, index: number, defaultRate: number): ProcessPerformanceResult {
  const agent = perf.agentDescription;

  if (!agent) {
    return {
      pos: null,
      traj: null,
      maxT: 0,
      error: `Performance ${perf.id}: sem agentDescription`,
      inputSamples: 0,
      outputWaypoints: 0,
      simplified: false,
    };
  }

  const home = {
    x: agent.homeX || 0,
    y: agent.homeY || 0,
    z: agent.homeZ || 0,
    h: agent.homeH || 0,
  };

  const color = extractColor(perf.payloadDescription || []);
  const posId = uid('vp');

  const pos: Position = {
    id: posId,
    name: `Drone ${index + 1}`,
    type: 'drone-pad',
    x: home.x,
    y: home.y,
    z: home.z,
    heading: home.h,
    pitch: 0,
    roll: 0,
    color,
  };

  const traversal = buildWaypointsFromTraversal(home, agent.agentTraversal || [], defaultRate);
  let traj: Trajectory | null = null;

  if (traversal.waypoints.length > 0) {
    traj = {
      id: uid('vt'),
      positionId: posId,
      name: `Traj ${index + 1}`,
      waypoints: traversal.waypoints,
    };
  }

  return {
    pos,
    traj,
    maxT: traversal.maxT,
    error: null,
    inputSamples: traversal.inputSamples,
    outputWaypoints: traversal.outputWaypoints,
    simplified: traversal.simplified,
  };
}

function buildSummaryStats(
  totalTraversalSamples: number,
  totalWaypoints: number,
  simplifiedTrajectories: number,
): VVIZImportStats {
  const compressionRatio = totalTraversalSamples > 0
    ? 1 - (totalWaypoints / totalTraversalSamples)
    : 0;

  return {
    totalTraversalSamples,
    totalWaypoints,
    simplifiedTrajectories,
    compressionRatio,
  };
}

function parseJsonInput(jsonString: string): { vviz: VVIZFile | null; error: string | null } {
  try {
    const parsed = JSON.parse(jsonString) as VVIZFile;
    return { vviz: parsed, error: null };
  } catch {
    return { vviz: null, error: 'Arquivo VVIZ inválido — não é JSON válido.' };
  }
}

function invalidResult(message: string): VVIZImportResult {
  return {
    projectName: 'Import Error',
    droneCount: 0,
    duration: 0,
    positions: [],
    trajectories: [],
    errors: [message],
  };
}

export function importVVIZ(jsonString: string): VVIZImportResult {
  const { vviz, error } = parseJsonInput(jsonString);
  if (!vviz) return invalidResult(error || 'Erro ao ler arquivo VVIZ.');

  if (!Array.isArray(vviz.performances) || vviz.performances.length === 0) {
    return invalidResult('Arquivo VVIZ não contém "performances".');
  }

  const errors: string[] = [];
  const defaultRate = vviz.defaultPositionRate || 2;
  const positions: Position[] = [];
  const trajectories: Trajectory[] = [];

  let maxTime = 0;
  let totalSamples = 0;
  let totalWaypoints = 0;
  let simplifiedTrajectories = 0;

  for (let i = 0; i < vviz.performances.length; i++) {
    try {
      const result = processPerformance(vviz.performances[i], i, defaultRate);
      if (result.error) {
        errors.push(result.error);
        continue;
      }

      if (result.pos) positions.push(result.pos);
      if (result.traj) trajectories.push(result.traj);
      if (result.maxT > maxTime) maxTime = result.maxT;

      totalSamples += result.inputSamples;
      totalWaypoints += result.outputWaypoints;
      if (result.simplified) simplifiedTrajectories += 1;
    } catch {
      errors.push(`Performance ${vviz.performances[i]?.id ?? i}: falha durante parsing`);
    }
  }

  const stats = buildSummaryStats(totalSamples, totalWaypoints, simplifiedTrajectories);

  if (stats.compressionRatio > 0.35) {
    errors.push(
      `Otimização aplicada: ${Math.round(stats.compressionRatio * 100)}% menos pontos para manter fluidez (${stats.totalTraversalSamples.toLocaleString()} → ${stats.totalWaypoints.toLocaleString()}).`,
    );
  }

  return {
    projectName: vviz.performanceName || 'VVIZ Import',
    droneCount: vviz.performances.length,
    duration: Math.ceil(maxTime) + 5,
    positions,
    trajectories,
    errors,
    stats,
  };
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function importVVIZAsync(
  jsonString: string,
  onProgress?: (processedDrones: number, totalDrones: number, processedSamples: number, totalSamples: number) => void,
): Promise<VVIZImportResult> {
  const { vviz, error } = parseJsonInput(jsonString);
  if (!vviz) return invalidResult(error || 'Erro ao ler arquivo VVIZ.');

  if (!Array.isArray(vviz.performances) || vviz.performances.length === 0) {
    return invalidResult('Arquivo VVIZ não contém "performances".');
  }

  const errors: string[] = [];
  const defaultRate = vviz.defaultPositionRate || 2;
  const totalDrones = vviz.performances.length;

  let totalSamples = 0;
  for (let i = 0; i < totalDrones; i++) {
    totalSamples += vviz.performances[i]?.agentDescription?.agentTraversal?.length || 0;
  }

  const positions: Position[] = [];
  const trajectories: Trajectory[] = [];

  let maxTime = 0;
  let processedSamples = 0;
  let parsedWaypoints = 0;
  let simplifiedTrajectories = 0;
  let lastYieldTs = performance.now();

  for (let i = 0; i < totalDrones; i++) {
    try {
      const result = processPerformance(vviz.performances[i], i, defaultRate);
      if (result.error) {
        errors.push(result.error);
      } else {
        if (result.pos) positions.push(result.pos);
        if (result.traj) trajectories.push(result.traj);
        if (result.maxT > maxTime) maxTime = result.maxT;
      }

      processedSamples += result.inputSamples;
      parsedWaypoints += result.outputWaypoints;
      if (result.simplified) simplifiedTrajectories += 1;
    } catch {
      errors.push(`Performance ${vviz.performances[i]?.id ?? i}: falha durante parsing`);
    }

    onProgress?.(i + 1, totalDrones, processedSamples, totalSamples);

    const now = performance.now();
    if (i < totalDrones - 1 && (now - lastYieldTs > 12 || i % 3 === 2)) {
      await yieldToMain();
      lastYieldTs = performance.now();
    }
  }

  const stats = buildSummaryStats(totalSamples, parsedWaypoints, simplifiedTrajectories);

  if (stats.compressionRatio > 0.35) {
    errors.push(
      `Otimização aplicada: ${Math.round(stats.compressionRatio * 100)}% menos pontos para manter fluidez (${stats.totalTraversalSamples.toLocaleString()} → ${stats.totalWaypoints.toLocaleString()}).`,
    );
  }

  return {
    projectName: vviz.performanceName || 'VVIZ Import',
    droneCount: totalDrones,
    duration: Math.ceil(maxTime) + 5,
    positions,
    trajectories,
    errors,
    stats,
  };
}
