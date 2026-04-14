/**
 * FXKGPUEngine — Unified WebGPU volumetric render engine.
 *
 * Orchestrates: physics compute → smoke compute → sort → fire render →
 * smoke render → light scatter → present, all via ping-pong buffers.
 *
 * Zero-GC in the frame loop. Safe fallback when WebGPU is unavailable.
 */

import type { WebGPUContext } from '../webgpuDevice';
import { isWebGPUSupported, initWebGPU } from '../webgpuDevice';
import { RENDER_WGSL } from '../wgsl/renderShaders.wgsl';
import { SMOKE_COMPUTE_WGSL } from '../wgsl/smokeCompute.wgsl';
import { LIGHT_SCATTER_WGSL } from '../wgsl/lightScatter.wgsl';

import { createFXKBuffers, createFXKStagingArrays, disposeFXKBuffers } from './buffers';
import type { FXKBufferSet, FXKStagingArrays } from './buffers';
import { createAllPipelines } from './pipelines';
import type { FXKPipelineSet, FXKPipelineConfig } from './pipelines';
import { createAllBindGroups } from './bindGroups';
import type { FXKBindGroupSet } from './bindGroups';
import { encodeFrame } from './passes';

// ── Types ──

export interface FXKEngineConfig {
  maxParticles: number;
  enableSort: boolean;
  enableSmokeSim: boolean;
  enableLightScatter: boolean;
  /** WGSL source for particle physics compute. Must export `cs_update`. */
  computeWGSL: string;
  /** WGSL source for bitonic sort compute. Must export `cs_sort`. */
  sortWGSL: string;
}

export interface FXKCameraState {
  viewProj: Float32Array;
  right: [number, number, number];
  up: [number, number, number];
}

export interface FXKLightSource {
  x: number;
  y: number;
  intensity: number;
  radius: number;
}

export type FXKEngineState = 'uninitialized' | 'ready' | 'running' | 'disposed' | 'fallback';

// ── Engine ──

export class FXKGPUEngine {
  private ctx: WebGPUContext | null = null;
  private config: FXKEngineConfig;
  private buffers: FXKBufferSet | null = null;
  private pipelines: FXKPipelineSet | null = null;
  private bindGroups: FXKBindGroupSet | null = null;
  private staging: FXKStagingArrays;

  private _state: FXKEngineState = 'uninitialized';
  private _animId = 0;
  private _lastTime = 0;
  private _activeCount = 0;

  constructor(config: Partial<FXKEngineConfig> & { computeWGSL: string; sortWGSL: string }) {
    this.config = {
      maxParticles: 8192,
      enableSort: true,
      enableSmokeSim: true,
      enableLightScatter: true,
      ...config,
    };
    this.staging = createFXKStagingArrays();
  }

  get state(): FXKEngineState { return this._state; }
  get activeCount(): number { return this._activeCount; }
  set activeCount(v: number) { this._activeCount = Math.min(v, this.config.maxParticles); }

  /**
   * Initialize WebGPU device, pipelines, and buffers.
   * Falls back gracefully if WebGPU is unavailable.
   */
  async init(canvas: HTMLCanvasElement): Promise<boolean> {
    if (!isWebGPUSupported()) {
      console.warn('[FXKGPUEngine] WebGPU not available → fallback mode');
      this._state = 'fallback';
      return false;
    }

    try {
      this.ctx = await initWebGPU(canvas);
    } catch (e) {
      console.warn('[FXKGPUEngine] WebGPU init failed → fallback mode', e);
      this._state = 'fallback';
      return false;
    }

    const dev = this.ctx.device;
    const fmt = this.ctx.format;

    // Handle device lost
    dev.lost.then((info) => {
      console.warn('[FXKGPUEngine] GPU device lost:', info.message);
      if (info.reason !== 'destroyed') {
        this._state = 'fallback';
        this.stop();
      }
    });

    // Buffers
    this.buffers = createFXKBuffers(dev, this.config.maxParticles);

    // Pipelines
    const pipeConfig: FXKPipelineConfig = {
      enableSort: this.config.enableSort,
      enableSmokeSim: this.config.enableSmokeSim,
      enableLightScatter: this.config.enableLightScatter,
    };
    this.pipelines = createAllPipelines(dev, fmt, {
      compute: this.config.computeWGSL,
      sort: this.config.sortWGSL,
      render: RENDER_WGSL,
      smokeCompute: SMOKE_COMPUTE_WGSL,
      lightScatter: LIGHT_SCATTER_WGSL,
    }, pipeConfig);

    // Bind Groups
    this.bindGroups = createAllBindGroups(dev, this.pipelines, this.buffers);

    this._state = 'ready';
    return true;
  }

  /**
   * Upload particle data (16 floats per particle: pos, vel, color, misc).
   */
  uploadParticles(packed: Float32Array, count: number): void {
    if (!this.ctx || !this.buffers) return;
    this._activeCount = Math.min(count, this.config.maxParticles);
    this.ctx.device.queue.writeBuffer(
      this.buffers.pingPong.current, 0,
      packed, 0,
      this._activeCount * 16,
    );
  }

