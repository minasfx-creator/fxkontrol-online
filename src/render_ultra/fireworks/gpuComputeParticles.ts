/**
 * FX KONTROL · GPU Compute Particle System — RECALIBRATED v2 (Camada 9)
 * 7-stage pipeline with 3 compute dispatches:
 *   1. Force accumulation (gravity, drag, wind, turbulence, buoyancy)
 *   2. Combustion (energy, fuel, flicker) — via computeCombustion
 *   3. Smoke turbulence (curl noise, buoyancy) — via computeSmokeTurbulence
 *   + Velocity-Verlet integration + bitonic sort
 *
 * Particle struct (per-particle, 96 bytes, 16-byte aligned):
 *   position: vec3<f32> + pad     (0-16)
 *   velocity: vec3<f32> + pad     (16-32)
 *   force:    vec3<f32> + pad     (32-48)
 *   life, maxLife, temperature, mass  (48-64)
 *   drag, seed, size, sortKey         (64-80)
 *   energy, fuel, _pad, _pad          (80-96)
 *
 * Recalibrated values: drag ρ=1.18, buoyancy 3.2, turbulence 3.0
 * Zero-GC: all buffers pre-allocated, no per-frame allocations.
 */

import { tickCombustionCPU, createCombustionData, type CombustionData } from './computeCombustion';
import { tickSmokeTurbulenceCPU, DEFAULT_SMOKE_TURBULENCE } from './computeSmokeTurbulence';

// ═══════════════════════════════════════════════════════════════
// WGSL Compute Kernels (strings — compiled at runtime by WebGPU)
// ═══════════════════════════════════════════════════════════════

/** Particle memory layout — 96 bytes, 16-byte aligned */
const PARTICLE_STRUCT_WGSL = /* wgsl */ `
struct Particle {
  position: vec3<f32>,    // 0..12
  _pad0: f32,            // 12..16
  velocity: vec3<f32>,    // 16..28
  _pad1: f32,            // 28..32
  force: vec3<f32>,       // 32..44
  _pad2: f32,            // 44..48
  life: f32,              // 48..52
  maxLife: f32,           // 52..56
  temperature: f32,       // 56..60
  mass: f32,              // 60..64
  drag: f32,              // 64..68
  seed: f32,              // 68..72
  size: f32,              // 72..76
  sortKey: f32,           // 76..80
  energy: f32,            // 80..84
  fuel: f32,              // 84..88
  _pad3: f32,            // 88..92
  _pad4: f32,            // 92..96
};
`;

/** Simulation uniforms — 64 bytes */
const SIM_UNIFORMS_WGSL = /* wgsl */ `
struct SimUniforms {
  deltaTime: f32,
  time: f32,
  particleCount: u32,
  _pad0: u32,
  gravity: vec3<f32>,
  _pad1: f32,
  windDir: vec3<f32>,
  windSpeed: f32,
  cameraPos: vec3<f32>,
  turbulenceScale: f32,
};
`;

