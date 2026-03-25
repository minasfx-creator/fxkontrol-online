/**
 * VVIZ Web Worker — Streaming architecture.
 * Sends each drone individually via postMessage to avoid OOM on main thread.
 *
 * Protocol:
 *   Main → Worker: { type: 'parse', buffer: ArrayBuffer, maxWaypoints?: number }
 *                   OR { type: 'parse', text: string, maxWaypoints?: number } (legacy)
 *   Worker → Main: { type: 'progress', done, total, samples, totalSamples }
 *   Worker → Main: { type: 'drone', pos: Position, traj: Trajectory | null }
 *   Worker → Main: { type: 'complete', projectName, droneCount, duration, errors, stats }
 *   Worker → Main: { type: 'error', message: string }
 */

// ── Types (duplicated to avoid import issues in worker scope) ──────

interface WaypointPos { x: number; y: number; z: number }
interface Waypoint { id: string; position: WaypointPos; time: number }
interface Position {
  id: string; name: string; type: string;
  x: number; y: number; z: number;
  heading: number; pitch: number; roll: number; color: string;
}
interface Trajectory { id: string; positionId: string; name: string; waypoints: Waypoint[] }

interface VVIZTraversalSample { dx: number; dy: number; dz: number; dh?: number; dt?: number }
interface VVIZColorSample { r?: number; g?: number; b?: number; red?: number; green?: number; blue?: number; frames?: number }
interface VVIZLightPayload { id: number; type: string; payloadActions?: VVIZColorSample[] }
interface VVIZPayload { id: number; type: string; payloadActions?: VVIZColorSample[]; eventTime?: number; vdl?: string }

interface VVIZPerformance {
  id: number;
  agentDescription?: {
    homeX: number; homeY: number; homeZ: number; homeH: number;
    agentTraversal?: VVIZTraversalSample[];
  };
  payloadDescription?: VVIZPayload[];
}

interface VVIZFile {
  version: string; defaultPositionRate: number; defaultColorRate?: number;
  timeOffsetSecs?: number; performanceName?: string; coordinateFrame?: string;
  performances?: VVIZPerformance[];
}

// ── Helpers ────────────────────────────────────────────────────────

let _idCounter = 0;
function uid(prefix: string): string {
  return `${prefix}-${++_idCounter}-${(Math.random() * 0xffff) | 0}`;
}

