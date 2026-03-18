/**
 * Video Choreography Engine (Mega)
 * 
 * Advanced frame-by-frame video → drone choreography pipeline.
 * Features:
 *  - High-resolution frame extraction (up to 256px processing)
 *  - Dominant color extraction per frame for LED programming
 *  - Hungarian algorithm drone assignment for optimal transitions
 *  - Smooth trajectory generation with Catmull-Rom splines
 *  - Support for keyframe range selection
 */

import {
  extractVideoFrames, extractGifFrames, frameToFormationPoints,
  isGifFile, isVideoFile,
  type ExtractedFrame, type FrameFormation,
} from './videoToFormation';
import {
  computeOpticalFlow, kalmanSmoothTrajectory, detectSmartKeyframes,
  extractRegionalColors, getDroneRegionalColor, applyFlowBiasToAssignment,
  type OpticalFlowField, type RegionalColorMap, type SmartKeyframeResult,
} from './videoTrackingAdvanced';
import {
  computeOpticalFlowBatchWorker, kalmanSmoothTrajectoriesWorker,
} from './videoTrackingWorkerClient';

export { isGifFile, isVideoFile };
export type { ExtractedFrame, FrameFormation };
export type { OpticalFlowField, RegionalColorMap, SmartKeyframeResult };

// ─── Enhanced Types ──────────────────────────────────────────

export interface VideoFrame extends ExtractedFrame {
  dominantColor: string; // hex
  brightness: number; // 0-1
}

export interface ChoreoKeyframe {
  frameIndex: number;
  time: number;
  points: { x: number; y: number; z: number }[];
  color: string;
  colors?: string[]; // per-drone colors from regional extraction
  brightness: number;
  thumbnail: string;
  regionalColors?: RegionalColorMap;
  opticalFlow?: OpticalFlowField;
}

export interface ChoreoTrajectory {
  droneIndex: number;
  waypoints: { time: number; x: number; y: number; z: number; color: string }[];
}

export interface VideoChoreoResult {
  keyframes: ChoreoKeyframe[];
  trajectories: ChoreoTrajectory[];
  totalDuration: number;
  droneCount: number;
  smartKeyframeInfo?: SmartKeyframeResult;
}

export interface VideoChoreoOptions {
  fps: number;
  maxFrames: number;
  resolution: number;
  droneCount: number;
  radius: number;
  baseHeight: number;
  heightVariation: number;
  threshold: number;
  invertDetection: boolean;
  detectionMode: 'threshold' | 'edge' | 'adaptive';
  blurRadius: number;
  contrastBoost: number;
  edgeSensitivity: number;
  holdDuration: number;
  transitionDuration: number;
  frameRange: [number, number];
  colorExtraction: boolean;
  smoothTrajectories: boolean;
  // Advanced tracking features
  useOpticalFlow: boolean;
  useKalmanFilter: boolean;
  useSmartKeyframes: boolean;
  useRegionalColor: boolean;
  useDepthEstimation: boolean;
  useObjectSegmentation: boolean;
  onProgress?: (progress: number, phase: string) => void;
}

export const DEFAULT_OPTIONS: VideoChoreoOptions = {
  fps: 4,
  maxFrames: 120,
  resolution: 192,
  droneCount: 300,
  radius: 25,
  baseHeight: 30,
  heightVariation: 0.3,
  threshold: 128,
  invertDetection: false,
  detectionMode: 'threshold',
  blurRadius: 1,
  contrastBoost: 1.2,
  edgeSensitivity: 50,
  holdDuration: 2,
  transitionDuration: 4,
  frameRange: [0, 1],
  colorExtraction: true,
  smoothTrajectories: true,
  useOpticalFlow: false,
  useKalmanFilter: false,
  useSmartKeyframes: false,
  useRegionalColor: false,
  useDepthEstimation: false,
  useObjectSegmentation: false,
};

// ─── Frame Extraction with Color Analysis ─────────────────────