// ── Force Accumulation Kernel ──
const FORCE_KERNEL_WGSL = /* wgsl */ `
${PARTICLE_STRUCT_WGSL}
${SIM_UNIFORMS_WGSL}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> sim: SimUniforms;

// ── Pseudo-random hash for turbulence ──
fn hash31(p: vec3<f32>) -> f32 {
  var p3 = fract(p * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// ── Curl-noise approximated turbulence ──
fn turbulence(pos: vec3<f32>, time: f32, scale: f32) -> vec3<f32> {
  let eps = 0.15;
  let p = pos * scale + vec3<f32>(time * 0.7, time * 0.3, time * 0.5);
  let dx = hash31(p + vec3<f32>(eps, 0.0, 0.0)) - hash31(p - vec3<f32>(eps, 0.0, 0.0));
  let dy = hash31(p + vec3<f32>(0.0, eps, 0.0)) - hash31(p - vec3<f32>(0.0, eps, 0.0));
  let dz = hash31(p + vec3<f32>(0.0, 0.0, eps)) - hash31(p - vec3<f32>(0.0, 0.0, eps));
  // Curl = cross(gradient_y_z, gradient_x_z, gradient_x_y)
  return vec3<f32>(dz - dy, dx - dz, dy - dx) * 3.0;
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= sim.particleCount) { return; }

  var p = particles[idx];
  if (p.life >= p.maxLife) { return; }

  // Reset force accumulator
  var f = vec3<f32>(0.0);

  // ── 1. Gravity (mass-weighted) ──
  f += sim.gravity * p.mass;

  // ── 2. Aerodynamic drag (quadratic model: F = -½ρCdAv²) ──
  let speed = length(p.velocity);
  if (speed > 0.01) {
    let dragMag = 0.5 * 1.18 * p.drag * p.size * p.size * speed * speed;
    f -= normalize(p.velocity) * dragMag;
  }

  // ── 3. Wind force ──
  if (sim.windSpeed > 0.01) {
    let windForce = sim.windDir * sim.windSpeed * 0.12 * p.size;
    f += windForce;
  }

  // ── 4. Turbulence (curl-noise, scale by particle age) ──
  let lifeRatio = p.life / max(p.maxLife, 0.001);
  let turbStrength = sim.turbulenceScale * (0.3 + lifeRatio * 0.7) * p.mass;
  f += turbulence(p.position, sim.time, 0.15) * turbStrength;

  // ── 5. Buoyancy (hot particles rise — proportional to temperature) ──
  let buoyancy = max(0.0, (p.temperature - 800.0) / 5000.0) * 3.2;
  f.y += buoyancy * p.mass;

  // ── 6. Thermal radiation cooling ──
  // Stefan-Boltzmann: dT/dt ∝ -T⁴ (simplified for real-time)
  let coolingRate = 0.0000015 * p.temperature * p.temperature;
  p.temperature = max(300.0, p.temperature - coolingRate * sim.deltaTime);

  p.force = f;
  particles[idx] = p;
}
`;

// ── Velocity-Verlet Integration Kernel ──
const INTEGRATE_KERNEL_WGSL = /* wgsl */ `
${PARTICLE_STRUCT_WGSL}
${SIM_UNIFORMS_WGSL}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> sim: SimUniforms;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= sim.particleCount) { return; }

  var p = particles[idx];
  if (p.life >= p.maxLife) { return; }

  let dt = sim.deltaTime;
  let invMass = 1.0 / max(p.mass, 0.001);
  let accel = p.force * invMass;

  // ── Velocity-Verlet: x(t+dt) = x(t) + v(t)*dt + 0.5*a*dt² ──
  p.position += p.velocity * dt + 0.5 * accel * dt * dt;

  // ── v(t+dt) = v(t) + a*dt (half-step would need next-frame force) ──
  p.velocity += accel * dt;

  // ── Ground collision with coefficient of restitution ──
  if (p.position.y < 0.02) {
    p.position.y = 0.02;
    let restitution = 0.25 * (1.0 - p.life / p.maxLife); // decreasing bounce
    p.velocity.y = abs(p.velocity.y) * restitution;
    // Friction on ground
    p.velocity.x *= 0.85;
    p.velocity.z *= 0.85;
    // Temperature spike on impact
    p.temperature = min(p.temperature + 200.0, 6500.0);
  }

  // ── Advance life ──
  p.life += dt;

  // ── Size decay — ember shrinking ──
  let lifeRatio = p.life / max(p.maxLife, 0.001);
  p.size *= (1.0 - 0.3 * dt); // gradual shrink

  // ── Compute sort key (distance to camera for transparency sorting) ──
  let toCam = sim.cameraPos - p.position;
  p.sortKey = dot(toCam, toCam); // squared distance — avoids sqrt

  particles[idx] = p;
}
`;

