/**
 * WebGPUParticleLoop — Full frame orchestrator (Camada 11).
 * 
 * Frame pipeline:
 *   SimParams → Compute Physics → Compute Smoke (curl noise) → Bitonic Sort
 *   → Fire Render (ACES, clear) → Smoke Render (Beer-Lambert, load)
 *   → Light Scatter (fullscreen, additive) → Present
 * 
 * Billboard quads generated in vertex shader via storage buffer read.
 * Fire: additive blend + ACES tonemapping. Smoke: alpha blend + Beer-Lambert.
 * Light scatter: fullscreen triangle, low-intensity additive warming.
 */

import type { WebGPUContext } from './webgpuDevice';
import {
  createParticleBuffers, createSimUniformBuffer, createSortUniformBuffer,
  createSmokeUniformBuffer, ParticlePingPong,
  SIM_UNIFORM_BYTES, SORT_UNIFORM_BYTES, SMOKE_UNIFORM_BYTES,
} from './webgpuBuffers';
import { createComputeBindGroup, createSortBindGroup, createSmokeComputeBindGroup } from './webgpuBindGroups';
import { createComputePipeline, createSortPipeline, createSmokeComputePipeline, createFireRenderPipeline, createSmokeRenderPipeline } from './webgpuPipelines';
import { runComputePass, runFireRenderPass, runSmokeRenderPass, runSortPass, runSmokeComputePass } from './webgpuPasses';
import {
  createLightScatterPipeline, createLightScatterBindGroup,
  createLightScatterUniformBuffer, runLightScatterPass,
  LIGHT_SCATTER_UNIFORM_BYTES,
} from './webgpuLightScatter';
import { RENDER_WGSL } from './wgsl/renderShaders.wgsl';
import { SMOKE_COMPUTE_WGSL } from './wgsl/smokeCompute.wgsl';
import { LIGHT_SCATTER_WGSL } from './wgsl/lightScatter.wgsl';

// ── Camera uniform size: mat4 + vec3+pad + vec3+pad = 64+16+16 = 96 bytes (round to 128 for alignment) ──
const CAMERA_UNIFORM_BYTES = 128;

export interface LoopConfig {
  maxParticles: number;
  enableSort: boolean;
  enableSmokeSim: boolean;
  enableLightScatter: boolean;
}

const DEFAULT_LOOP_CONFIG: LoopConfig = {
  maxParticles: 8192,
  enableSort: true,
  enableSmokeSim: true,
  enableLightScatter: true,
};

export class WebGPUParticleLoop {
  private ctx: WebGPUContext;
  private config: LoopConfig;
  private pingPong: ParticlePingPong;
  private simUniform: GPUBuffer;
  private sortUniform: GPUBuffer;
  private smokeUniform: GPUBuffer;
  private cameraUniform: GPUBuffer;
  private lightScatterUniform: GPUBuffer;

  private computePipeline: GPUComputePipeline | null = null;
  private sortPipeline: GPUComputePipeline | null = null;
  private smokeComputePipeline: GPUComputePipeline | null = null;
  private firePipeline: GPURenderPipeline | null = null;
  private smokePipeline: GPURenderPipeline | null = null;
  private lightScatterPipeline: GPURenderPipeline | null = null;

  private computeBindA: GPUBindGroup | null = null;
  private computeBindB: GPUBindGroup | null = null;
  private sortBindA: GPUBindGroup | null = null;
  private sortBindB: GPUBindGroup | null = null;
  private smokeComputeBindA: GPUBindGroup | null = null;
  private smokeComputeBindB: GPUBindGroup | null = null;
  private fireBindGroup: GPUBindGroup | null = null;
  private smokeBindGroup: GPUBindGroup | null = null;
  private lightScatterBindGroup: GPUBindGroup | null = null;

  // Pre-allocated staging (zero-GC)
  private _simData = new Float32Array(SIM_UNIFORM_BYTES / 4);
  private _sortData = new Uint32Array(SORT_UNIFORM_BYTES / 4);
  private _smokeData = new Float32Array(SMOKE_UNIFORM_BYTES / 4);
  private _cameraData = new Float32Array(CAMERA_UNIFORM_BYTES / 4);
  private _lightScatterData = new Float32Array(LIGHT_SCATTER_UNIFORM_BYTES / 4);

  private _animId = 0;
  private _lastTime = 0;
  private _activeCount = 0;