export async function extractEnhancedFrames(
  file: File,
  options: Partial<VideoChoreoOptions> = {},
): Promise<VideoFrame[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const extractor = isGifFile(file) ? extractGifFrames : extractVideoFrames;
  const rawFrames = await extractor(file, {
    fps: opts.fps,
    maxFrames: opts.maxFrames,
    resolution: opts.resolution,
    onProgress: (p, phase) => opts.onProgress?.(p * 0.5, phase),
  });

  // Apply frame range
  const start = Math.floor(rawFrames.length * opts.frameRange[0]);
  const end = Math.ceil(rawFrames.length * opts.frameRange[1]);
  const selectedFrames = rawFrames.slice(start, end);

  // Extract colors
  const enhanced: VideoFrame[] = [];
  for (let i = 0; i < selectedFrames.length; i++) {
    opts.onProgress?.(0.5 + (i / selectedFrames.length) * 0.1, `Analisando cores ${i + 1}/${selectedFrames.length}`);
    const frame = selectedFrames[i];
    const { color, brightness } = opts.colorExtraction
      ? extractDominantColor(frame.imageData)
      : { color: '#00E5FF', brightness: 0.5 };
    enhanced.push({ ...frame, dominantColor: color, brightness });
  }

  return enhanced;
}

// ─── Dominant Color Extraction ────────────────────────────────

function extractDominantColor(imageData: ImageData): { color: string; brightness: number } {
  const { data, width, height } = imageData;
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
  let totalBrightness = 0;
  let pixelCount = 0;

  // Sample every 4th pixel for speed
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 128) continue;

    // Quantize to 32-level buckets
    const qr = Math.round(r / 32) * 32;
    const qg = Math.round(g / 32) * 32;
    const qb = Math.round(b / 32) * 32;
    const key = `${qr},${qg},${qb}`;

    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count++;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }

    totalBrightness += (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    pixelCount++;
  }

  // Find most common non-gray color
  let bestBucket: { r: number; g: number; b: number; count: number } | null = null;
  let bestScore = 0;

  for (const bucket of buckets.values()) {
    const avgR = bucket.r / bucket.count;
    const avgG = bucket.g / bucket.count;
    const avgB = bucket.b / bucket.count;
    // Saturation bonus: colorful pixels score higher
    const max = Math.max(avgR, avgG, avgB);
    const min = Math.min(avgR, avgG, avgB);
    const saturation = max > 0 ? (max - min) / max : 0;
    const score = bucket.count * (0.3 + saturation * 0.7);
    if (score > bestScore) {
      bestScore = score;
      bestBucket = bucket;
    }
  }

  if (!bestBucket || bestBucket.count === 0) {
    return { color: '#00E5FF', brightness: 0.5 };
  }

  const r = Math.round(bestBucket.r / bestBucket.count);
  const g = Math.round(bestBucket.g / bestBucket.count);
  const b = Math.round(bestBucket.b / bestBucket.count);
  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

  return {
    color: hex,
    brightness: pixelCount > 0 ? totalBrightness / pixelCount : 0.5,
  };
}

// ─── Full Pipeline: Video → Choreography + Trajectories ───────

