/**
 * Dedicated worker that runs the full WebGPU particle pipeline against an
 * OffscreenCanvas. Owns its own GPU device, its own RAF loop, and never
 * touches the DOM.
 *
 * Why: the loop dispatches up to 8 compute/render passes per frame plus
 * uniform/storage writes. Running it on the main thread blocks React
 * commits, scroll, and input handling — observed as 4-8ms of jank during
 * fire/smoke bursts at 4096+ particles. Off-main-thread keeps the main
 * thread free for UI work.
 *
 * Sandbox note: Lovable's preview browser has no GPU adapter; the worker
 * will reply with `error/ADAPTER_UNAVAILABLE` and the proxy must fall
 * back to the main-thread loop (which itself falls back to "WebGPU not
 * supported"). All real testing must happen in a browser with WebGPU.
 */

/// <reference lib="webworker" />

import type {
  WorkerInbound,
  WorkerOutbound,
  WorkerErrorMsg,
} from './workerProtocol';
import { WebGPUParticleLoop, type LoopConfig } from './webgpuLoop';
import type { WebGPUContext } from './webgpuDevice';

declare const self: DedicatedWorkerGlobalScope;

let loop: WebGPUParticleLoop | null = null;
let ctx: WebGPUContext | null = null;
let canvas: OffscreenCanvas | null = null;
let animId = 0;
let lastFrameTs = 0;
let lastStatsTs = 0;
let frameCount = 0;
let frameTimeAccum = 0;
let wind: [number, number, number] = [0, 0, 0];
const cameraStaging = new Float32Array(24);
let cameraDirty = false;

function post(msg: WorkerOutbound, transfer: Transferable[] = []): void {
  self.postMessage(msg, transfer);
}

function fail(code: WorkerErrorMsg['code'], message: string, cause?: unknown): void {
  console.error('[webgpuLoopWorker]', code, message, cause);
  post({ type: 'error', code, message });
}

async function initInWorker(
  off: OffscreenCanvas,
  computeWGSL: string,
  sortWGSL: string,
  config?: Partial<LoopConfig>,
): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    fail('NO_NAVIGATOR_GPU', 'navigator.gpu unavailable in worker context.');
    return;
  }

  let adapter: GPUAdapter | null;
  try {
    adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  } catch (cause) {
    fail('ADAPTER_UNAVAILABLE', 'requestAdapter() threw inside worker.', cause);
    return;
  }
  if (!adapter) {
    fail('ADAPTER_UNAVAILABLE', 'No WebGPU adapter exposed to worker.');
    return;
  }

  let device: GPUDevice;
  try {
    device = await adapter.requestDevice();
  } catch (cause) {
    fail('DEVICE_REQUEST_FAILED', 'requestDevice() rejected in worker.', cause);
    return;
  }

  device.lost.then((info) => {
    if (info.reason === 'destroyed') return;
    fail('DEVICE_LOST', `device lost: ${info.message}`);
  });

  const gpuContext = off.getContext('webgpu') as GPUCanvasContext | null;
  if (!gpuContext) {
    device.destroy();
    fail('CANVAS_CONTEXT_FAILED', 'OffscreenCanvas.getContext("webgpu") returned null.');
    return;
  }

  const format = navigator.gpu.getPreferredCanvasFormat();
  gpuContext.configure({ device, format, alphaMode: 'premultiplied' });

  // Cast OffscreenCanvas → HTMLCanvasElement for the existing loop API.
  // The loop only reads `canvas.width/height`, so the structural type is fine.
  ctx = {
    device,
    context: gpuContext,
    format,
    canvas: off as unknown as HTMLCanvasElement,
  };
  canvas = off;

  loop = new WebGPUParticleLoop(ctx, computeWGSL, sortWGSL, config);

  post({ type: 'ready', ok: true });
}

function startLoop(): void {
  if (!loop || !ctx || !canvas) return;
  lastFrameTs = performance.now() / 1000;
  lastStatsTs = performance.now();
  frameCount = 0;
  frameTimeAccum = 0;

  const tick = () => {
    if (!loop || !canvas) return;
    const t0 = performance.now();
    const now = t0 / 1000;
    const dt = Math.min(now - lastFrameTs, 0.05);
    lastFrameTs = now;

    if (cameraDirty) {
      const right: [number, number, number] = [
        cameraStaging[16], cameraStaging[17], cameraStaging[18],
      ];
      const up: [number, number, number] = [
        cameraStaging[20], cameraStaging[21], cameraStaging[22],
      ];
      loop.updateCamera(cameraStaging.subarray(0, 16), right, up);
      cameraDirty = false;
    }

    loop.frame(
      dt,
      now,
      { x: wind[0], y: wind[1], z: wind[2] },
      { width: canvas.width, height: canvas.height },
    );

    const t1 = performance.now();
    frameTimeAccum += t1 - t0;
    frameCount += 1;

    // 1Hz stats — keep main thread informed without flooding postMessage.
    if (t1 - lastStatsTs >= 1000) {
      const fps = (frameCount * 1000) / (t1 - lastStatsTs);
      post({
        type: 'stats',
        fps,
        activeCount: loop.activeCount,
        frameTimeMs: frameTimeAccum / Math.max(1, frameCount),
      });
      lastStatsTs = t1;
      frameCount = 0;
      frameTimeAccum = 0;
    }

    animId = (self as unknown as { requestAnimationFrame: (cb: FrameRequestCallback) => number })
      .requestAnimationFrame(tick);
  };
  animId = (self as unknown as { requestAnimationFrame: (cb: FrameRequestCallback) => number })
    .requestAnimationFrame(tick);
}

function stopLoop(): void {
  if (animId) {
    (self as unknown as { cancelAnimationFrame: (id: number) => void }).cancelAnimationFrame(animId);
    animId = 0;
  }
}

function dispose(): void {
  stopLoop();
  loop?.dispose();
  loop = null;
  ctx?.device.destroy();
  ctx = null;
  canvas = null;
}

self.addEventListener('message', (e: MessageEvent<WorkerInbound>) => {
  const msg = e.data;
  switch (msg.type) {
    case 'init':
      void initInWorker(msg.canvas, msg.computeWGSL, msg.sortWGSL, msg.config);
      break;
    case 'start':
      startLoop();
      break;
    case 'stop':
      stopLoop();
      break;
    case 'dispose':
      dispose();
      break;
    case 'camera':
      cameraStaging.set(msg.data);
      cameraDirty = true;
      break;
    case 'wind':
      wind = msg.wind;
      break;
    case 'particles':
      loop?.uploadParticles(msg.packed, msg.count);
      break;
    case 'lightScatter': {
      if (!loop) break;
      const ls: Array<{ x: number; y: number; intensity: number; radius: number }> = [];
      for (let i = 0; i < 4; i++) {
        const o = i * 4;
        ls.push({
          x: msg.lights[o] ?? 0,
          y: msg.lights[o + 1] ?? 0,
          intensity: msg.lights[o + 2] ?? 0,
          radius: msg.lights[o + 3] ?? 0,
        });
      }
      loop.updateLightScatter(msg.intensity, msg.falloff, msg.radius, msg.time, ls);
      break;
    }
    case 'resize':
      if (canvas) {
        canvas.width = msg.width;
        canvas.height = msg.height;
      }
      break;
  }
});