  /**
   * Update camera uniforms.
   */
  updateCamera(cam: FXKCameraState): void {
    if (!this.ctx || !this.buffers) return;
    const d = this.staging.camera;
    d.set(cam.viewProj, 0);
    d[16] = cam.right[0]; d[17] = cam.right[1]; d[18] = cam.right[2]; d[19] = 0;
    d[20] = cam.up[0]; d[21] = cam.up[1]; d[22] = cam.up[2]; d[23] = 0;
    this.ctx.device.queue.writeBuffer(this.buffers.cameraUniform, 0, d);
  }

  /**
   * Update light scatter params.
   */
  updateLightScatter(
    intensity: number, falloff: number, radius: number, time: number,
    lights: FXKLightSource[],
  ): void {
    if (!this.ctx || !this.buffers) return;
    const d = this.staging.lightScatter;
    d[0] = intensity; d[1] = falloff; d[2] = radius; d[3] = time;
    for (let i = 0; i < 4; i++) {
      const l = lights[i] || { x: 0, y: 0, intensity: 0, radius: 0 };
      const off = 4 + i * 4;
      d[off] = l.x; d[off + 1] = l.y; d[off + 2] = l.intensity; d[off + 3] = l.radius;
    }
    this.ctx.device.queue.writeBuffer(this.buffers.lightScatterUniform, 0, d);
  }

  /**
   * Execute a single frame. Call this from requestAnimationFrame or an external loop.
   */
  frame(dt: number, time: number, wind: { x: number; y: number; z: number }): void {
    if (this._state !== 'ready' && this._state !== 'running') return;
    if (this._activeCount === 0) return;
    if (!this.ctx || !this.buffers || !this.pipelines || !this.bindGroups) return;

    const dev = this.ctx.device;
    const count = this._activeCount;
    const clampedDt = Math.min(dt, 0.05);

    // Write sim params
    const u = this.staging.sim;
    u[0] = clampedDt; u[1] = time; u[2] = 9.81;
    u[3] = wind.x; u[4] = wind.y; u[5] = wind.z;
    u[6] = 0.08; u[7] = 0.15; u[8] = 1.0; u[9] = 0;
    u[10] = this.ctx.canvas.width; u[11] = this.ctx.canvas.height;
    dev.queue.writeBuffer(this.buffers.simUniform, 0, u);

    // Write smoke params
    if (this.config.enableSmokeSim) {
      const s = this.staging.smoke;
      s[0] = clampedDt; s[1] = time;
      s[2] = wind.x; s[3] = wind.y; s[4] = wind.z;
      s[5] = 0.35; s[6] = 0.08; s[7] = 1.2;
      dev.queue.writeBuffer(this.buffers.smokeUniform, 0, s);
    }

    const encoder = dev.createCommandEncoder({ label: 'fxk-frame' });
    const textureView = this.ctx.context.getCurrentTexture().createView();

    const isA = this.buffers.pingPong.current === (this.buffers.pingPong as any)['pair']?.bufferA
      || this.buffers.pingPong['_index'] === 0;

    encodeFrame(
      encoder, textureView,
      this.pipelines, this.bindGroups, this.buffers,
      count, isA,
      {
        enableSort: this.config.enableSort,
        enableSmokeSim: this.config.enableSmokeSim,
        enableLightScatter: this.config.enableLightScatter,
      },
      this.config.enableSort ? this.staging.sort : null,
      this.config.enableSort ? this.buffers.sortUniform : null,
      dev,
    );

    dev.queue.submit([encoder.finish()]);
    this.buffers.pingPong.swap();
  }

  /**
   * Start the internal rAF loop.
   */
  start(
    windFn: () => { x: number; y: number; z: number },
    cameraFn: () => FXKCameraState,
  ): void {
    if (this._state === 'fallback' || this._state === 'disposed') return;
    this._state = 'running';
    this._lastTime = performance.now() / 1000;

    const loop = () => {
      const now = performance.now() / 1000;
      const dt = Math.min(now - this._lastTime, 0.05);
      this._lastTime = now;

      this.updateCamera(cameraFn());
      this.frame(dt, now, windFn());

      this._animId = requestAnimationFrame(loop);
    };
    this._animId = requestAnimationFrame(loop);
  }

  /**
   * Stop the rAF loop.
   */
  stop(): void {
    if (this._animId) {
      cancelAnimationFrame(this._animId);
      this._animId = 0;
    }
    if (this._state === 'running') {
      this._state = 'ready';
    }
  }

  /**
   * Release all GPU resources.
   */
  dispose(): void {
    this.stop();
    if (this.buffers) {
      disposeFXKBuffers(this.buffers);
      this.buffers = null;
    }
    this.pipelines = null;
    this.bindGroups = null;
    this.ctx = null;
    this._state = 'disposed';
  }
}