  constructor(ctx: WebGPUContext, computeWGSL: string, sortWGSL: string, config?: Partial<LoopConfig>) {
    this.ctx = ctx;
    this.config = { ...DEFAULT_LOOP_CONFIG, ...config };
    const dev = ctx.device;

    // Buffers
    const bufPair = createParticleBuffers(dev, this.config.maxParticles);
    this.pingPong = new ParticlePingPong(bufPair);
    this.simUniform = createSimUniformBuffer(dev);
    this.sortUniform = createSortUniformBuffer(dev);
    this.smokeUniform = createSmokeUniformBuffer(dev);
    this.lightScatterUniform = createLightScatterUniformBuffer(dev);
    this.cameraUniform = dev.createBuffer({
      size: CAMERA_UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'camera-uniform',
    });

    // ── Compute Pipelines ──
    this.computePipeline = createComputePipeline(dev, computeWGSL);
    if (this.config.enableSort) {
      this.sortPipeline = createSortPipeline(dev, sortWGSL);
    }
    if (this.config.enableSmokeSim) {
      this.smokeComputePipeline = createSmokeComputePipeline(dev, SMOKE_COMPUTE_WGSL);
    }

    // ── Render Pipelines ──
    this.firePipeline = createFireRenderPipeline(dev, ctx.format, RENDER_WGSL);
    this.smokePipeline = createSmokeRenderPipeline(dev, ctx.format, RENDER_WGSL);
    if (this.config.enableLightScatter) {
      this.lightScatterPipeline = createLightScatterPipeline(dev, ctx.format, LIGHT_SCATTER_WGSL);
    }

    // ── Bind Groups (both ping-pong states) ──
    const computeLayout = this.computePipeline.getBindGroupLayout(0);
    this.computeBindA = createComputeBindGroup(dev, computeLayout, this.simUniform, bufPair.bufferA);
    this.computeBindB = createComputeBindGroup(dev, computeLayout, this.simUniform, bufPair.bufferB);

    if (this.sortPipeline) {
      const sortLayout = this.sortPipeline.getBindGroupLayout(0);
      this.sortBindA = createSortBindGroup(dev, sortLayout, bufPair.bufferA, this.sortUniform);
      this.sortBindB = createSortBindGroup(dev, sortLayout, bufPair.bufferB, this.sortUniform);
    }

    if (this.smokeComputePipeline) {
      const smokeLayout = this.smokeComputePipeline.getBindGroupLayout(0);
      this.smokeComputeBindA = createSmokeComputeBindGroup(dev, smokeLayout, this.smokeUniform, bufPair.bufferA);
      this.smokeComputeBindB = createSmokeComputeBindGroup(dev, smokeLayout, this.smokeUniform, bufPair.bufferB);
    }

    // Render bind groups (camera + particle storage)
    const fireLayout = this.firePipeline.getBindGroupLayout(0);
    this.fireBindGroup = dev.createBindGroup({
      layout: fireLayout,
      entries: [
        { binding: 0, resource: { buffer: this.cameraUniform } },
        { binding: 1, resource: { buffer: bufPair.bufferA } },
      ],
    });

    const smokeLayout = this.smokePipeline.getBindGroupLayout(0);
    this.smokeBindGroup = dev.createBindGroup({
      layout: smokeLayout,
      entries: [
        { binding: 0, resource: { buffer: this.cameraUniform } },
        { binding: 1, resource: { buffer: bufPair.bufferA } },
      ],
    });

    if (this.lightScatterPipeline) {
      const lsLayout = this.lightScatterPipeline.getBindGroupLayout(0);
      this.lightScatterBindGroup = createLightScatterBindGroup(dev, lsLayout, this.lightScatterUniform);
    }
  }

  get activeCount(): number { return this._activeCount; }
  set activeCount(v: number) { this._activeCount = Math.min(v, this.config.maxParticles); }

  /**
   * Upload particle data from a packed Float32Array (16 floats per particle).
   */
  uploadParticles(packed: Float32Array, count: number): void {
    this._activeCount = Math.min(count, this.config.maxParticles);
    this.ctx.device.queue.writeBuffer(this.pingPong.current, 0, packed, 0, this._activeCount * 16);
  }

  /**
   * Update camera uniforms (viewProjection matrix + camera axes).
   */
  updateCamera(viewProj: Float32Array, camRight: [number, number, number], camUp: [number, number, number]): void {
    const d = this._cameraData;
    d.set(viewProj, 0);
    d[16] = camRight[0]; d[17] = camRight[1]; d[18] = camRight[2]; d[19] = 0;
    d[20] = camUp[0]; d[21] = camUp[1]; d[22] = camUp[2]; d[23] = 0;
    this.ctx.device.queue.writeBuffer(this.cameraUniform, 0, d);
  }

  /**
   * Update light scatter params (up to 4 screen-space light positions).
   */
  updateLightScatter(
    intensity: number, falloff: number, radius: number, time: number,
    lights: Array<{ x: number; y: number; intensity: number; radius: number }>,
  ): void {
    const d = this._lightScatterData;
    d[0] = intensity; d[1] = falloff; d[2] = radius; d[3] = time;
    for (let i = 0; i < 4; i++) {
      const l = lights[i] || { x: 0, y: 0, intensity: 0, radius: 0 };
      const off = 4 + i * 4;
      d[off] = l.x; d[off + 1] = l.y; d[off + 2] = l.intensity; d[off + 3] = l.radius;
    }
    this.ctx.device.queue.writeBuffer(this.lightScatterUniform, 0, d);
  }

