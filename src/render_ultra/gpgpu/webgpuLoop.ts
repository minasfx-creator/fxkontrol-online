/**
 * WebGPUParticleLoop — Full frame orchestrator.
 * 
 * Frame pipeline:
 *   SimParams → Uniform → Compute Pass → Swap → Fire Pass (clear) → Smoke Pass (load) → Present
 * 
 * Billboard quads generated in vertex shader.
 * Fire: additive blend. Smoke: alpha blend over fire.
 */

import type { WebGPUContext } from './webgpuDevice';
import { createParticleBuffers, createSimUniformBuffer, createSortUniformBuffer, ParticlePingPong, SIM_UNIFORM_BYTES, SORT_UNIFORM_BYTES } from './webgpuBuffers';
import { createComputeBindGroup, createSortBindGroup } from './webgpuBindGroups';
import { createComputePipeline, createSortPipeline, createFireRenderPipeline, createSmokeRenderPipeline } from './webgpuPipelines';
import { runComputePass, runFireRenderPass, runSmokeRenderPass, runSortPass } from './webgpuPasses';

// ── WGSL Billboard Render Shader ──────────────────────────────
const RENDER_WGSL = /* wgsl */ `
struct CameraUniforms {
  viewProj: mat4x4<f32>,
  camRight: vec3<f32>,
  _pad0: f32,
  camUp: vec3<f32>,
  _pad1: f32,
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;

struct VSInput {
  @location(0) pos: vec4<f32>,    // xyz = world, w = age
  @location(1) vel: vec4<f32>,    // xyz = velocity, w = life
  @location(2) color: vec4<f32>,  // rgb, brightness
  @location(3) misc: vec4<f32>,   // temp, size, smoke, type
};

struct VSOutput {
  @builtin(position) clipPos: vec4<f32>,
  @location(0) vColor: vec4<f32>,
  @location(1) vUV: vec2<f32>,
  @location(2) vSmoke: f32,
  @location(3) vAlive: f32,
};

// Billboard quad offsets (2 triangles, 6 vertices)
const QUAD_POS = array<vec2<f32>, 6>(
  vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
  vec2(-1.0, 1.0),  vec2(1.0, -1.0), vec2(1.0, 1.0),
);
const QUAD_UV = array<vec2<f32>, 6>(
  vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(0.0, 1.0),
  vec2(0.0, 1.0), vec2(1.0, 0.0), vec2(1.0, 1.0),
);

fn saturate(v: f32) -> f32 { return clamp(v, 0.0, 1.0); }

// ── Fire vertex/fragment ──
@vertex
fn vs_fire(@builtin(vertex_index) vid: u32, input: VSInput) -> VSOutput {
  var out: VSOutput;
  let age = input.pos.w;
  let life = max(input.vel.w, 0.0001);
  let alive = saturate(1.0 - age / life);

  // Kill dead particles
  if (alive <= 0.0) {
    out.clipPos = vec4(0.0, 0.0, -2.0, 1.0);
    return out;
  }

  let size = input.misc.y * (0.5 + 0.5 * alive);
  let offset = QUAD_POS[vid];
  let worldPos = input.pos.xyz
    + camera.camRight * offset.x * size
    + camera.camUp * offset.y * size;

  out.clipPos = camera.viewProj * vec4(worldPos, 1.0);
  out.vColor = vec4(input.color.rgb * input.color.a, input.color.a);
  out.vUV = QUAD_UV[vid];
  out.vSmoke = input.misc.z;
  out.vAlive = alive;
  return out;
}

@fragment
fn fs_fire(input: VSOutput) -> @location(0) vec4<f32> {
  let d = length(input.vUV - vec2(0.5));
  let falloff = saturate(1.0 - d * 2.0);
  let glow = falloff * falloff * falloff; // cubic falloff for soft glow

  // Only render fire particles (low smoke)
  if (input.vSmoke > 0.5) {
    discard;
  }

  let intensity = glow * input.vAlive;
  return vec4(input.vColor.rgb * intensity * 10.0, intensity);
}

// ── Smoke vertex/fragment ──
@vertex
fn vs_smoke(@builtin(vertex_index) vid: u32, input: VSInput) -> VSOutput {
  var out: VSOutput;
  let age = input.pos.w;
  let life = max(input.vel.w, 0.0001);
  let alive = saturate(1.0 - age / life);

  if (alive <= 0.0) {
    out.clipPos = vec4(0.0, 0.0, -2.0, 1.0);
    return out;
  }

  // Smoke grows larger over time
  let size = input.misc.y * (1.0 + 2.0 * (1.0 - alive));
  let offset = QUAD_POS[vid];
  let worldPos = input.pos.xyz
    + camera.camRight * offset.x * size
    + camera.camUp * offset.y * size;

  out.clipPos = camera.viewProj * vec4(worldPos, 1.0);
  out.vColor = vec4(0.12, 0.10, 0.08, 1.0); // dark smoke base
  out.vUV = QUAD_UV[vid];
  out.vSmoke = input.misc.z;
  out.vAlive = alive;
  return out;
}

@fragment
fn fs_smoke(input: VSOutput) -> @location(0) vec4<f32> {
  // Only render smoke particles
  if (input.vSmoke < 0.3) {
    discard;
  }

  let d = length(input.vUV - vec2(0.5));
  let falloff = saturate(1.0 - d * 2.0);
  let soft = falloff * falloff;

  // Beer-Lambert absorption
  let density = input.vSmoke * 0.92;
  let alpha = soft * density * input.vAlive * 0.75;

  return vec4(input.vColor.rgb, alpha);
}
`;

