/**
 * Worker protocol for the off-main-thread WebGPU particle loop.
 *
 * Design goals:
 *   - Zero-copy: ArrayBuffers are transferred (not cloned) via `Transferable[]`.
 *   - Stable contract: keep this file as the single source of truth for both
 *     `webgpuLoopWorker.ts` and `WebGPUParticleLoopProxy`.
 *   - Backwards-compatible API surface with `WebGPUParticleLoop` so callers
 *     don't notice the offload.
 *
 * Frequency budget:
 *   - `camera`/`uniforms` may fire every frame (60Hz+). Always transfer.
 *   - `particles` is bursty (effect spawn). Transfer the underlying buffer.
 *   - `stats` flows back at 1Hz so the main thread can mirror FPS without
 *     blocking on structured clone of large state.
 */

import type { LoopConfig } from './webgpuLoop';

export type Vec3 = [number, number, number];

// ── main → worker ───────────────────────────────────────────────
export type WorkerInitMsg = {
  type: 'init';
  canvas: OffscreenCanvas;
  computeWGSL: string;
  sortWGSL: string;
  config?: Partial<LoopConfig>;
};

export type WorkerStartMsg = { type: 'start' };
export type WorkerStopMsg = { type: 'stop' };
export type WorkerDisposeMsg = { type: 'dispose' };

export type WorkerCameraMsg = {
  type: 'camera';
  /** Float32Array(24): mat4 viewProj (16) + right vec3+pad (4) + up vec3+pad (4). */
  data: Float32Array;
};

export type WorkerWindMsg = {
  type: 'wind';
  wind: Vec3;
};

export type WorkerParticlesMsg = {
  type: 'particles';
  /** Packed Float32Array (16 floats per particle). Buffer is transferred. */
  packed: Float32Array;
  count: number;
};

export type WorkerLightScatterMsg = {
  type: 'lightScatter';
  intensity: number;
  falloff: number;
  radius: number;
  time: number;
  /** Up to 4 lights, packed. Buffer is transferred. */
  lights: Float32Array;
};

export type WorkerResizeMsg = {
  type: 'resize';
  width: number;
  height: number;
};

export type WorkerInbound =
  | WorkerInitMsg
  | WorkerStartMsg
  | WorkerStopMsg
  | WorkerDisposeMsg
  | WorkerCameraMsg
  | WorkerWindMsg
  | WorkerParticlesMsg
  | WorkerLightScatterMsg
  | WorkerResizeMsg;

// ── worker → main ───────────────────────────────────────────────
export type WorkerReadyMsg = {
  type: 'ready';
  ok: true;
};

export type WorkerErrorMsg = {
  type: 'error';
  code:
    | 'NO_OFFSCREEN_CANVAS'
    | 'NO_NAVIGATOR_GPU'
    | 'ADAPTER_UNAVAILABLE'
    | 'DEVICE_REQUEST_FAILED'
    | 'CANVAS_CONTEXT_FAILED'
    | 'DEVICE_LOST'
    | 'UNKNOWN';
  message: string;
};

export type WorkerStatsMsg = {
  type: 'stats';
  fps: number;
  activeCount: number;
  frameTimeMs: number;
};

export type WorkerOutbound = WorkerReadyMsg | WorkerErrorMsg | WorkerStatsMsg;
