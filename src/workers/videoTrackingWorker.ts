/**
 * Web Worker for Optical Flow + Kalman Filter
 * Offloads heavy computation to avoid blocking UI.
 */

// ─── Optical Flow (Lucas-Kanade) ──────────────────────────────

interface FlowVector {
  x: number; y: number; vx: number; vy: number; magnitude: number;
}

interface OpticalFlowField {
  vectors: FlowVector[];
  avgDirection: { vx: number; vy: number };
  avgMagnitude: number;
  width: number; height: number;
}

function getPixelGray(data: Uint8ClampedArray, x: number, y: number, w: number): number {
  const i = (y * w + x) * 4;
  return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
}

function computeOpticalFlow(
  prevData: Uint8ClampedArray, currData: Uint8ClampedArray,
  w: number, h: number, gridStep: number = 8,
): OpticalFlowField {
  const vectors: FlowVector[] = [];
  const winSize = 5;
  const halfWin = Math.floor(winSize / 2);

  for (let gy = halfWin + 1; gy < h - halfWin - 1; gy += gridStep) {
    for (let gx = halfWin + 1; gx < w - halfWin - 1; gx += gridStep) {
      let sumIxIx = 0, sumIyIy = 0, sumIxIy = 0, sumIxIt = 0, sumIyIt = 0;

      for (let dy = -halfWin; dy <= halfWin; dy++) {
        for (let dx = -halfWin; dx <= halfWin; dx++) {
          const px = gx + dx, py = gy + dy;
          const Ix = (getPixelGray(prevData, px + 1, py, w) - getPixelGray(prevData, px - 1, py, w)) * 0.5;
          const Iy = (getPixelGray(prevData, px, py + 1, w) - getPixelGray(prevData, px, py - 1, w)) * 0.5;
          const It = getPixelGray(currData, px, py, w) - getPixelGray(prevData, px, py, w);
          sumIxIx += Ix * Ix; sumIyIy += Iy * Iy; sumIxIy += Ix * Iy;
          sumIxIt += Ix * It; sumIyIt += Iy * It;
        }
      }

      const det = sumIxIx * sumIyIy - sumIxIy * sumIxIy;
      if (Math.abs(det) < 1e-6) continue;

      const vx = -(sumIyIy * sumIxIt - sumIxIy * sumIyIt) / det;
      const vy = -(sumIxIx * sumIyIt - sumIxIy * sumIxIt) / det;
      const magnitude = Math.sqrt(vx * vx + vy * vy);

      if (magnitude > 0.3 && magnitude < 50) {
        vectors.push({ x: gx, y: gy, vx, vy, magnitude });
      }
    }
  }

  let totalVx = 0, totalVy = 0, totalMag = 0;
  for (const v of vectors) { totalVx += v.vx; totalVy += v.vy; totalMag += v.magnitude; }
  const n = vectors.length || 1;

  return { vectors, avgDirection: { vx: totalVx / n, vy: totalVy / n }, avgMagnitude: totalMag / n, width: w, height: h };
}

// ─── Kalman Filter ────────────────────────────────────────────

interface KalmanState {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  P: [number, number, number, number, number, number];
}

const PROCESS_NOISE = 0.5;
const MEASUREMENT_NOISE = 2.0;

function kalmanSmoothTrajectory(
  waypoints: { time: number; x: number; y: number; z: number; color: string }[],
): { time: number; x: number; y: number; z: number; color: string }[] {
  if (waypoints.length < 3) return waypoints;

  let state: KalmanState = {
    x: waypoints[0].x, y: waypoints[0].y, z: waypoints[0].z,
    vx: 0, vy: 0, vz: 0, P: [10, 10, 10, 10, 10, 10],
  };
  const result = [waypoints[0]];

  for (let i = 1; i < waypoints.length; i++) {
    const dt = waypoints[i].time - waypoints[i - 1].time;
    const ddt = dt > 0 ? dt : 1;

    // Predict
    const predicted: KalmanState = {
      x: state.x + state.vx * ddt, y: state.y + state.vy * ddt, z: state.z + state.vz * ddt,
      vx: state.vx, vy: state.vy, vz: state.vz,
      P: [
        state.P[0] + PROCESS_NOISE, state.P[1] + PROCESS_NOISE, state.P[2] + PROCESS_NOISE,
        state.P[3] + PROCESS_NOISE, state.P[4] + PROCESS_NOISE, state.P[5] + PROCESS_NOISE,
      ],
    };

    // Update
    const Kx = predicted.P[0] / (predicted.P[0] + MEASUREMENT_NOISE);
    const Ky = predicted.P[1] / (predicted.P[1] + MEASUREMENT_NOISE);
    const Kz = predicted.P[2] / (predicted.P[2] + MEASUREMENT_NOISE);
    const mx = waypoints[i].x, my = waypoints[i].y, mz = waypoints[i].z;

    state = {
      x: predicted.x + Kx * (mx - predicted.x),
      y: predicted.y + Ky * (my - predicted.y),
      z: predicted.z + Kz * (mz - predicted.z),
      vx: predicted.vx + Kx * (mx - predicted.x) * 0.5,
      vy: predicted.vy + Ky * (my - predicted.y) * 0.5,
      vz: predicted.vz + Kz * (mz - predicted.z) * 0.5,
      P: [
        (1 - Kx) * predicted.P[0], (1 - Ky) * predicted.P[1], (1 - Kz) * predicted.P[2],
        predicted.P[3] * 0.95, predicted.P[4] * 0.95, predicted.P[5] * 0.95,
      ],
    };

    result.push({ time: waypoints[i].time, x: state.x, y: state.y, z: state.z, color: waypoints[i].color });
  }

  return result;
}

// ─── Message Handler ──────────────────────────────────────────

type WorkerMessage =
  | {
      type: 'opticalFlow';
      id: number;
      prevData: Uint8ClampedArray;
      currData: Uint8ClampedArray;
      width: number;
      height: number;
      gridStep: number;
    }
  | {
      type: 'opticalFlowBatch';
      id: number;
      framesData: { data: Uint8ClampedArray; width: number; height: number }[];
      gridStep: number;
    }
  | {
      type: 'kalmanSmooth';
      id: number;
      trajectories: { droneIndex: number; waypoints: { time: number; x: number; y: number; z: number; color: string }[] }[];
    };

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  if (msg.type === 'opticalFlow') {
    const result = computeOpticalFlow(msg.prevData, msg.currData, msg.width, msg.height, msg.gridStep);
    (self as any).postMessage({ type: 'opticalFlowResult', id: msg.id, result });
  }

  if (msg.type === 'opticalFlowBatch') {
    const results: (OpticalFlowField | null)[] = [null];
    const frames = msg.framesData;
    for (let i = 1; i < frames.length; i++) {
      const result = computeOpticalFlow(frames[i - 1].data, frames[i].data, frames[i].width, frames[i].height, msg.gridStep);
      results.push(result);
      // Report progress
      (self as any).postMessage({ type: 'opticalFlowProgress', id: msg.id, current: i, total: frames.length - 1 });
    }
    (self as any).postMessage({ type: 'opticalFlowBatchResult', id: msg.id, results });
  }

  if (msg.type === 'kalmanSmooth') {
    const results = msg.trajectories.map(traj => ({
      droneIndex: traj.droneIndex,
      waypoints: kalmanSmoothTrajectory(traj.waypoints),
    }));
    (self as any).postMessage({ type: 'kalmanSmoothResult', id: msg.id, results });
  }
};
