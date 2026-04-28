/**
 * WebGPUParticleLoopProxy — main-thread façade that mirrors the
 * `WebGPUParticleLoop` public API but runs the actual pipeline inside a
 * dedicated worker against an OffscreenCanvas.
 *
 * Decision matrix:
 *   - OffscreenCanvas + Worker WebGPU available  → offload (fast path).
 *   - OffscreenCanvas missing OR worker init fails → caller must fall back
 *     to the synchronous `WebGPUParticleLoop` against the same canvas.
 *
 * Stability note: the proxy NEVER throws synchronously. `init()` resolves
 * with a discriminated result so the consumer can decide whether to
 * downgrade to the main-thread loop or surface a "WebGPU unavailable"
 * notice. This matches the `initWebGPU` contract in `webgpuDevice.ts`.
 *
 * Backpressure: writes are fire-and-forget. The worker's RAF naturally
 * coalesces — no need for a queue on this side.
 */

import type { LoopConfig } from './webgpuLoop';
import type {
  WorkerInbound,
  WorkerOutbound,
  WorkerErrorMsg,
  WorkerStatsMsg,
} from './workerProtocol';

export type ProxyInitResult =
  | { ok: true }
  | { ok: false; reason: WorkerErrorMsg['code']; message: string };

export interface ProxyStats {
  fps: number;
  activeCount: number;
  frameTimeMs: number;
}

export class WebGPUParticleLoopProxy {
  private worker: Worker | null = null;
  private _stats: ProxyStats = { fps: 0, activeCount: 0, frameTimeMs: 0 };
  private _statsListener: ((s: ProxyStats) => void) | null = null;
  // Reusable staging — zero-GC on the hot path.
  private _cameraStage = new Float32Array(24);
  private _lightStage = new Float32Array(16);

  static isOffloadSupported(canvas: HTMLCanvasElement): boolean {
    return (
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      typeof canvas.transferControlToOffscreen === 'function'
    );
  }

  /**
   * Transfers the canvas to a worker and waits for `ready` / `error`.
   * Once this resolves with `{ ok: false }`, the canvas has NOT been
   * transferred (we abort before `postMessage`) so callers can still
   * use it for the main-thread fallback.
   */
  async init(
    canvas: HTMLCanvasElement,
    computeWGSL: string,
    sortWGSL: string,
    config?: Partial<LoopConfig>,
  ): Promise<ProxyInitResult> {
    if (!WebGPUParticleLoopProxy.isOffloadSupported(canvas)) {
      return {
        ok: false,
        reason: 'NO_NAVIGATOR_GPU',
        message: 'OffscreenCanvas / Worker not available in this browser.',
      };
    }

    let worker: Worker;
    try {
      // Vite resolves this to a hashed chunk; no main-bundle cost.
      worker = new Worker(new URL('./webgpuLoopWorker.ts', import.meta.url), {
        type: 'module',
        name: 'webgpu-particle-loop',
      });
    } catch (cause) {
      console.warn('[WebGPUParticleLoopProxy] failed to spawn worker', cause);
      return {
        ok: false,
        reason: 'UNKNOWN',
        message: 'Worker constructor failed.',
      };
    }

    const offscreen = canvas.transferControlToOffscreen();

    const result = await new Promise<ProxyInitResult>((resolve) => {
      const onMsg = (e: MessageEvent<WorkerOutbound>) => {
        const msg = e.data;
        if (msg.type === 'ready') {
          worker.removeEventListener('message', onMsg);
          resolve({ ok: true });
        } else if (msg.type === 'error') {
          worker.removeEventListener('message', onMsg);
          resolve({ ok: false, reason: msg.code, message: msg.message });
        }
      };
      worker.addEventListener('message', onMsg);

      const initMsg: WorkerInbound = {
        type: 'init',
        canvas: offscreen,
        computeWGSL,
        sortWGSL,
        config,
      };
      worker.postMessage(initMsg, [offscreen]);
    });

    if (!result.ok) {
      worker.terminate();
      return result;
    }

    // Persistent stats listener
    worker.addEventListener('message', (e: MessageEvent<WorkerOutbound>) => {
      if (e.data.type === 'stats') {
        const s = e.data as WorkerStatsMsg;
        this._stats.fps = s.fps;
        this._stats.activeCount = s.activeCount;
        this._stats.frameTimeMs = s.frameTimeMs;
        this._statsListener?.(this._stats);
      }
    });

    this.worker = worker;
    return { ok: true };
  }

  start(): void {
    this.worker?.postMessage({ type: 'start' } satisfies WorkerInbound);
  }

  stop(): void {
    this.worker?.postMessage({ type: 'stop' } satisfies WorkerInbound);
  }

  /**
   * Send camera transform. Caller passes the already-built 24-float layout
   * (mat4 viewProj at 0..15, right at 16..18, up at 20..22) OR the legacy
   * separate args. Buffer is COPIED into the proxy's staging then
   * transferred — caller keeps ownership of its own array.
   */
  updateCamera(
    viewProj: Float32Array,
    right: [number, number, number],
    up: [number, number, number],
  ): void {
    if (!this.worker) return;
    const d = this._cameraStage;
    d.set(viewProj, 0);
    d[16] = right[0]; d[17] = right[1]; d[18] = right[2]; d[19] = 0;
    d[20] = up[0]; d[21] = up[1]; d[22] = up[2]; d[23] = 0;
    // Send a fresh transferable copy to keep the staging buffer alive.
    const out = new Float32Array(d);
    this.worker.postMessage(
      { type: 'camera', data: out } satisfies WorkerInbound,
      [out.buffer],
    );
  }

  setWind(x: number, y: number, z: number): void {
    this.worker?.postMessage({ type: 'wind', wind: [x, y, z] } satisfies WorkerInbound);
  }

  uploadParticles(packed: Float32Array, count: number): void {
    if (!this.worker) return;
    // Caller's buffer is transferred — they MUST treat `packed` as
    // detached after this call.
    this.worker.postMessage(
      { type: 'particles', packed, count } satisfies WorkerInbound,
      [packed.buffer],
    );
  }

  updateLightScatter(
    intensity: number,
    falloff: number,
    radius: number,
    time: number,
    lights: Array<{ x: number; y: number; intensity: number; radius: number }>,
  ): void {
    if (!this.worker) return;
    const d = this._lightStage;
    for (let i = 0; i < 4; i++) {
      const l = lights[i] || { x: 0, y: 0, intensity: 0, radius: 0 };
      const o = i * 4;
      d[o] = l.x; d[o + 1] = l.y; d[o + 2] = l.intensity; d[o + 3] = l.radius;
    }
    const out = new Float32Array(d);
    this.worker.postMessage(
      {
        type: 'lightScatter',
        intensity,
        falloff,
        radius,
        time,
        lights: out,
      } satisfies WorkerInbound,
      [out.buffer],
    );
  }

  resize(width: number, height: number): void {
    this.worker?.postMessage({ type: 'resize', width, height } satisfies WorkerInbound);
  }

  onStats(cb: (s: ProxyStats) => void): void {
    this._statsListener = cb;
  }

  get stats(): ProxyStats {
    return this._stats;
  }

  dispose(): void {
    if (!this.worker) return;
    this.worker.postMessage({ type: 'dispose' } satisfies WorkerInbound);
    // Give the worker a tick to release GPU resources before terminate.
    setTimeout(() => {
      this.worker?.terminate();
      this.worker = null;
    }, 50);
  }
}
