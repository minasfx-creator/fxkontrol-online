/**
 * VVIZ Importer — Parses .vviz (Finale 3D) JSON files into project data.
 * Spec: https://finale3d.com/documentation/vviz-file-format/
 *
 * Memory-optimized for large shows (300+ drones, 10+ min):
 *  - Releases raw JSON string before processing
 *  - Nulls out processed performance data progressively
 *  - Aggressive adaptive waypoint simplification
 *  - Async parsing with yields to avoid UI freezes
 */

import type { Position, Trajectory, Waypoint } from '@/store/useProjectStore';

// ── Types ──────────────────────────────────────────────────────────

interface VVIZTraversalSample {
  dx: number;
  dy: number;
  dz: number;
  dh?: number;
  dt?: number;
}

interface VVIZColorSample {
  r?: number; g?: number; b?: number;
  red?: number; green?: number; blue?: number;
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

// ── Helpers ────────────────────────────────────────────────────────

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

// ── Color Extraction ───────────────────────────────────────────────

function extractColor(payloads: VVIZPayload[]): string {
  let bestR = 0, bestG = 180, bestB = 216;
  let bestBrightness = 0;

  for (const payload of payloads) {
    if (String((payload as { type?: string }).type || '').toLowerCase() !== 'light') continue;
    const actions = (payload as VVIZLightPayload).payloadActions;
    if (!actions) continue;

    for (const action of actions) {
      const r = normalizeColorComponent(action.r ?? action.red);
      const g = normalizeColorComponent(action.g ?? action.green);
      const b = normalizeColorComponent(action.b ?? action.blue);
      const brightness = r + g + b;
      if (brightness > bestBrightness) {
        bestBrightness = brightness;
        bestR = r; bestG = g; bestB = b;
      }
    }
  }

  return bestBrightness > 0 ? rgbToHex(bestR, bestG, bestB) : '#00B4D8';
}

// ── Waypoint Simplification ────────────────────────────────────────

interface SimplifyConfig {
  minTimeStep: number;
  minDistanceSq: number;
  maxGap: number;
}

function getSimplifyConfig(sampleCount: number, defaultDt: number): SimplifyConfig {
  // Ultra-aggressive for huge files to prevent OOM
  if (sampleCount >= 20000) {
    return { minTimeStep: Math.max(defaultDt * 8, 0.40), minDistanceSq: 0.30 * 0.30, maxGap: 1.50 };
  }
  if (sampleCount >= 12000) {
    return { minTimeStep: Math.max(defaultDt * 6, 0.25), minDistanceSq: 0.20 * 0.20, maxGap: 1.00 };
  }
  if (sampleCount >= 4000) {
    return { minTimeStep: Math.max(defaultDt * 4, 0.15), minDistanceSq: 0.12 * 0.12, maxGap: 0.80 };
  }
  if (sampleCount >= 1500) {
    return { minTimeStep: Math.max(defaultDt * 2, 0.08), minDistanceSq: 0.06 * 0.06, maxGap: 0.60 };
  }
  return { minTimeStep: Math.max(defaultDt, 0.03), minDistanceSq: 0.03 * 0.03, maxGap: 0.50 };
}

// Hard cap per trajectory to control memory
const MAX_WAYPOINTS_PER_TRAJECTORY = 1500;
const START_HOME_SKIP_SQ = 0.01 * 0.01;

function downsampleWaypoints(waypoints: Waypoint[], limit: number): Waypoint[] {
  if (waypoints.length <= limit) return waypoints;
  if (limit <= 2) return [waypoints[0], waypoints[waypoints.length - 1]];

  const sampled: Waypoint[] = [waypoints[0]];
  const lastIndex = waypoints.length - 1;
  const step = lastIndex / (limit - 1);

  for (let i = 1; i < limit - 1; i++) {
    const idx = Math.min(Math.round(i * step), lastIndex - 1);
    sampled.push(waypoints[idx]);
  }
  sampled.push(waypoints[lastIndex]);
  return sampled;
}

// ── Core Processing ────────────────────────────────────────────────

interface ProcessResult {
  pos: Position | null;
  traj: Trajectory | null;
  maxT: number;
  error: string | null;
  inputSamples: number;
  outputWaypoints: number;
  simplified: boolean;
}

function processPerformance(perf: VVIZPerformance, index: number, defaultRate: number): ProcessResult {
  const agent = perf.agentDescription;
  if (!agent) {
    return { pos: null, traj: null, maxT: 0, error: `Performance ${perf.id}: sem agentDescription`, inputSamples: 0, outputWaypoints: 0, simplified: false };
  }

  const home = { x: agent.homeX || 0, y: agent.homeY || 0, z: agent.homeZ || 0, h: agent.homeH || 0 };
  const color = extractColor(perf.payloadDescription || []);
  const posId = uid('vp');

  const pos: Position = {
    id: posId, name: `Drone ${index + 1}`, type: 'drone-pad',
    x: home.x, y: home.y, z: home.z,
    heading: home.h, pitch: 0, roll: 0, color,
  };

  const samples = agent.agentTraversal;
  if (!samples || samples.length === 0) {
    return { pos, traj: null, maxT: 0, error: null, inputSamples: 0, outputWaypoints: 0, simplified: false };
  }

  const inputSamples = samples.length;
  const defaultDt = 1 / defaultRate;
  const simplify = getSimplifyConfig(inputSamples, defaultDt);

  let x = home.x, y = home.y, z = home.z, h = home.h, t = 0;
  let hasStarted = false;
  let lastX = home.x, lastY = home.y, lastZ = home.z, lastT = 0;

  const waypoints: Waypoint[] = [];

  for (let i = 0; i < inputSamples; i++) {
    const s = samples[i];
    const dt = s.dt ?? defaultDt;
    x += s.dx; y += s.dy; z += s.dz; h += s.dh ?? 0; t += dt;

    if (!hasStarted) {
      const fromHomeSq = (x - home.x) ** 2 + (y - home.y) ** 2 + (z - home.z) ** 2;
      if (fromHomeSq < START_HOME_SKIP_SQ && i < inputSamples - 1) continue;
      waypoints.push({ id: uid('vw'), position: { x, y, z }, time: t });
      hasStarted = true; lastX = x; lastY = y; lastZ = z; lastT = t;
      continue;
    }

    const dtSince = t - lastT;
    const movedSq = (x - lastX) ** 2 + (y - lastY) ** 2 + (z - lastZ) ** 2;
    const isLast = i === inputSamples - 1;

    if (isLast || dtSince >= simplify.maxGap || (dtSince >= simplify.minTimeStep && movedSq >= simplify.minDistanceSq)) {
      waypoints.push({ id: uid('vw'), position: { x, y, z }, time: t });
      lastX = x; lastY = y; lastZ = z; lastT = t;
    }
  }

  const trimmed = downsampleWaypoints(waypoints, MAX_WAYPOINTS_PER_TRAJECTORY);

  let traj: Trajectory | null = null;
  if (trimmed.length > 0) {
    traj = { id: uid('vt'), positionId: posId, name: `Traj ${index + 1}`, waypoints: trimmed };
  }

  return {
    pos, traj, maxT: t, error: null,
    inputSamples, outputWaypoints: trimmed.length, simplified: trimmed.length < inputSamples,
  };
}

// ── Public API ─────────────────────────────────────────────────────

function invalidResult(message: string): VVIZImportResult {
  return { projectName: 'Import Error', droneCount: 0, duration: 0, positions: [], trajectories: [], errors: [message] };
}

export function importVVIZ(jsonString: string): VVIZImportResult {
  let vviz: VVIZFile;
  try {
    vviz = JSON.parse(jsonString) as VVIZFile;
  } catch {
    return invalidResult('Arquivo VVIZ inválido — não é JSON válido.');
  }

  if (!Array.isArray(vviz.performances) || vviz.performances.length === 0) {
    return invalidResult('Arquivo VVIZ não contém "performances".');
  }

  const errors: string[] = [];
  const defaultRate = vviz.defaultPositionRate || 2;
  const positions: Position[] = [];
  const trajectories: Trajectory[] = [];
  let maxTime = 0, totalSamples = 0, totalWaypoints = 0, simplifiedCount = 0;

  for (let i = 0; i < vviz.performances.length; i++) {
    try {
      const result = processPerformance(vviz.performances[i], i, defaultRate);
      if (result.error) { errors.push(result.error); continue; }
      if (result.pos) positions.push(result.pos);
      if (result.traj) trajectories.push(result.traj);
      if (result.maxT > maxTime) maxTime = result.maxT;
      totalSamples += result.inputSamples;
      totalWaypoints += result.outputWaypoints;
      if (result.simplified) simplifiedCount++;
    } catch {
      errors.push(`Performance ${vviz.performances[i]?.id ?? i}: falha durante parsing`);
    }
  }

  const compressionRatio = totalSamples > 0 ? 1 - (totalWaypoints / totalSamples) : 0;

  return {
    projectName: vviz.performanceName || 'VVIZ Import',
    droneCount: vviz.performances.length,
    duration: Math.ceil(maxTime) + 5,
    positions, trajectories, errors,
    stats: { totalTraversalSamples: totalSamples, totalWaypoints, simplifiedTrajectories: simplifiedCount, compressionRatio },
  };
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Memory-optimized async VVIZ import.
 * Key strategy: parse JSON once, then null-out each performance after processing
 * so the GC can reclaim memory progressively.
 */
export async function importVVIZAsync(
  jsonString: string,
  onProgress?: (processedDrones: number, totalDrones: number, processedSamples: number, totalSamples: number) => void,
): Promise<VVIZImportResult> {
  // Step 1: Parse JSON — after this, jsonString can be GC'd by the caller
  let vviz: VVIZFile;
  try {
    vviz = JSON.parse(jsonString) as VVIZFile;
  } catch {
    return invalidResult('Arquivo VVIZ inválido — não é JSON válido.');
  }

  if (!Array.isArray(vviz.performances) || vviz.performances.length === 0) {
    return invalidResult('Arquivo VVIZ não contém "performances".');
  }

  const errors: string[] = [];
  const defaultRate = vviz.defaultPositionRate || 2;
  const totalDrones = vviz.performances.length;
  const perfs = vviz.performances;

  // Pre-count total samples for progress (lightweight pass)
  let totalSamples = 0;
  for (let i = 0; i < totalDrones; i++) {
    totalSamples += perfs[i]?.agentDescription?.agentTraversal?.length || 0;
  }

  const positions: Position[] = [];
  const trajectories: Trajectory[] = [];
  let maxTime = 0, processedSamples = 0, parsedWaypoints = 0, simplifiedCount = 0;
  let lastYieldTs = performance.now();

  for (let i = 0; i < totalDrones; i++) {
    try {
      const result = processPerformance(perfs[i], i, defaultRate);
      if (result.error) {
        errors.push(result.error);
      } else {
        if (result.pos) positions.push(result.pos);
        if (result.traj) trajectories.push(result.traj);
        if (result.maxT > maxTime) maxTime = result.maxT;
      }
      processedSamples += result.inputSamples;
      parsedWaypoints += result.outputWaypoints;
      if (result.simplified) simplifiedCount++;
    } catch {
      errors.push(`Performance ${perfs[i]?.id ?? i}: falha durante parsing`);
    }

    // ★ KEY: Null out processed performance to free its traversal data
    (perfs as any)[i] = null;

    onProgress?.(i + 1, totalDrones, processedSamples, totalSamples);

    // Yield to main thread periodically
    const now = performance.now();
    if (i < totalDrones - 1 && (now - lastYieldTs > 8 || i % 2 === 1)) {
      await yieldToMain();
      lastYieldTs = performance.now();
    }
  }

  // Release the parsed JSON structure
  (vviz as any).performances = null;

  const compressionRatio = totalSamples > 0 ? 1 - (parsedWaypoints / totalSamples) : 0;

  if (compressionRatio > 0.35) {
    errors.push(
      `Otimização aplicada: ${Math.round(compressionRatio * 100)}% menos pontos (${totalSamples.toLocaleString()} → ${parsedWaypoints.toLocaleString()}).`,
    );
  }

  return {
    projectName: vviz.performanceName || 'VVIZ Import',
    droneCount: totalDrones,
    duration: Math.ceil(maxTime) + 5,
    positions, trajectories, errors,
    stats: { totalTraversalSamples: totalSamples, totalWaypoints: parsedWaypoints, simplifiedTrajectories: simplifiedCount, compressionRatio },
  };
}