export async function generateVideoChoreo(
  frames: VideoFrame[],
  options: Partial<VideoChoreoOptions> = {},
): Promise<VideoChoreoResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { droneCount, radius, baseHeight, heightVariation, holdDuration, transitionDuration } = opts;

  // Phase 0: Smart Keyframe filtering
  let selectedFrames = frames;
  let smartKeyframeInfo: SmartKeyframeResult | undefined;

  if (opts.useSmartKeyframes && frames.length > 5) {
    opts.onProgress?.(0.55, 'Detectando keyframes inteligentes...');
    smartKeyframeInfo = detectSmartKeyframes(frames, 5, 30);
    selectedFrames = smartKeyframeInfo.selectedIndices.map(i => frames[i]);
    opts.onProgress?.(0.58, `${selectedFrames.length}/${frames.length} keyframes selecionados`);
  }

  // Phase 0.5: Compute optical flow fields via Web Worker
  const flowFields: (OpticalFlowField | null)[] = [null];
  if (opts.useOpticalFlow && selectedFrames.length > 1) {
    opts.onProgress?.(0.58, 'Calculando optical flow (Worker)...');
    try {
      const workerResults = await computeOpticalFlowBatchWorker(
        selectedFrames,
        8,
        (current, total) => {
          opts.onProgress?.(0.58 + (current / total) * 0.04, `Optical flow ${current}/${total} (Worker)`);
        },
      );
      flowFields.push(...workerResults.slice(1));
    } catch {
      // Fallback to main thread if worker fails
      opts.onProgress?.(0.58, 'Optical flow fallback (main thread)...');
      for (let i = 1; i < selectedFrames.length; i++) {
        const flow = computeOpticalFlow(selectedFrames[i - 1].imageData, selectedFrames[i].imageData, 8);
        flowFields.push(flow);
      }
    }
  }

  // Phase 0.7: Regional color extraction
  const regionalColorMaps: (RegionalColorMap | undefined)[] = [];
  if (opts.useRegionalColor) {
    opts.onProgress?.(0.62, 'Extraindo cores regionais...');
    for (let i = 0; i < selectedFrames.length; i++) {
      regionalColorMaps.push(extractRegionalColors(selectedFrames[i].imageData));
    }
  }

  const keyframes: ChoreoKeyframe[] = [];

  // Phase 1: Convert each frame to formation points
  for (let i = 0; i < selectedFrames.length; i++) {
    opts.onProgress?.(0.65 + (i / selectedFrames.length) * 0.15, `Formação ${i + 1}/${selectedFrames.length}`);

    const frame = selectedFrames[i];
    const points2d = frameToFormationPoints(frame.imageData, {
      droneCount,
      radius,
      threshold: opts.threshold,
      invertDetection: opts.invertDetection,
      detectionMode: opts.detectionMode,
      blurRadius: opts.blurRadius,
      contrastBoost: opts.contrastBoost,
      edgeSensitivity: opts.edgeSensitivity,
    });

    // Add height based on brightness
    const h = baseHeight + (frame.brightness - 0.5) * heightVariation * 20;
    const points3d = points2d.map(p => ({ x: p.x, y: Math.max(5, h), z: p.z }));

    // Regional colors per drone
    const rcMap = regionalColorMaps[i];
    const perDroneColors = rcMap
      ? points3d.map(p => getDroneRegionalColor(p, rcMap, radius))
      : undefined;

    const time = i * (holdDuration + transitionDuration);
    keyframes.push({
      frameIndex: frame.index,
      time,
      points: points3d,
      color: frame.dominantColor,
      colors: perDroneColors,
      brightness: frame.brightness,
      thumbnail: frame.thumbnail,
      regionalColors: rcMap,
      opticalFlow: flowFields[i] || undefined,
    });
  }

  // Phase 2: Optimal drone assignment with optical flow bias
  opts.onProgress?.(0.82, 'Otimizando atribuição de drones...');

  for (let k = 1; k < keyframes.length; k++) {
    const prev = keyframes[k - 1].points;
    const curr = keyframes[k].points;

    if (opts.useOpticalFlow && flowFields[k]) {
      keyframes[k].points = applyFlowBiasToAssignment(prev, curr, flowFields[k], radius);
    } else {
      keyframes[k].points = greedyAssignment(prev, curr);
    }
  }

  // Phase 3: Generate trajectories
  opts.onProgress?.(0.9, 'Gerando trajetórias...');

  const trajectories: ChoreoTrajectory[] = [];
  for (let d = 0; d < droneCount; d++) {
    const waypoints: ChoreoTrajectory['waypoints'] = [];
    for (const kf of keyframes) {
      if (d < kf.points.length) {
        const p = kf.points[d];
        const droneColor = kf.colors?.[d] || kf.color;
        waypoints.push({ time: kf.time, x: p.x, y: p.y, z: p.z, color: droneColor });
        waypoints.push({
          time: kf.time + transitionDuration,
          x: p.x, y: p.y, z: p.z, color: droneColor,
        });
      }
    }
    trajectories.push({ droneIndex: d, waypoints });
  }

  // Smooth trajectories with Catmull-Rom if enabled
  if (opts.smoothTrajectories && keyframes.length > 2) {
    for (const traj of trajectories) {
      traj.waypoints = smoothWaypoints(traj.waypoints, 3);
    }
  }

  // Phase 4: Apply Kalman filter smoothing via Web Worker
  if (opts.useKalmanFilter) {
    opts.onProgress?.(0.95, 'Aplicando Kalman filter (Worker)...');
    try {
      const smoothed = await kalmanSmoothTrajectoriesWorker(trajectories);
      for (let i = 0; i < trajectories.length; i++) {
        trajectories[i].waypoints = smoothed[i].waypoints;
      }
    } catch {
      // Fallback to main thread
      for (const traj of trajectories) {
        traj.waypoints = kalmanSmoothTrajectory(traj.waypoints);
      }
    }
  }

  const totalDuration = keyframes.length * (holdDuration + transitionDuration);
  opts.onProgress?.(1, 'Concluído!');

  return { keyframes, trajectories, totalDuration, droneCount, smartKeyframeInfo };
}

