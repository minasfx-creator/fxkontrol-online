/**
 * Client wrapper for the video tracking Web Worker.
 * Provides promise-based API for optical flow and Kalman filter.
 */
import type { OpticalFlowField } from './videoTrackingAdvanced';
import type { ChoreoTrajectory } from './videoChoreoEngine';

let worker: Worker | null = null;
let msgId = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();
const progressCallbacks = new Map<number, (current: number, total: number) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('../workers/videoTrackingWorker.ts', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = (e) => {
      const { type, id } = e.data;

      if (type === 'opticalFlowProgress') {
        progressCallbacks.get(id)?.(e.data.current, e.data.total);
        return;
      }

      const p = pending.get(id);
      if (p) {
        pending.delete(id);
        progressCallbacks.delete(id);
        if (type === 'opticalFlowResult') p.resolve(e.data.result);
        else if (type === 'opticalFlowBatchResult') p.resolve(e.data.results);
        else if (type === 'kalmanSmoothResult') p.resolve(e.data.results);
        else p.resolve(e.data);
      }
    };
    worker.onerror = (err) => {
      for (const p of pending.values()) p.reject(err);
      pending.clear();
      progressCallbacks.clear();
    };
  }
  return worker;
}

function nextId(): number {
  return ++msgId;
}

/**
 * Compute optical flow for a batch of frames in the worker.
 */
export function computeOpticalFlowBatchWorker(
  frames: { imageData: ImageData }[],
  gridStep: number = 8,
  onProgress?: (current: number, total: number) => void,
): Promise<(OpticalFlowField | null)[]> {
  const id = nextId();
  const w = getWorker();

  // Transfer frame data (we copy since ImageData can't be transferred as-is)
  const framesData = frames.map(f => ({
    data: new Uint8ClampedArray(f.imageData.data),
    width: f.imageData.width,
    height: f.imageData.height,
  }));

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    if (onProgress) progressCallbacks.set(id, onProgress);
    w.postMessage({ type: 'opticalFlowBatch', id, framesData, gridStep });
  });
}

/**
 * Smooth trajectories with Kalman filter in the worker.
 */
export function kalmanSmoothTrajectoriesWorker(
  trajectories: ChoreoTrajectory[],
): Promise<ChoreoTrajectory[]> {
  const id = nextId();
  const w = getWorker();

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ type: 'kalmanSmooth', id, trajectories });
  });
}

/**
 * Terminate the worker when no longer needed.
 */
export function terminateTrackingWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
    pending.clear();
    progressCallbacks.clear();
  }
}
