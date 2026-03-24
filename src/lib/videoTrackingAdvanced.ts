/**
 * Advanced Video Tracking Algorithms
 * 
 * Client-side implementations:
 * 1. Optical Flow (Lucas-Kanade simplified)
 * 2. Kalman Filter per drone
 * 3. Smart Keyframe Detection (histogram chi-squared)
 * 4. Regional Color Extraction (4x4 grid)
 */

// ─── Types ────────────────────────────────────────────────────

export interface FlowVector {
  x: number;
  y: number;
  vx: number;
  vy: number;
  magnitude: number;
}

export interface OpticalFlowField {
  vectors: FlowVector[];
  avgDirection: { vx: number; vy: number };
  avgMagnitude: number;
  width: number;
  height: number;
}

export interface KalmanState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  // Covariance diagonal (simplified)
  P: [number, number, number, number, number, number];
}

export interface RegionalColor {
  row: number;
  col: number;
  color: string; // hex
  r: number;
  g: number;
  b: number;
  saturation: number;
}

export interface RegionalColorMap {
  grid: RegionalColor[][]; // 4x4
  palette: string[]; // top colors
}

export interface KeyframeScore {
  index: number;
  score: number;
  isKeyframe: boolean;
}

// ─── 1. Optical Flow (Lucas-Kanade Simplified) ────────────────

function getPixelGray(data: Uint8ClampedArray, x: number, y: number, w: number): number {
  const i = (y * w + x) * 4;
  return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
}

export function computeOpticalFlow(
  prev: ImageData,
  curr: ImageData,
  gridStep: number = 8,
): OpticalFlowField {
  const w = prev.width;
  const h = prev.height;
  const vectors: FlowVector[] = [];
  const winSize = 5; // 5x5 window
  const halfWin = Math.floor(winSize / 2);

  for (let gy = halfWin + 1; gy < h - halfWin - 1; gy += gridStep) {
    for (let gx = halfWin + 1; gx < w - halfWin - 1; gx += gridStep) {
      // Compute structure tensor components over window
      let sumIxIx = 0, sumIyIy = 0, sumIxIy = 0;
      let sumIxIt = 0, sumIyIt = 0;

      for (let dy = -halfWin; dy <= halfWin; dy++) {
        for (let dx = -halfWin; dx <= halfWin; dx++) {
          const px = gx + dx;
          const py = gy + dy;

          // Spatial gradients (Sobel-like)
          const Ix = (getPixelGray(prev.data, px + 1, py, w) - getPixelGray(prev.data, px - 1, py, w)) * 0.5;
          const Iy = (getPixelGray(prev.data, px, py + 1, w) - getPixelGray(prev.data, px, py - 1, w)) * 0.5;
          // Temporal gradient
          const It = getPixelGray(curr.data, px, py, w) - getPixelGray(prev.data, px, py, w);

          sumIxIx += Ix * Ix;
          sumIyIy += Iy * Iy;
          sumIxIy += Ix * Iy;
          sumIxIt += Ix * It;
          sumIyIt += Iy * It;
        }
      }

      // Solve 2x2 system: [IxIx IxIy; IxIy IyIy] * [vx; vy] = -[IxIt; IyIt]
      const det = sumIxIx * sumIyIy - sumIxIy * sumIxIy;
      if (Math.abs(det) < 1e-6) continue; // Aperture problem — skip

      const vx = -(sumIyIy * sumIxIt - sumIxIy * sumIyIt) / det;
      const vy = -(sumIxIx * sumIyIt - sumIxIy * sumIxIt) / det;
      const magnitude = Math.sqrt(vx * vx + vy * vy);

      // Filter out noise
      if (magnitude > 0.3 && magnitude < 50) {
        vectors.push({ x: gx, y: gy, vx, vy, magnitude });
      }
    }
  }

  // Average direction
  let totalVx = 0, totalVy = 0, totalMag = 0;
  for (const v of vectors) {
    totalVx += v.vx;
    totalVy += v.vy;
    totalMag += v.magnitude;
  }
  const n = vectors.length || 1;

  return {
    vectors,
    avgDirection: { vx: totalVx / n, vy: totalVy / n },
    avgMagnitude: totalMag / n,
    width: w,
    height: h,
  };
}

// ─── 2. Kalman Filter ─────────────────────────────────────────

const PROCESS_NOISE = 0.5;
const MEASUREMENT_NOISE = 2.0;

export function createKalmanState(x: number, y: number, z: number): KalmanState {
  return {
    x, y, z,
    vx: 0, vy: 0, vz: 0,
    P: [10, 10, 10, 10, 10, 10],
  };
}