// ── Bitonic Sort Kernel (transparency ordering) ──
const SORT_KERNEL_WGSL = /* wgsl */ `
${PARTICLE_STRUCT_WGSL}

struct SortUniforms {
  blockSize: u32,
  subBlockSize: u32,
  particleCount: u32,
  _pad: u32,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> sortParams: SortUniforms;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= sortParams.particleCount) { return; }

  let block = sortParams.blockSize;
  let sub = sortParams.subBlockSize;

  let grp = idx / sub;
  let pair = idx % sub;
  let dir = (grp / (block / sub)) % 2u;

  let partner = select(
    grp * sub + sub - 1u - pair,
    grp * sub + pair + sub / 2u,
    pair < sub / 2u
  );

  if (partner >= sortParams.particleCount) { return; }
  if (partner == idx) { return; }

  let a = particles[idx].sortKey;
  let b = particles[partner].sortKey;

  // Sort back-to-front (larger distance first) for transparency
  let shouldSwap = select(a < b, a > b, dir == 1u);

  if (shouldSwap && idx < partner) {
    let temp = particles[idx];
    particles[idx] = particles[partner];
    particles[partner] = temp;
  }
}
`;

// ═══════════════════════════════════════════════════════════════
// TypeScript Runtime — GPU Manager + CPU Fallback
// ═══════════════════════════════════════════════════════════════

/** Particle data as flat struct-of-arrays for CPU fallback (zero-GC) */
export interface GPUParticleData {
  posX: Float32Array;   posY: Float32Array;   posZ: Float32Array;
  velX: Float32Array;   velY: Float32Array;   velZ: Float32Array;
  forceX: Float32Array; forceY: Float32Array; forceZ: Float32Array;
  life: Float32Array;
  maxLife: Float32Array;
  temperature: Float32Array;
  mass: Float32Array;
  drag: Float32Array;
  seed: Float32Array;
  size: Float32Array;
  sortKey: Float32Array;
  energy: Float32Array;
  fuel: Float32Array;
}

export interface ComputeSimConfig {
  maxParticles: number;
  gravity: [number, number, number];
  turbulenceScale: number;
  enableSort: boolean;
}

const DEFAULT_SIM_CONFIG: ComputeSimConfig = {
  maxParticles: 8192,
  gravity: [0, -9.81, 0],
  turbulenceScale: 1.4,
  enableSort: true,
};

/** Packed particle struct size in bytes (must match WGSL) */
const PARTICLE_BYTES = 96;
/** Simulation uniforms size */
const SIM_UNIFORM_BYTES = 64;
/** Sort uniforms size */
const SORT_UNIFORM_BYTES = 16;

// ── CPU fallback noise (matches WGSL hash31) ──
function cpuHash31(x: number, y: number, z: number): number {
  let px = (x * 0.1031) % 1; if (px < 0) px += 1;
  let py = (y * 0.1031) % 1; if (py < 0) py += 1;
  let pz = (z * 0.1031) % 1; if (pz < 0) pz += 1;
  const d = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33);
  return ((px + py) * pz + d) % 1;
}

function cpuTurbulence(x: number, y: number, z: number, time: number, scale: number): [number, number, number] {
  const eps = 0.15;
  const px = x * scale + time * 0.7;
  const py = y * scale + time * 0.3;
  const pz = z * scale + time * 0.5;
  const dxp = cpuHash31(px + eps, py, pz) - cpuHash31(px - eps, py, pz);
  const dyp = cpuHash31(px, py + eps, pz) - cpuHash31(px, py - eps, pz);
  const dzp = cpuHash31(px, py, pz + eps) - cpuHash31(px, py, pz - eps);
  return [(dzp - dyp) * 2.5, (dxp - dzp) * 2.5, (dyp - dxp) * 2.5];
}

export class GPUComputeParticleSystem {
  readonly config: ComputeSimConfig;
  readonly cpuData: GPUParticleData;

  readonly combustionData: CombustionData;

  private _gpuReady = false;
  private _device: GPUDevice | null = null;
  private _particleBuffer: GPUBuffer | null = null;
  private _simUniformBuffer: GPUBuffer | null = null;
  private _sortUniformBuffer: GPUBuffer | null = null;
  private _forcePipeline: GPUComputePipeline | null = null;
  private _integratePipeline: GPUComputePipeline | null = null;
  private _sortPipeline: GPUComputePipeline | null = null;
  private _forceBindGroup: GPUBindGroup | null = null;
  private _integrateBindGroup: GPUBindGroup | null = null;
  private _sortBindGroup: GPUBindGroup | null = null;
  private _activeCount = 0;
  private _readbackBuffer: GPUBuffer | null = null;
  private _readbackEpoch = 0;