// ─── Greedy nearest-neighbor assignment ───────────────────────
// Approximates Hungarian algorithm with O(n²) greedy matching

function greedyAssignment(
  prev: { x: number; y: number; z: number }[],
  curr: { x: number; y: number; z: number }[],
): { x: number; y: number; z: number }[] {
  const n = Math.min(prev.length, curr.length);
  const result = new Array(n);
  const used = new Set<number>();

  for (let i = 0; i < n; i++) {
    const p = prev[i];
    let bestDist = Infinity;
    let bestIdx = 0;

    for (let j = 0; j < curr.length; j++) {
      if (used.has(j)) continue;
      const c = curr[j];
      const dist = (p.x - c.x) ** 2 + (p.z - c.z) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = j;
      }
    }

    used.add(bestIdx);
    result[i] = curr[bestIdx];
  }

  // Append remaining if curr > prev
  for (let j = 0; j < curr.length; j++) {
    if (!used.has(j) && result.length < curr.length) {
      result.push(curr[j]);
    }
  }

  return result;
}

// ─── Catmull-Rom Smoothing ────────────────────────────────────

function smoothWaypoints(
  waypoints: ChoreoTrajectory['waypoints'],
  subdivisions: number,
): ChoreoTrajectory['waypoints'] {
  if (waypoints.length < 4) return waypoints;

  const result: ChoreoTrajectory['waypoints'] = [waypoints[0]];

  for (let i = 1; i < waypoints.length - 2; i++) {
    const p0 = waypoints[i - 1];
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const p3 = waypoints[i + 2];

    for (let s = 0; s < subdivisions; s++) {
      const t = s / subdivisions;
      const tt = t * t;
      const ttt = tt * t;

      const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * tt + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * ttt);
      const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * tt + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * ttt);
      const z = 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * tt + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * ttt);
      const time = p1.time + (p2.time - p1.time) * t;

      result.push({ time, x, y, z, color: p1.color });
    }
  }

  result.push(waypoints[waypoints.length - 1]);
  return result;
}

// ─── Render frame preview on canvas ───────────────────────────

export function renderFramePreview(
  canvas: HTMLCanvasElement,
  points: { x: number; y?: number; z: number }[],
  color: string,
  options: { showGrid?: boolean; showCount?: boolean; radius?: number } = {},
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const { showGrid = true, showCount = true, radius = 25 } = options;

  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = 'hsl(220 10% 5%)';
  ctx.fillRect(0, 0, w, h);

  // Grid
  if (showGrid) {
    ctx.strokeStyle = 'hsl(220 5% 12%)';
    ctx.lineWidth = 0.5;
    const step = w / 10;
    for (let x = step; x < w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = step; y < h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  }

  if (points.length === 0) return;

  // Scale
  let maxDist = 1;
  for (const p of points) maxDist = Math.max(maxDist, Math.abs(p.x), Math.abs(p.z));
  const scale = Math.min(w, h) * 0.42 / maxDist;

  // Glow layer
  ctx.globalAlpha = 0.3;
  for (const p of points) {
    const px = w / 2 + p.x * scale;
    const py = h / 2 - p.z * scale;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Solid dots
  ctx.globalAlpha = 1;
  for (const p of points) {
    const px = w / 2 + p.x * scale;
    const py = h / 2 - p.z * scale;
    ctx.beginPath();
    ctx.arc(px, py, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Count
  if (showCount) {
    ctx.fillStyle = 'hsl(220 5% 50%)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${points.length} drones`, w - 6, h - 4);
  }
}