export function kalmanPredict(state: KalmanState, dt: number = 1): KalmanState {
  return {
    x: state.x + state.vx * dt,
    y: state.y + state.vy * dt,
    z: state.z + state.vz * dt,
    vx: state.vx,
    vy: state.vy,
    vz: state.vz,
    P: [
      state.P[0] + PROCESS_NOISE,
      state.P[1] + PROCESS_NOISE,
      state.P[2] + PROCESS_NOISE,
      state.P[3] + PROCESS_NOISE,
      state.P[4] + PROCESS_NOISE,
      state.P[5] + PROCESS_NOISE,
    ],
  };
}

export function kalmanUpdate(
  state: KalmanState,
  mx: number, my: number, mz: number,
): KalmanState {
  // Kalman gains (simplified scalar per axis)
  const Kx = state.P[0] / (state.P[0] + MEASUREMENT_NOISE);
  const Ky = state.P[1] / (state.P[1] + MEASUREMENT_NOISE);
  const Kz = state.P[2] / (state.P[2] + MEASUREMENT_NOISE);

  const newX = state.x + Kx * (mx - state.x);
  const newY = state.y + Ky * (my - state.y);
  const newZ = state.z + Kz * (mz - state.z);

  return {
    x: newX,
    y: newY,
    z: newZ,
    vx: state.vx + Kx * (mx - state.x) * 0.5,
    vy: state.vy + Ky * (my - state.y) * 0.5,
    vz: state.vz + Kz * (mz - state.z) * 0.5,
    P: [
      (1 - Kx) * state.P[0],
      (1 - Ky) * state.P[1],
      (1 - Kz) * state.P[2],
      state.P[3] * 0.95,
      state.P[4] * 0.95,
      state.P[5] * 0.95,
    ],
  };
}

/**
 * Apply Kalman filtering to a full trajectory
 */
export function kalmanSmoothTrajectory(
  waypoints: { time: number; x: number; y: number; z: number; color: string }[],
): { time: number; x: number; y: number; z: number; color: string }[] {
  if (waypoints.length < 3) return waypoints;

  let state = createKalmanState(waypoints[0].x, waypoints[0].y, waypoints[0].z);
  const result = [waypoints[0]];

  for (let i = 1; i < waypoints.length; i++) {
    const dt = waypoints[i].time - waypoints[i - 1].time;
    state = kalmanPredict(state, dt > 0 ? dt : 1);
    state = kalmanUpdate(state, waypoints[i].x, waypoints[i].y, waypoints[i].z);
    result.push({
      time: waypoints[i].time,
      x: state.x,
      y: state.y,
      z: state.z,
      color: waypoints[i].color,
    });
  }

  return result;
}

// ─── 3. Smart Keyframe Detection ──────────────────────────────

function computeHistogram(imageData: ImageData): Float32Array {
  const hist = new Float32Array(256);
  const { data } = imageData;
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    hist[lum]++;
    total++;
  }
  // Normalize
  if (total > 0) {
    for (let i = 0; i < 256; i++) hist[i] /= total;
  }
  return hist;
}

function chiSquaredDistance(h1: Float32Array, h2: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    const denom = h1[i] + h2[i];
    if (denom > 1e-10) {
      sum += ((h1[i] - h2[i]) ** 2) / denom;
    }
  }
  return sum;
}

export interface SmartKeyframeResult {
  selectedIndices: number[];
  scores: KeyframeScore[];
  threshold: number;
}