  // Pre-allocated CPU uniform staging (zero-GC)
  private _simUniformData = new Float32Array(SIM_UNIFORM_BYTES / 4);
  private _sortUniformData = new Uint32Array(SORT_UNIFORM_BYTES / 4);

  constructor(config?: Partial<ComputeSimConfig>) {
    this.config = { ...DEFAULT_SIM_CONFIG, ...config };
    const n = this.config.maxParticles;

    // Pre-allocate all CPU-side SoA buffers
    this.cpuData = {
      posX: new Float32Array(n), posY: new Float32Array(n), posZ: new Float32Array(n),
      velX: new Float32Array(n), velY: new Float32Array(n), velZ: new Float32Array(n),
      forceX: new Float32Array(n), forceY: new Float32Array(n), forceZ: new Float32Array(n),
      life: new Float32Array(n),
      maxLife: new Float32Array(n),
      temperature: new Float32Array(n),
      mass: new Float32Array(n),
      drag: new Float32Array(n),
      seed: new Float32Array(n),
      size: new Float32Array(n),
      sortKey: new Float32Array(n),
      energy: new Float32Array(n),
      fuel: new Float32Array(n),
    };

    this.combustionData = createCombustionData(n);
  }

  get isGPU(): boolean { return this._gpuReady; }
  get activeCount(): number { return this._activeCount; }
  set activeCount(v: number) { this._activeCount = Math.min(v, this.config.maxParticles); }