  /**
   * Execute one frame: compute → smoke → sort → fire → smoke render → light scatter → present.
   */
  frame(dt: number, time: number, wind: { x: number; y: number; z: number }, viewport?: { width: number; height: number }): void {
    if (this._activeCount === 0) return;

    const dev = this.ctx.device;
    const count = this._activeCount;

    // Write sim params
    const u = this._simData;
    u[0] = Math.min(dt, 0.05);
    u[1] = time;
    u[2] = 9.81;
    u[3] = wind.x; u[4] = wind.y; u[5] = wind.z;
    u[6] = 0.08; u[7] = 0.15; u[8] = 1.0; u[9] = 0;
    u[10] = viewport?.width ?? 1920;
    u[11] = viewport?.height ?? 1080;
    dev.queue.writeBuffer(this.simUniform, 0, u);

    // Write smoke params
    if (this.config.enableSmokeSim) {
      const s = this._smokeData;
      s[0] = Math.min(dt, 0.05); // dt
      s[1] = time;               // time
      s[2] = wind.x; s[3] = wind.y; s[4] = wind.z; // wind
      s[5] = 0.35;  // turbulence
      s[6] = 0.08;  // dissipation
      s[7] = 1.2;   // rise_force
      dev.queue.writeBuffer(this.smokeUniform, 0, s);
    }

    const encoder = dev.createCommandEncoder({ label: 'frame' });

    const isA = this.pingPong.current === this.pingPong['pair'].bufferA;

    // 1. Compute Physics
    const computeBind = isA ? this.computeBindA! : this.computeBindB!;
    runComputePass(encoder, this.computePipeline!, computeBind, count);

    // 2. Compute Smoke (curl noise advection)
    if (this.smokeComputePipeline && this.config.enableSmokeSim) {
      const smokeBind = isA ? this.smokeComputeBindA! : this.smokeComputeBindB!;
      runSmokeComputePass(encoder, this.smokeComputePipeline, smokeBind, count);
    }

    // 3. Sort (bitonic passes)
    if (this.sortPipeline && this.config.enableSort) {
      const sortBind = isA ? this.sortBindA! : this.sortBindB!;
      for (let blockSize = 2; blockSize <= count; blockSize *= 2) {
        for (let sub = blockSize; sub >= 2; sub /= 2) {
          const sd = this._sortData;
          sd[0] = blockSize; sd[1] = sub; sd[2] = count; sd[3] = 0;
          dev.queue.writeBuffer(this.sortUniform, 0, sd);
          runSortPass(encoder, this.sortPipeline, sortBind, count);
        }
      }
    }

    // 4. Render
    const view = this.ctx.context.getCurrentTexture().createView();

    // Fire pass (clear, ACES tonemapped in fragment)
    runFireRenderPass(encoder, view, this.firePipeline!, this.fireBindGroup!, this.pingPong.current, count);

    // Smoke pass (load, Beer-Lambert absorption)
    runSmokeRenderPass(encoder, view, this.smokePipeline!, this.smokeBindGroup!, this.pingPong.current, count);

    // 5. Light Scatter (fullscreen additive)
    if (this.lightScatterPipeline && this.lightScatterBindGroup && this.config.enableLightScatter) {
      runLightScatterPass(encoder, view, this.lightScatterPipeline, this.lightScatterBindGroup);
    }

    dev.queue.submit([encoder.finish()]);

    // Swap
    this.pingPong.swap();
  }

  /**
   * Start requestAnimationFrame loop.
   */
  start(
    windFn: () => { x: number; y: number; z: number },
    cameraFn: () => { viewProj: Float32Array; right: [number, number, number]; up: [number, number, number] },
  ): void {
    this._lastTime = performance.now() / 1000;

    const loop = () => {
      const now = performance.now() / 1000;
      const dt = Math.min(now - this._lastTime, 0.05);
      this._lastTime = now;

      const cam = cameraFn();
      this.updateCamera(cam.viewProj, cam.right, cam.up);

      const w = this.ctx.canvas.width;
      const h = this.ctx.canvas.height;
      this.frame(dt, now, windFn(), { width: w, height: h });

      this._animId = requestAnimationFrame(loop);
    };
    this._animId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this._animId) {
      cancelAnimationFrame(this._animId);
      this._animId = 0;
    }
  }

  dispose(): void {
    this.stop();
    this.pingPong.dispose();
    this.simUniform.destroy();
    this.sortUniform.destroy();
    this.smokeUniform.destroy();
    this.cameraUniform.destroy();
    this.lightScatterUniform.destroy();
  }
}