// ── Camera uniform size: mat4 + vec3+pad + vec3+pad = 64+16+16 = 96 bytes (round to 128 for alignment) ──
const CAMERA_UNIFORM_BYTES = 128;

export interface LoopConfig {
  maxParticles: number;
  enableSort: boolean;
}

const DEFAULT_LOOP_CONFIG: LoopConfig = {
  maxParticles: 8192,
  enableSort: true,
};

export class WebGPUParticleLoop {
  private ctx: WebGPUContext;
  private config: LoopConfig;
  private pingPong: ParticlePingPong;
  private simUniform: GPUBuffer;
  private sortUniform: GPUBuffer;
  private cameraUniform: GPUBuffer;

  private computePipeline: GPUComputePipeline | null = null;
  private sortPipeline: GPUComputePipeline | null = null;
  private firePipeline: GPURenderPipeline | null = null;
  private smokePipeline: GPURenderPipeline | null = null;

  private computeBindA: GPUBindGroup | null = null;
  private computeBindB: GPUBindGroup | null = null;
  private sortBindA: GPUBindGroup | null = null;
  private sortBindB: GPUBindGroup | null = null;
  private fireBindGroup: GPUBindGroup | null = null;
  private smokeBindGroup: GPUBindGroup | null = null;

  // Pre-allocated staging (zero-GC)
  private _simData = new Float32Array(SIM_UNIFORM_BYTES / 4);
  private _sortData = new Uint32Array(SORT_UNIFORM_BYTES / 4);
  private _cameraData = new Float32Array(CAMERA_UNIFORM_BYTES / 4);

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
    this.cameraUniform = dev.createBuffer({
      size: CAMERA_UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'camera-uniform',
    });

    // Pipelines
    this.computePipeline = createComputePipeline(dev, computeWGSL);
    if (this.config.enableSort) {
      this.sortPipeline = createSortPipeline(dev, sortWGSL);
    }
    this.firePipeline = createFireRenderPipeline(dev, ctx.format, RENDER_WGSL);
    this.smokePipeline = createSmokeRenderPipeline(dev, ctx.format, RENDER_WGSL);

    // Bind groups for both ping-pong states
    const computeLayout = this.computePipeline.getBindGroupLayout(0);
    this.computeBindA = createComputeBindGroup(dev, computeLayout, this.simUniform, bufPair.bufferA);
    this.computeBindB = createComputeBindGroup(dev, computeLayout, this.simUniform, bufPair.bufferB);

    if (this.sortPipeline) {
      const sortLayout = this.sortPipeline.getBindGroupLayout(0);
      this.sortBindA = createSortBindGroup(dev, sortLayout, bufPair.bufferA, this.sortUniform);
      this.sortBindB = createSortBindGroup(dev, sortLayout, bufPair.bufferB, this.sortUniform);
    }

    // Render bind groups
    const fireLayout = this.firePipeline.getBindGroupLayout(0);
    this.fireBindGroup = dev.createBindGroup({
      layout: fireLayout,
      entries: [{ binding: 0, resource: { buffer: this.cameraUniform } }],
    });

    const smokeLayout = this.smokePipeline.getBindGroupLayout(0);
    this.smokeBindGroup = dev.createBindGroup({
      layout: smokeLayout,
      entries: [{ binding: 0, resource: { buffer: this.cameraUniform } }],
    });
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
    d.set(viewProj, 0); // mat4x4 at offset 0 (64 bytes = 16 floats)
    d[16] = camRight[0]; d[17] = camRight[1]; d[18] = camRight[2]; d[19] = 0;
    d[20] = camUp[0]; d[21] = camUp[1]; d[22] = camUp[2]; d[23] = 0;
    this.ctx.device.queue.writeBuffer(this.cameraUniform, 0, d);
  }

  /**
   * Execute one frame: compute → sort → fire render → smoke render.
   */
  frame(dt: number, time: number, wind: { x: number; y: number; z: number }, viewport?: { width: number; height: number }): void {
    if (this._activeCount === 0) return;

    const dev = this.ctx.device;
    const count = this._activeCount;

    // Write sim params
    const u = this._simData;
    u[0] = Math.min(dt, 0.05); // cap dt
    u[1] = time;
    u[2] = 9.81; // gravity
    u[3] = wind.x; u[4] = wind.y; u[5] = wind.z;
    u[6] = 0.08; // drag
    u[7] = 0.15; // smoke_bias
    u[8] = 1.0;  // fire_intensity
    u[9] = 0;
    u[10] = viewport?.width ?? 1920;
    u[11] = viewport?.height ?? 1080;
    dev.queue.writeBuffer(this.simUniform, 0, u);

    const encoder = dev.createCommandEncoder({ label: 'frame' });

    // Determine which bind groups to use based on current ping-pong state
    const isA = this.pingPong.current === this.pingPong['pair'].bufferA;
    const computeBind = isA ? this.computeBindA! : this.computeBindB!;

    // 1. Compute
    runComputePass(encoder, this.computePipeline!, computeBind, count);

    // 2. Sort (bitonic passes)
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

    // 3. Render
    const view = this.ctx.context.getCurrentTexture().createView();

    // Fire pass (clear)
    runFireRenderPass(encoder, view, this.firePipeline!, this.fireBindGroup!, this.pingPong.current, count);

    // Smoke pass (load existing)
    runSmokeRenderPass(encoder, view, this.smokePipeline!, this.smokeBindGroup!, this.pingPong.current, count);

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
    this.cameraUniform.destroy();
  }
}