function clamp255(v: number): number { return Math.max(0, Math.min(255, Math.round(v))); }

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [clamp255(r), clamp255(g), clamp255(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

/** Finale 3D VVIZ uses integer 0-255 color values. No float normalization. */
function normColor(value: number | undefined): number {
  if (value === undefined || value === null || !Number.isFinite(value)) return 0;
  return clamp255(Number(value));
}

/**
 * Extract dominant color weighted by frame duration.
 * Colors with more frames (longer display time) win over brief flashes.
 */
function extractColor(payloads: VVIZPayload[]): string {
  let bestR = 0, bestG = 0, bestB = 0, bestWeight = 0;
  for (const p of payloads) {
    if (String(p.type || '').toLowerCase() !== 'light') continue;
    const actions = (p as VVIZLightPayload).payloadActions;
    if (!actions) continue;
    for (const a of actions) {
      const r = normColor(a.r ?? a.red);
      const g = normColor(a.g ?? a.green);
      const b = normColor(a.b ?? a.blue);
      const brightness = r + g + b;
      if (brightness < 10) continue; // skip near-black (off state)
      const frames = Math.max(1, a.frames ?? 1);
      const weight = brightness * frames;
      if (weight > bestWeight) { bestWeight = weight; bestR = r; bestG = g; bestB = b; }
    }
  }
  return bestWeight > 0 ? rgbToHex(bestR, bestG, bestB) : '#00B4D8';
}

// ── Simplification config ──────────────────────────────────────────

interface SimplifyConfig { minTimeStep: number; minDistanceSq: number; maxGap: number }

function getSimplifyConfig(n: number, dt: number): SimplifyConfig {
  if (n >= 20000) return { minTimeStep: Math.max(dt * 8, 0.40), minDistanceSq: 0.09, maxGap: 1.50 };
  if (n >= 12000) return { minTimeStep: Math.max(dt * 6, 0.25), minDistanceSq: 0.04, maxGap: 1.00 };
  if (n >= 4000)  return { minTimeStep: Math.max(dt * 4, 0.15), minDistanceSq: 0.0144, maxGap: 0.80 };
  if (n >= 1500)  return { minTimeStep: Math.max(dt * 2, 0.08), minDistanceSq: 0.0036, maxGap: 0.60 };
  return { minTimeStep: Math.max(dt, 0.03), minDistanceSq: 0.0009, maxGap: 0.50 };
}

const HOME_SKIP_SQ = 0.0001;

function downsample(wp: Waypoint[], limit: number): Waypoint[] {
  if (wp.length <= limit) return wp;
  if (limit <= 2) return [wp[0], wp[wp.length - 1]];
  const out: Waypoint[] = [wp[0]];
  const last = wp.length - 1;
  const step = last / (limit - 1);
  for (let i = 1; i < limit - 1; i++) out.push(wp[Math.min(Math.round(i * step), last - 1)]);
  out.push(wp[last]);
  return out;
}

// ── Process single performance ─────────────────────────────────────

function processPerf(perf: VVIZPerformance, idx: number, rate: number, maxWP: number) {
  const agent = perf.agentDescription;
  if (!agent) return null;

  const home = { x: agent.homeX || 0, y: agent.homeY || 0, z: agent.homeZ || 0, h: agent.homeH || 0 };
  const color = extractColor(perf.payloadDescription || []);
  const posId = uid('vp');

  const pos: Position = {
    id: posId, name: `Drone ${idx + 1}`, type: 'drone-pad',
    x: home.x, y: home.y, z: home.z,
    heading: home.h, pitch: 0, roll: 0, color,
  };

  const samples = agent.agentTraversal;
  if (!samples || samples.length === 0) return { pos, traj: null, maxT: 0, inputSamples: 0, outputWaypoints: 0 };

  const inputSamples = samples.length;
  const defaultDt = 1 / rate;
  const cfg = getSimplifyConfig(inputSamples, defaultDt);

  let x = home.x, y = home.y, z = home.z, h = home.h, t = 0;
  let started = false, lx = home.x, ly = home.y, lz = home.z, lt = 0;
  const waypoints: Waypoint[] = [];

  for (let i = 0; i < inputSamples; i++) {
    const s = samples[i];
    const dt = s.dt ?? defaultDt;
    x += s.dx; y += s.dy; z += s.dz; h += s.dh ?? 0; t += dt;

    if (!started) {
      const dsq = (x - home.x) ** 2 + (y - home.y) ** 2 + (z - home.z) ** 2;
      if (dsq < HOME_SKIP_SQ && i < inputSamples - 1) continue;
      waypoints.push({ id: uid('vw'), position: { x, y, z }, time: t });
      started = true; lx = x; ly = y; lz = z; lt = t;
      continue;
    }

    const dtS = t - lt;
    const mvSq = (x - lx) ** 2 + (y - ly) ** 2 + (z - lz) ** 2;
    const isLast = i === inputSamples - 1;

    if (isLast || dtS >= cfg.maxGap || (dtS >= cfg.minTimeStep && mvSq >= cfg.minDistanceSq)) {
      waypoints.push({ id: uid('vw'), position: { x, y, z }, time: t });
      lx = x; ly = y; lz = z; lt = t;
    }
  }

  const trimmed = downsample(waypoints, maxWP);
  const traj: Trajectory | null = trimmed.length > 0
    ? { id: uid('vt'), positionId: posId, name: `Traj ${idx + 1}`, waypoints: trimmed }
    : null;

  return { pos, traj, maxT: t, inputSamples, outputWaypoints: trimmed.length };
}

// ── Worker message handler ─────────────────────────────────────────

const ctx = self as unknown as Worker;

ctx.onmessage = (e: MessageEvent) => {
  if (e.data?.type !== 'parse') return;

  const maxWP = e.data.maxWaypoints || 1500;

  // Decode input: prefer ArrayBuffer (zero-copy), fallback to string (legacy)
  let jsonText: string;
  try {
    if (e.data.buffer instanceof ArrayBuffer) {
      jsonText = new TextDecoder().decode(e.data.buffer);
      // Release buffer reference
      e.data.buffer = null;
    } else if (typeof e.data.text === 'string') {
      jsonText = e.data.text;
      e.data.text = null;
    } else {
      ctx.postMessage({ type: 'error', message: 'VVIZ: nenhum dado recebido pelo worker.' });
      return;
    }
  } catch {
    ctx.postMessage({ type: 'error', message: 'VVIZ: falha ao decodificar buffer.' });
    return;
  }

  let vviz: VVIZFile;
  try {
    vviz = JSON.parse(jsonText) as VVIZFile;
  } catch {
    ctx.postMessage({ type: 'error', message: 'Arquivo VVIZ inválido — não é JSON válido.' });
    return;
  }

  // Release raw text immediately
  jsonText = null!;

  if (!Array.isArray(vviz.performances) || vviz.performances.length === 0) {
    ctx.postMessage({ type: 'error', message: 'Arquivo VVIZ não contém "performances".' });
    return;
  }

  const perfs = vviz.performances;
  const total = perfs.length;
  const rate = vviz.defaultPositionRate || 2;
  const projectName = vviz.performanceName || 'VVIZ Import';

  // Pre-count samples
  let totalSamples = 0;
  for (let i = 0; i < total; i++) {
    totalSamples += perfs[i]?.agentDescription?.agentTraversal?.length || 0;
  }

  const errors: string[] = [];
  let maxTime = 0, processedSamples = 0, totalWP = 0, simplified = 0, dronesSent = 0;

  for (let i = 0; i < total; i++) {
    try {
      const r = processPerf(perfs[i], i, rate, maxWP);
      if (!r) { errors.push(`Performance ${perfs[i]?.id ?? i}: sem agentDescription`); continue; }
      
      // Stream each drone individually to main thread
      ctx.postMessage({ type: 'drone', pos: r.pos, traj: r.traj });
      dronesSent++;
      
      if (r.maxT > maxTime) maxTime = r.maxT;
      processedSamples += r.inputSamples;
      totalWP += r.outputWaypoints;
      if (r.outputWaypoints < r.inputSamples) simplified++;
    } catch {
      errors.push(`Performance ${perfs[i]?.id ?? i}: falha durante parsing`);
    }

    // Free processed performance data
    (perfs as any)[i] = null;

    // Send progress every 2 drones or at the end
    if (i % 2 === 1 || i === total - 1) {
      ctx.postMessage({ type: 'progress', done: i + 1, total, samples: processedSamples, totalSamples });
    }
  }

  // Release parsed structure
  (vviz as any).performances = null;

  const compressionRatio = totalSamples > 0 ? 1 - (totalWP / totalSamples) : 0;

  if (compressionRatio > 0.35) {
    errors.push(`Otimização aplicada: ${Math.round(compressionRatio * 100)}% menos pontos (${totalSamples.toLocaleString()} → ${totalWP.toLocaleString()}).`);
  }

  // Send completion — no position/trajectory data, just metadata
  ctx.postMessage({
    type: 'complete',
    projectName,
    droneCount: total,
    duration: Math.ceil(maxTime) + 5,
    errors,
    stats: { totalTraversalSamples: totalSamples, totalWaypoints: totalWP, simplifiedTrajectories: simplified, compressionRatio },
  });
};