export function detectSmartKeyframes(
  frames: { imageData: ImageData }[],
  minKeyframes: number = 5,
  maxKeyframes: number = 30,
): SmartKeyframeResult {
  if (frames.length <= minKeyframes) {
    return {
      selectedIndices: frames.map((_, i) => i),
      scores: frames.map((_, i) => ({ index: i, score: 1, isKeyframe: true })),
      threshold: 0,
    };
  }

  // Compute histograms
  const histograms = frames.map(f => computeHistogram(f.imageData));

  // Compute chi-squared distances between consecutive frames
  const distances: number[] = [0]; // First frame always selected
  for (let i = 1; i < histograms.length; i++) {
    distances.push(chiSquaredDistance(histograms[i - 1], histograms[i]));
  }

  // Adaptive threshold: mean + 1.5 * std
  const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
  const variance = distances.reduce((a, b) => a + (b - mean) ** 2, 0) / distances.length;
  const std = Math.sqrt(variance);
  let adaptiveThreshold = mean + 1.5 * std;

  // Adjust threshold to get reasonable number of keyframes
  let selectedIndices = [0]; // Always include first frame
  for (let i = 1; i < distances.length; i++) {
    if (distances[i] >= adaptiveThreshold) {
      selectedIndices.push(i);
    }
  }
  // Always include last frame
  if (!selectedIndices.includes(frames.length - 1)) {
    selectedIndices.push(frames.length - 1);
  }

  // If too few, lower threshold
  while (selectedIndices.length < minKeyframes && adaptiveThreshold > mean * 0.3) {
    adaptiveThreshold *= 0.7;
    selectedIndices = [0];
    for (let i = 1; i < distances.length; i++) {
      if (distances[i] >= adaptiveThreshold) {
        selectedIndices.push(i);
      }
    }
    if (!selectedIndices.includes(frames.length - 1)) {
      selectedIndices.push(frames.length - 1);
    }
  }

  // If too many, raise threshold
  while (selectedIndices.length > maxKeyframes) {
    adaptiveThreshold *= 1.3;
    selectedIndices = [0];
    for (let i = 1; i < distances.length; i++) {
      if (distances[i] >= adaptiveThreshold) {
        selectedIndices.push(i);
      }
    }
    if (!selectedIndices.includes(frames.length - 1)) {
      selectedIndices.push(frames.length - 1);
    }
  }

  // If still too few, add evenly spaced frames
  if (selectedIndices.length < minKeyframes) {
    const step = Math.floor(frames.length / minKeyframes);
    for (let i = 0; i < frames.length; i += step) {
      if (!selectedIndices.includes(i)) selectedIndices.push(i);
    }
    selectedIndices.sort((a, b) => a - b);
  }

  const scores: KeyframeScore[] = distances.map((d, i) => ({
    index: i,
    score: d,
    isKeyframe: selectedIndices.includes(i),
  }));

  return { selectedIndices, scores, threshold: adaptiveThreshold };
}

// ─── 4. Regional Color Extraction ─────────────────────────────

export function extractRegionalColors(
  imageData: ImageData,
  gridRows: number = 4,
  gridCols: number = 4,
): RegionalColorMap {
  const { data, width, height } = imageData;
  const cellW = Math.floor(width / gridCols);
  const cellH = Math.floor(height / gridRows);

  const grid: RegionalColor[][] = [];

  for (let row = 0; row < gridRows; row++) {
    const rowColors: RegionalColor[] = [];
    for (let col = 0; col < gridCols; col++) {
      const startX = col * cellW;
      const startY = row * cellH;

      // Accumulate colors in cell
      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();

      for (let y = startY; y < Math.min(startY + cellH, height); y += 2) {
        for (let x = startX; x < Math.min(startX + cellW, width); x += 2) {
          const i = (y * width + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2];

          // Quantize to 32-level
          const qr = Math.round(r / 32) * 32;
          const qg = Math.round(g / 32) * 32;
          const qb = Math.round(b / 32) * 32;
          const key = `${qr},${qg},${qb}`;

          const bucket = buckets.get(key);
          if (bucket) {
            bucket.r += r; bucket.g += g; bucket.b += b; bucket.count++;
          } else {
            buckets.set(key, { r, g, b, count: 1 });
          }

          sumR += r; sumG += g; sumB += b; count++;
        }
      }

      // Find most saturated dominant color
      let best: { r: number; g: number; b: number; count: number } | null = null;
      let bestScore = 0;
      for (const bucket of buckets.values()) {
        const avgR = bucket.r / bucket.count;
        const avgG = bucket.g / bucket.count;
        const avgB = bucket.b / bucket.count;
        const max = Math.max(avgR, avgG, avgB);
        const min = Math.min(avgR, avgG, avgB);
        const sat = max > 0 ? (max - min) / max : 0;
        const score = bucket.count * (0.3 + sat * 0.7);
        if (score > bestScore) { bestScore = score; best = bucket; }
      }

      const fr = best ? Math.round(best.r / best.count) : 128;
      const fg = best ? Math.round(best.g / best.count) : 128;
      const fb = best ? Math.round(best.b / best.count) : 128;
      const fmax = Math.max(fr, fg, fb);
      const fmin = Math.min(fr, fg, fb);

      rowColors.push({
        row, col,
        color: `#${fr.toString(16).padStart(2, '0')}${fg.toString(16).padStart(2, '0')}${fb.toString(16).padStart(2, '0')}`,
        r: fr, g: fg, b: fb,
        saturation: fmax > 0 ? (fmax - fmin) / fmax : 0,
      });
    }
    grid.push(rowColors);
  }

  // Extract unique palette (top saturated colors)
  const allColors = grid.flat().sort((a, b) => b.saturation - a.saturation);
  const palette: string[] = [];
  for (const c of allColors) {
    if (palette.length >= 5) break;
    const isDuplicate = palette.some(p => {
      const pr = parseInt(p.slice(1, 3), 16);
      const pg = parseInt(p.slice(3, 5), 16);
      const pb = parseInt(p.slice(5, 7), 16);
      return Math.abs(pr - c.r) + Math.abs(pg - c.g) + Math.abs(pb - c.b) < 60;
    });
    if (!isDuplicate) palette.push(c.color);
  }

  return { grid, palette };
}