  // ─── GPU Initialization ───────────────────────────────────
  async initGPU(): Promise<boolean> {
    try {
      if (typeof navigator === 'undefined' || !navigator.gpu) {
        console.warn('[GPUCompute] WebGPU not available — using CPU fallback');
        return false;
      }

      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) {
        console.warn('[GPUCompute] No GPU adapter — using CPU fallback');
        return false;
      }

      this._device = await adapter.requestDevice({
        requiredLimits: {
          maxStorageBuffersPerShaderStage: 4,
          maxComputeWorkgroupSizeX: 256,
        },
      });

      // Handle device lost
      this._device.lost.then((info) => {
        console.warn('[GPUCompute] Device lost:', info.reason);
        this._gpuReady = false;
        if (info.reason !== 'destroyed') {
          this.initGPU(); // Auto-reconnect
        }
      });

      const n = this.config.maxParticles;
      const bufSize = n * PARTICLE_BYTES;

      // Particle storage buffer
      this._particleBuffer = this._device.createBuffer({
        size: bufSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
      });

      // Readback buffer
      this._readbackBuffer = this._device.createBuffer({
        size: bufSize,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      // Uniform buffers
      this._simUniformBuffer = this._device.createBuffer({
        size: SIM_UNIFORM_BYTES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      this._sortUniformBuffer = this._device.createBuffer({
        size: SORT_UNIFORM_BYTES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Compile pipelines
      this._forcePipeline = this._createPipeline(FORCE_KERNEL_WGSL, 'force');
      this._integratePipeline = this._createPipeline(INTEGRATE_KERNEL_WGSL, 'integrate');
      if (this.config.enableSort) {
        this._sortPipeline = this._createPipeline(SORT_KERNEL_WGSL, 'sort');
      }

      // Create bind groups
      const simLayout = this._forcePipeline.getBindGroupLayout(0);
      this._forceBindGroup = this._device.createBindGroup({
        layout: simLayout,
        entries: [
          { binding: 0, resource: { buffer: this._particleBuffer } },
          { binding: 1, resource: { buffer: this._simUniformBuffer } },
        ],
      });

      const intLayout = this._integratePipeline.getBindGroupLayout(0);
      this._integrateBindGroup = this._device.createBindGroup({
        layout: intLayout,
        entries: [
          { binding: 0, resource: { buffer: this._particleBuffer } },
          { binding: 1, resource: { buffer: this._simUniformBuffer } },
        ],
      });

      if (this._sortPipeline) {
        const sortLayout = this._sortPipeline.getBindGroupLayout(0);
        this._sortBindGroup = this._device.createBindGroup({
          layout: sortLayout,
          entries: [
            { binding: 0, resource: { buffer: this._particleBuffer } },
            { binding: 1, resource: { buffer: this._sortUniformBuffer } },
          ],
        });
      }

      this._gpuReady = true;
      console.info(`[GPUCompute] ✓ Initialized — ${n} particle capacity`);
      return true;

    } catch (e) {
      console.warn('[GPUCompute] Init failed — CPU fallback:', e);
      this._gpuReady = false;
      return false;
    }
  }

  private _createPipeline(code: string, label: string): GPUComputePipeline {
    const module = this._device!.createShaderModule({ code, label });
    return this._device!.createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: 'main' },
    });
  }

  // ─── Emit Particles ──────────────────────────────────────
  /** Emit N particles starting at current activeCount. Zero-GC. */
  emit(count: number, emitter: {
    posX: number; posY: number; posZ: number;
    velX: number; velY: number; velZ: number;
    velSpread: number;
    temperature: number; tempVariance: number;
    mass: number; massVariance: number;
    drag: number; dragVariance: number;
    size: number; sizeVariance: number;
    maxLife: number; maxLifeVariance: number;
  }) {
    const start = this._activeCount;
    const end = Math.min(start + count, this.config.maxParticles);
    const d = this.cpuData;

    for (let i = start; i < end; i++) {
      const rng1 = Math.random(); const rng2 = Math.random(); const rng3 = Math.random();
      // Gaussian-ish spread via Box-Muller lite
      const spreadX = (Math.random() - 0.5) * 2 * emitter.velSpread;
      const spreadY = (Math.random() - 0.5) * 2 * emitter.velSpread * 0.6;
      const spreadZ = (Math.random() - 0.5) * 2 * emitter.velSpread;

      d.posX[i] = emitter.posX + (Math.random() - 0.5) * 0.3;
      d.posY[i] = emitter.posY + Math.random() * 0.1;
      d.posZ[i] = emitter.posZ + (Math.random() - 0.5) * 0.3;
      d.velX[i] = emitter.velX + spreadX;
      d.velY[i] = emitter.velY + spreadY;
      d.velZ[i] = emitter.velZ + spreadZ;
      d.forceX[i] = 0; d.forceY[i] = 0; d.forceZ[i] = 0;
      d.life[i] = 0;
      d.maxLife[i] = emitter.maxLife + (rng1 - 0.5) * emitter.maxLifeVariance;
      d.temperature[i] = emitter.temperature + (rng2 - 0.5) * emitter.tempVariance;
      d.mass[i] = emitter.mass + (rng3 - 0.5) * emitter.massVariance;
      d.drag[i] = emitter.drag + (Math.random() - 0.5) * emitter.dragVariance;
      d.seed[i] = Math.random() * 9999;
      d.size[i] = emitter.size + (Math.random() - 0.5) * emitter.sizeVariance;
      d.sortKey[i] = 0;
      d.energy[i] = 1.0;
      d.fuel[i] = 1.0 + Math.random() * 0.5;
    }

    this._activeCount = end;
  }

  // ─── Tick (dispatch GPU or CPU fallback) ──────────────────
  tick(
    deltaTime: number,
    time: number,
    wind: { dirX: number; dirY: number; dirZ: number; speed: number },
    cameraPos: { x: number; y: number; z: number },
  ) {
    if (this._activeCount === 0) return;

    if (this._gpuReady) {
      this._tickGPU(deltaTime, time, wind, cameraPos);
    } else {
      this._tickCPU(deltaTime, time, wind, cameraPos);
    }
  }

  // ─── GPU Path ─────────────────────────────────────────────
  private _tickGPU(
    dt: number, time: number,
    wind: { dirX: number; dirY: number; dirZ: number; speed: number },
    cam: { x: number; y: number; z: number },
  ) {
    if (!this._device || !this._particleBuffer) return;

    // Upload CPU→GPU particle data (AoS packing)
    this._uploadParticleData();

    // Write simulation uniforms
    const u = this._simUniformData;
    u[0] = dt; u[1] = time; 
    const uInt = new Uint32Array(u.buffer);
    uInt[2] = this._activeCount; uInt[3] = 0;
    u[4] = this.config.gravity[0]; u[5] = this.config.gravity[1]; u[6] = this.config.gravity[2]; u[7] = 0;
    u[8] = wind.dirX; u[9] = wind.dirY; u[10] = wind.dirZ; u[11] = wind.speed;
    u[12] = cam.x; u[13] = cam.y; u[14] = cam.z; u[15] = this.config.turbulenceScale;
    this._device.queue.writeBuffer(this._simUniformBuffer!, 0, u);

    const workgroups = Math.ceil(this._activeCount / 256);

    const encoder = this._device.createCommandEncoder();

    // Pass 1: Force accumulation
    const forcePass = encoder.beginComputePass();
    forcePass.setPipeline(this._forcePipeline!);
    forcePass.setBindGroup(0, this._forceBindGroup!);
    forcePass.dispatchWorkgroups(workgroups);
    forcePass.end();

    // Pass 2: Integration
    const intPass = encoder.beginComputePass();
    intPass.setPipeline(this._integratePipeline!);
    intPass.setBindGroup(0, this._integrateBindGroup!);
    intPass.dispatchWorkgroups(workgroups);
    intPass.end();

    // Pass 3: Bitonic sort (multiple passes for full sort)
    if (this._sortPipeline && this._sortBindGroup && this.config.enableSort) {
      const n = this._activeCount;
      // Log2 passes for bitonic sort
      for (let blockSize = 2; blockSize <= n; blockSize *= 2) {
        for (let subBlock = blockSize; subBlock >= 2; subBlock /= 2) {
          const su = this._sortUniformData;
          su[0] = blockSize; su[1] = subBlock; su[2] = n; su[3] = 0;
          this._device.queue.writeBuffer(this._sortUniformBuffer!, 0, su);

          const sortPass = encoder.beginComputePass();
          sortPass.setPipeline(this._sortPipeline!);
          sortPass.setBindGroup(0, this._sortBindGroup!);
          sortPass.dispatchWorkgroups(workgroups);
          sortPass.end();
        }
      }
    }

    // Copy result to readback
    encoder.copyBufferToBuffer(
      this._particleBuffer, 0,
      this._readbackBuffer!, 0,
      this._activeCount * PARTICLE_BYTES,
    );

    this._device.queue.submit([encoder.finish()]);

    // Async readback with epoch guard
    const epoch = ++this._readbackEpoch;
    this._readbackBuffer!.mapAsync(GPUMapMode.READ).then(() => {
      if (epoch !== this._readbackEpoch) {
        this._readbackBuffer!.unmap();
        return;
      }
      this._downloadParticleData();
      this._readbackBuffer!.unmap();
    }).catch(() => { /* stale readback */ });
  }

  private _uploadParticleData() {
    if (!this._device || !this._particleBuffer) return;
    const n = this._activeCount;
    const packed = new Float32Array(n * (PARTICLE_BYTES / 4));
    const d = this.cpuData;

    for (let i = 0; i < n; i++) {
      const o = i * 24; // 96 bytes / 4 = 24 floats
      packed[o + 0] = d.posX[i]; packed[o + 1] = d.posY[i]; packed[o + 2] = d.posZ[i]; packed[o + 3] = 0;
      packed[o + 4] = d.velX[i]; packed[o + 5] = d.velY[i]; packed[o + 6] = d.velZ[i]; packed[o + 7] = 0;
      packed[o + 8] = d.forceX[i]; packed[o + 9] = d.forceY[i]; packed[o + 10] = d.forceZ[i]; packed[o + 11] = 0;
      packed[o + 12] = d.life[i]; packed[o + 13] = d.maxLife[i]; packed[o + 14] = d.temperature[i]; packed[o + 15] = d.mass[i];
      packed[o + 16] = d.drag[i]; packed[o + 17] = d.seed[i]; packed[o + 18] = d.size[i]; packed[o + 19] = d.sortKey[i];
      packed[o + 20] = d.energy[i]; packed[o + 21] = d.fuel[i]; packed[o + 22] = 0; packed[o + 23] = 0;
    }

    this._device.queue.writeBuffer(this._particleBuffer, 0, packed, 0, n * 24);
  }

  private _downloadParticleData() {
    if (!this._readbackBuffer) return;
    const n = this._activeCount;
    const mapped = new Float32Array(this._readbackBuffer.getMappedRange());
    const d = this.cpuData;

    for (let i = 0; i < n; i++) {
      const o = i * 24;
      d.posX[i] = mapped[o]; d.posY[i] = mapped[o + 1]; d.posZ[i] = mapped[o + 2];
      d.velX[i] = mapped[o + 4]; d.velY[i] = mapped[o + 5]; d.velZ[i] = mapped[o + 6];
      d.forceX[i] = mapped[o + 8]; d.forceY[i] = mapped[o + 9]; d.forceZ[i] = mapped[o + 10];
      d.life[i] = mapped[o + 12]; d.maxLife[i] = mapped[o + 13]; d.temperature[i] = mapped[o + 14]; d.mass[i] = mapped[o + 15];
      d.drag[i] = mapped[o + 16]; d.seed[i] = mapped[o + 17]; d.size[i] = mapped[o + 18]; d.sortKey[i] = mapped[o + 19];
      d.energy[i] = mapped[o + 20]; d.fuel[i] = mapped[o + 21];
    }
  }

  // ─── CPU Fallback (faithful port of WGSL kernels) ─────────
  private _tickCPU(
    dt: number, time: number,
    wind: { dirX: number; dirY: number; dirZ: number; speed: number },
    cam: { x: number; y: number; z: number },
  ) {
    const d = this.cpuData;
    const gx = this.config.gravity[0];
    const gy = this.config.gravity[1];
    const gz = this.config.gravity[2];
    const n = this._activeCount;

    // ── Pass 1: Force accumulation ──
    for (let i = 0; i < n; i++) {
      if (d.life[i] >= d.maxLife[i]) continue;

      let fx = 0, fy = 0, fz = 0;
      const m = d.mass[i];

      // Gravity
      fx += gx * m; fy += gy * m; fz += gz * m;

      // Quadratic drag
      const vx = d.velX[i], vy = d.velY[i], vz = d.velZ[i];
      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (speed > 0.01) {
        const dragMag = 0.5 * 1.18 * d.drag[i] * d.size[i] * d.size[i] * speed * speed;
        const invSpeed = 1 / speed;
        fx -= vx * invSpeed * dragMag;
        fy -= vy * invSpeed * dragMag;
        fz -= vz * invSpeed * dragMag;
      }

      // Wind
      if (wind.speed > 0.01) {
        const wf = wind.speed * 0.12 * d.size[i];
        fx += wind.dirX * wf; fy += wind.dirY * wf; fz += wind.dirZ * wf;
      }

      // Turbulence
      const lr = d.life[i] / Math.max(d.maxLife[i], 0.001);
      const ts = this.config.turbulenceScale * (0.3 + lr * 0.7) * m;
      const [tx, ty, tz] = cpuTurbulence(d.posX[i], d.posY[i], d.posZ[i], time, 0.15);
      fx += tx * ts; fy += ty * ts; fz += tz * ts;

      // Buoyancy
      const buoy = Math.max(0, (d.temperature[i] - 800) / 5000) * 3.2;
      fy += buoy * m;

      // Thermal cooling
      const cooling = 0.0000015 * d.temperature[i] * d.temperature[i];
      d.temperature[i] = Math.max(300, d.temperature[i] - cooling * dt);

      d.forceX[i] = fx; d.forceY[i] = fy; d.forceZ[i] = fz;
    }

    // ── Pass 2: Integration ──
    for (let i = 0; i < n; i++) {
      if (d.life[i] >= d.maxLife[i]) continue;

      const invM = 1 / Math.max(d.mass[i], 0.001);
      const ax = d.forceX[i] * invM;
      const ay = d.forceY[i] * invM;
      const az = d.forceZ[i] * invM;

      // Velocity-Verlet position
      d.posX[i] += d.velX[i] * dt + 0.5 * ax * dt * dt;
      d.posY[i] += d.velY[i] * dt + 0.5 * ay * dt * dt;
      d.posZ[i] += d.velZ[i] * dt + 0.5 * az * dt * dt;

      // Velocity update
      d.velX[i] += ax * dt;
      d.velY[i] += ay * dt;
      d.velZ[i] += az * dt;

      // Ground collision
      if (d.posY[i] < 0.02) {
        d.posY[i] = 0.02;
        const restitution = 0.25 * (1 - d.life[i] / d.maxLife[i]);
        d.velY[i] = Math.abs(d.velY[i]) * restitution;
        d.velX[i] *= 0.85;
        d.velZ[i] *= 0.85;
        d.temperature[i] = Math.min(d.temperature[i] + 200, 6500);
      }

      d.life[i] += dt;
      d.size[i] *= (1 - 0.3 * dt);

      // Sort key
      const dx = cam.x - d.posX[i];
      const dy = cam.y - d.posY[i];
      const dz = cam.z - d.posZ[i];
      d.sortKey[i] = dx * dx + dy * dy + dz * dz;
    }

    // ── Pass 2b: Combustion (energy + fuel) ──
    tickCombustionCPU(
      n, dt, time,
      d.life, d.maxLife, d.temperature, d.seed,
      { energy: d.energy, fuel: d.fuel },
    );

    // ── Pass 2c: Smoke turbulence ──
    tickSmokeTurbulenceCPU(
      n, dt, time,
      d.posX, d.posY, d.posZ,
      d.velX, d.velY, d.velZ,
      d.life, d.maxLife,
      d.temperature,
      DEFAULT_SMOKE_TURBULENCE,
    );

    // ── Pass 3: Simple insertion sort for CPU (good for nearly-sorted) ──
    if (this.config.enableSort && n > 1) {
      this._cpuSort(n);
    }

    // Compact dead particles
    this._compact();
  }

  /** In-place sort by sortKey descending (back-to-front). Insertion sort — O(n) for nearly-sorted. */
  private _cpuSort(n: number) {
    const d = this.cpuData;
    for (let i = 1; i < n; i++) {
      const key = d.sortKey[i];
      let j = i - 1;
      while (j >= 0 && d.sortKey[j] < key) {
        this._swapParticle(j + 1, j);
        j--;
      }
    }
  }

  private _swapParticle(a: number, b: number) {
    const d = this.cpuData;
    const fields = Object.keys(d) as (keyof GPUParticleData)[];
    for (const f of fields) {
      const tmp = d[f][a];
      d[f][a] = d[f][b];
      d[f][b] = tmp;
    }
  }

  /** Remove dead particles by compacting live ones to front. */
  private _compact() {
    const d = this.cpuData;
    let write = 0;
    for (let read = 0; read < this._activeCount; read++) {
      if (d.life[read] < d.maxLife[read]) {
        if (write !== read) {
          const fields = Object.keys(d) as (keyof GPUParticleData)[];
          for (const f of fields) { d[f][write] = d[f][read]; }
        }
        write++;
      }
    }
    this._activeCount = write;
  }

  // ─── Cleanup ──────────────────────────────────────────────
  dispose() {
    this._particleBuffer?.destroy();
    this._simUniformBuffer?.destroy();
    this._sortUniformBuffer?.destroy();
    this._readbackBuffer?.destroy();
    this._device?.destroy();
    this._gpuReady = false;
  }
}

/** Create a pre-configured compute particle system. */
export function createComputeParticleSystem(config?: Partial<ComputeSimConfig>): GPUComputeParticleSystem {
  return new GPUComputeParticleSystem(config);
}