/**
 * Interpolate two regional color maps (for smooth color transitions)
 */
export function interpolateRegionalColors(
  a: RegionalColorMap,
  b: RegionalColorMap,
  t: number,
): RegionalColorMap {
  const grid: RegionalColor[][] = [];
  for (let row = 0; row < a.grid.length; row++) {
    const rowColors: RegionalColor[] = [];
    for (let col = 0; col < a.grid[row].length; col++) {
      const ca = a.grid[row][col];
      const cb = b.grid[row][col];
      const r = Math.round(ca.r + (cb.r - ca.r) * t);
      const g = Math.round(ca.g + (cb.g - ca.g) * t);
      const bv = Math.round(ca.b + (cb.b - ca.b) * t);
      rowColors.push({
        row, col,
        color: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bv.toString(16).padStart(2, '0')}`,
        r, g, b: bv,
        saturation: ca.saturation + (cb.saturation - ca.saturation) * t,
      });
    }
    grid.push(rowColors);
  }
  return { grid, palette: t < 0.5 ? a.palette : b.palette };
}

/**
 * Map drone index to regional color based on position
 */
export function getDroneRegionalColor(
  point: { x: number; z: number },
  colorMap: RegionalColorMap,
  radius: number,
): string {
  // Map drone position to grid cell
  const normalizedX = (point.x / radius + 1) / 2; // 0-1
  const normalizedZ = (point.z / radius + 1) / 2; // 0-1
  const col = Math.min(3, Math.max(0, Math.floor(normalizedX * 4)));
  const row = Math.min(3, Math.max(0, Math.floor(normalizedZ * 4)));
  return colorMap.grid[row]?.[col]?.color || '#00E5FF';
}

// ─── Utility: Apply optical flow bias to assignment ───────────

export function applyFlowBiasToAssignment(
  prevPoints: { x: number; y: number; z: number }[],
  currPoints: { x: number; y: number; z: number }[],
  flow: OpticalFlowField | null,
  radius: number,
): { x: number; y: number; z: number }[] {
  if (!flow || flow.vectors.length === 0) return currPoints;

  const n = Math.min(prevPoints.length, currPoints.length);
  const result = new Array(n);
  const used = new Set<number>();

  // Compute average flow direction in world coordinates
  const flowScaleX = (radius * 2) / flow.width;
  const flowScaleZ = (radius * 2) / flow.height;

  for (let i = 0; i < n; i++) {
    const p = prevPoints[i];

    // Find the flow vector nearest to this drone's projection
    const projX = ((p.x / radius + 1) / 2) * flow.width;
    const projY = ((p.z / radius + 1) / 2) * flow.height;

    // Find nearest flow vector
    let nearestFlow: FlowVector | null = null;
    let nearestDist = Infinity;
    for (const v of flow.vectors) {
      const d = (v.x - projX) ** 2 + (v.y - projY) ** 2;
      if (d < nearestDist) { nearestDist = d; nearestFlow = v; }
    }

    // Predicted position based on flow
    const predX = nearestFlow ? p.x + nearestFlow.vx * flowScaleX : p.x;
    const predZ = nearestFlow ? p.z + nearestFlow.vy * flowScaleZ : p.z;

    // Find closest candidate with flow bias
    let bestDist = Infinity;
    let bestIdx = 0;
    for (let j = 0; j < currPoints.length; j++) {
      if (used.has(j)) continue;
      const c = currPoints[j];
      // Distance with flow prediction bias (30% weight)
      const rawDist = (p.x - c.x) ** 2 + (p.z - c.z) ** 2;
      const flowDist = (predX - c.x) ** 2 + (predZ - c.z) ** 2;
      const dist = rawDist * 0.7 + flowDist * 0.3;
      if (dist < bestDist) { bestDist = dist; bestIdx = j; }
    }

    used.add(bestIdx);
    result[i] = currPoints[bestIdx];
  }

  // Append remaining
  for (let j = 0; j < currPoints.length; j++) {
    if (!used.has(j) && result.length < currPoints.length) {
      result.push(currPoints[j]);
    }
  }

  return result;
}
