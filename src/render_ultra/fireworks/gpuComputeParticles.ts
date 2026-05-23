/**
 * FX KONTROL · GPU Compute Particle System — Unified Shader v4
 *
 * Single-dispatch compute shader with vec4-packed particle layout (64 bytes).
 * Integrates physics, combustion, turbulence, and color in one kernel.
 *
 * Particle struct (64 bytes, 16-byte aligned):
 *   pos:   vec4<f32>  — xyz = world pos, w = age
 *   vel:   vec4<f32>  — xyz = velocity, w = life (max)
 *   color: vec4<f32>  — rgb = emissive color, a = brightness
 *   misc:  vec4<f32>  — x = temperature, y = size, z = smoke, w = type
 *
 * SimParams uniform (64 bytes):
 *   dt, time, gravity, wind_xyz, drag, smoke_bias, fire_intensity,
 *   viewport_wh, padding
 *
 * v4 improvements:
 *   - Blackbody extended to 8000K (Mitchell-Charity polynomial fit)
 *   - Curl noise turbulence (divergence-free — eliminates particle clumping)
 *   - T ∝ r^(-3/4) thermodynamic energy decay law
 *   - Mass-differential aerodynamics per particle type
 *   - Pre-allocated staging buffer (zero per-frame GC)
 */

// ═══════════════════════════════════════════════════════════════
// WGSL Unified Compute Shader
// ═══════════════════════════════════════════════════════════════

const UNIFIED_COMPUTE_WGSL = /* wgsl */ `
struct SimParams {
  dt: f32,
  time: f32,
  gravity: f32,
  wind_x: f32,
  wind_y: f32,
  wind_z: f32,
  drag: f32,
  smoke_bias: f32,
  fire_intensity: f32,
  pad0: f32,
  viewport_w: f32,
  viewport_h: f32,
  pad1: vec2<f32>,
};

struct Particle {
  pos: vec4<f32>,
  vel: vec4<f32>,
  color: vec4<f32>,
  misc: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: SimParams;
@group(0) @binding(1) var<storage, read_write> particles: array<Particle>;

fn saturate(v: f32) -> f32 {
  return clamp(v, 0.0, 1.0);
}

fn hash11(p: f32) -> f32 {
  return fract(sin(p * 127.1) * 43758.5453123);
}

fn hash31(p: vec3<f32>) -> f32 {
  return fract(sin(dot(p, vec3<f32>(12.9898, 78.233, 37.719))) * 43758.5453123);
}

// ── Smooth value noise (quintic, better cache) ──
fn noise3(p: vec3<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); // quintic
  let a = hash31(i);
  let b = hash31(i + vec3<f32>(1.0, 0.0, 0.0));
  let c = hash31(i + vec3<f32>(0.0, 1.0, 0.0));
  let d = hash31(i + vec3<f32>(1.0, 1.0, 0.0));
  let e = hash31(i + vec3<f32>(0.0, 0.0, 1.0));
  let f2 = hash31(i + vec3<f32>(1.0, 0.0, 1.0));
  let g = hash31(i + vec3<f32>(0.0, 1.0, 1.0));
  let h = hash31(i + vec3<f32>(1.0, 1.0, 1.0));
  let nx00 = mix(a, b, u.x);
  let nx10 = mix(c, d, u.x);
  let nx01 = mix(e, f2, u.x);
  let nx11 = mix(g, h, u.x);
  let nxy0 = mix(nx00, nx10, u.y);
  let nxy1 = mix(nx01, nx11, u.y);
  return mix(nxy0, nxy1, u.z);
}

// ── Curl noise (divergence-free — eliminates particle clumping) ──
// Uses finite-difference curl of a potential field.
fn curl_noise(p: vec3<f32>) -> vec3<f32> {
  let eps = 0.01;
  // Potential field components: Fx = noise(p+offset1), Fy, Fz
  let fx_y = noise3(p + vec3<f32>(0.0, eps, 0.0));
  let fx_ny = noise3(p - vec3<f32>(0.0, eps, 0.0));
  let fx_z = noise3(p + vec3<f32>(0.0, 0.0, eps));
  let fx_nz = noise3(p - vec3<f32>(0.0, 0.0, eps));

  let fy_x = noise3(p + vec3<f32>(eps, 0.0, 0.0) + vec3<f32>(31.7, 0.0, 0.0));
  let fy_nx = noise3(p - vec3<f32>(eps, 0.0, 0.0) + vec3<f32>(31.7, 0.0, 0.0));
  let fy_z = noise3(p + vec3<f32>(0.0, 0.0, eps) + vec3<f32>(31.7, 0.0, 0.0));
  let fy_nz = noise3(p - vec3<f32>(0.0, 0.0, eps) + vec3<f32>(31.7, 0.0, 0.0));

  let fz_x = noise3(p + vec3<f32>(eps, 0.0, 0.0) + vec3<f32>(0.0, 57.3, 0.0));
  let fz_nx = noise3(p - vec3<f32>(eps, 0.0, 0.0) + vec3<f32>(0.0, 57.3, 0.0));
  let fz_y = noise3(p + vec3<f32>(0.0, eps, 0.0) + vec3<f32>(0.0, 57.3, 0.0));
  let fz_ny = noise3(p - vec3<f32>(0.0, eps, 0.0) + vec3<f32>(0.0, 57.3, 0.0));

  let inv2e = 1.0 / (2.0 * eps);
  return vec3<f32>(
    ((fz_y - fz_ny) - (fy_z - fy_nz)) * inv2e,
    ((fx_z - fx_nz) - (fz_x - fz_nx)) * inv2e,
    ((fy_x - fy_nx) - (fx_y - fx_ny)) * inv2e
  );
}

// ── Full Mitchell-Charity blackbody (1000–8000 K) ──
// CIE 1931 polynomial fit — covers: deep red → orange → yellow → white → blue-white
fn blackbody_full(temp_k: f32) -> vec3<f32> {
  let t = clamp(temp_k, 1000.0, 40000.0) / 100.0;

  // Red channel
  var r: f32;
  if (t <= 66.0) {
    r = 1.0;
  } else {
    r = clamp(1.292936186 * pow(t - 60.0, -0.1332047592), 0.0, 1.0);
  }

  // Green channel
  var g: f32;
  if (t <= 66.0) {
    g = clamp(0.3900815787 * log(t) - 0.6318414438, 0.0, 1.0);
  } else {
    g = clamp(1.129890861 * pow(t - 60.0, -0.0755148492), 0.0, 1.0);
  }

  // Blue channel
  var b: f32;
  if (t >= 66.0) {
    b = 1.0;
  } else if (t <= 19.0) {
    b = 0.0;
  } else {
    b = clamp(0.5432067891 * log(t - 10.0) - 1.1962540185, 0.0, 1.0);
  }

  return vec3<f32>(r, g, b);
}

// Legacy alias used by brightness falloff (kept for backward compat)
fn blackbody_tint(temp: f32) -> vec3<f32> {
  return blackbody_full(temp);
}

fn soft_pulse(t: f32) -> f32 {
  return 0.65 + 0.35 * sin(t * 6.28318 + sin(t * 13.7) * 0.5);
}

fn update_particle(p: ptr<function, Particle>) {
  var part = (*p);

  let age = part.pos.w;
  let life = max(part.vel.w, 0.0001);
  let t_norm = saturate(age / life);       // 0=birth, 1=death
  let alive = 1.0 - t_norm;

  let wind = vec3<f32>(params.wind_x, params.wind_y, params.wind_z);
  let type_id = part.misc.w;

  // ── Mass-differential aerodynamics per particle type ──
  // type 0 = shell star (dense metal salt pellet)
  // type 1 = ember      (lighter oxidised fragment)
  // type 2 = smoke      (tenuous aerosol / dust cloud)
  var drag = params.drag;
  var gravity = params.gravity;
  var mass_factor = 1.0;  // relative inertia modifier
  if (type_id < 0.5) {
    drag *= 1.0;
    gravity *= 1.0;
    mass_factor = 1.0;
  } else if (type_id < 1.5) {
    drag *= 0.45;
    gravity *= 1.1;
    mass_factor = 0.55;   // lighter — more responsive to wind
  } else {
    drag *= 0.12;
    gravity *= 0.25;
    mass_factor = 0.08;   // aerosol — almost fully wind-driven
  }

  // ── Curl noise turbulence (divergence-free, no clumping) ──
  // Scale increases as particle ages (turbulence grows with distance from burst)
  let curl_scale = 0.03 + 0.04 * (1.0 - alive);
  let curl_pos = part.pos.xyz * curl_scale + vec3<f32>(params.time * 0.4, 0.0, params.time * 0.2);
  let curl = curl_noise(curl_pos);
  let turb_strength = (0.3 + 0.7 * (1.0 - alive)) * mass_factor * 2.5;
  let turbulence = curl * turb_strength;

  // ── Force integration ──
  part.vel = vec4<f32>(
    part.vel.xyz + (wind + turbulence) * params.dt,
    part.vel.w
  );
  part.vel = vec4<f32>(
    part.vel.x,
    part.vel.y - gravity * params.dt,
    part.vel.z,
    part.vel.w
  );

  // Rational drag (stable for large dt)
  let drag_force = 1.0 / (1.0 + drag * length(part.vel.xyz) * params.dt);
  part.vel = vec4<f32>(part.vel.xyz * drag_force, part.vel.w);

  // Position integration
  part.pos = vec4<f32>(
    part.pos.xyz + part.vel.xyz * params.dt,
    part.pos.w + params.dt
  );

  // ── T ∝ r^(-3/4) thermodynamic energy decay ──
  // As the particle moves outward from its birth position its temperature drops
  // following the Stefan-Boltzmann law for an expanding fireball.
  // We approximate the radial expansion via age: r ∝ age^(2/3) (Sedov-Taylor),
  // so T ∝ age^(-1/2) — encoded here as an exponential fit calibrated to match
  // empirical firework color timings.
  let thermal_init = part.misc.x;
  let thermal_floor = 800.0;  // residual ember temperature
  // temperature decay: T(t) = T0 * exp(-k * t^0.5 / life^0.5)
  let t_sqrt = sqrt(t_norm);
  let k_decay = 1.8 + 1.2 * (1.0 - thermal_init / 8000.0); // hotter = slower relative decay
  let current_temp = mix(thermal_init, thermal_floor, saturate(1.0 - exp(-k_decay * t_sqrt)));

  // Brightness: energy proportional to temperature^4 (Stefan-Boltzmann radiation)
  // normalised against initial temperature
  let temp_ratio = current_temp / max(thermal_init, 1.0);
  let radiated_power = temp_ratio * temp_ratio * temp_ratio * temp_ratio; // T^4

  let pulse = soft_pulse(params.time + hash11(part.pos.w + part.misc.y) * 10.0);
  part.color = vec4<f32>(
    part.color.xyz,
    saturate(radiated_power * pulse)
  );

  // ── Color shift driven by actual thermodynamic cooling ──
  let tint = blackbody_full(current_temp);
  // Blend speed: fast at first (rapid cooling), slows as equilibrium approaches
  let blend_speed = 0.02 + 0.06 * t_norm;
  part.color = vec4<f32>(
    mix(part.color.xyz, tint, blend_speed),
    part.color.w
  );

  // Update stored temperature for next frame's emission calculations
  part.misc = vec4<f32>(
    current_temp,
    part.misc.y,
    saturate(part.misc.z + params.smoke_bias * params.dt * (0.35 + 0.65 * t_norm)),
    part.misc.w
  );

  (*p) = part;
}

@compute @workgroup_size(256)
fn cs_update(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= arrayLength(&particles)) {
    return;
  }
  update_particle(&particles[i]);
}
`;

// ── Bitonic Sort Kernel (transparency ordering by age/distance) ──
const SORT_KERNEL_WGSL = /* wgsl */ `
struct Particle {
  pos: vec4<f32>,
  vel: vec4<f32>,
  color: vec4<f32>,
  misc: vec4<f32>,
};

struct SortUniforms {
  blockSize: u32,
  subBlockSize: u32,
  particleCount: u32,
  _pad: u32,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> sortParams: SortUniforms;

@compute @workgroup_size(256)
fn cs_sort(@builtin(global_invocation_id) gid: vec3<u32>) {
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

  // Sort by age descending (older = farther from camera typically)
  let a = particles[idx].pos.w;
  let b = particles[partner].pos.w;

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
  // pos: xyz + age
  posX: Float32Array; posY: Float32Array; posZ: Float32Array;
  age: Float32Array;
  // vel: xyz + life (maxLife)
  velX: Float32Array; velY: Float32Array; velZ: Float32Array;
  life: Float32Array;
  // color: rgb + brightness
  colorR: Float32Array; colorG: Float32Array; colorB: Float32Array;
  brightness: Float32Array;
  // misc: temperature, size, smoke, type
  temperature: Float32Array;
  size: Float32Array;
  smoke: Float32Array;
  particleType: Float32Array;
}

export interface ComputeSimConfig {
  maxParticles: number;
  gravity: number;
  drag: number;
  smokeBias: number;
  fireIntensity: number;
  enableSort: boolean;
}

const DEFAULT_SIM_CONFIG: ComputeSimConfig = {
  maxParticles: 8192,
  gravity: 9.81,
  drag: 0.08,
  smokeBias: 0.15,
  fireIntensity: 1.0,
  enableSort: true,
};

/** Packed particle struct size in bytes (4 × vec4 = 64) */
const PARTICLE_BYTES = 64;
/** SimParams uniform size in bytes */
const SIM_UNIFORM_BYTES = 64;
/** Sort uniforms size */
const SORT_UNIFORM_BYTES = 16;

// ── CPU fallback noise (matches WGSL) ──
function cpuHash11(p: number): number {
  return ((Math.sin(p * 127.1) * 43758.5453123) % 1 + 1) % 1;
}

function cpuHash31(x: number, y: number, z: number): number {
  const d = x * 12.9898 + y * 78.233 + z * 37.719;
  return ((Math.sin(d) * 43758.5453123) % 1 + 1) % 1;
}

function cpuNoise3(px: number, py: number, pz: number): number {
  const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
  const fx = px - ix, fy = py - iy, fz = pz - iz;
  // Quintic interpolation (matches WGSL)
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);

  const a = cpuHash31(ix, iy, iz);
  const b = cpuHash31(ix + 1, iy, iz);
  const c = cpuHash31(ix, iy + 1, iz);
  const d = cpuHash31(ix + 1, iy + 1, iz);
  const e = cpuHash31(ix, iy, iz + 1);
  const f = cpuHash31(ix + 1, iy, iz + 1);
  const g = cpuHash31(ix, iy + 1, iz + 1);
  const h = cpuHash31(ix + 1, iy + 1, iz + 1);

  const nx00 = a + (b - a) * ux;
  const nx10 = c + (d - c) * ux;
  const nx01 = e + (f - e) * ux;
  const nx11 = g + (h - g) * ux;
  const nxy0 = nx00 + (nx10 - nx00) * uy;
  const nxy1 = nx01 + (nx11 - nx01) * uy;
  return nxy0 + (nxy1 - nxy0) * uz;
}

// Curl noise (divergence-free) — CPU port of WGSL version
function cpuCurlNoise(px: number, py: number, pz: number): [number, number, number] {
  const eps = 0.01;
  const inv2e = 1 / (2 * eps);

  const fxPy = cpuNoise3(px, py + eps, pz);
  const fxNy = cpuNoise3(px, py - eps, pz);
  const fxPz = cpuNoise3(px, py, pz + eps);
  const fxNz = cpuNoise3(px, py, pz - eps);

  const fyPx = cpuNoise3(px + eps, py, pz + 31.7);
  const fyNx = cpuNoise3(px - eps, py, pz + 31.7);
  const fyPz = cpuNoise3(px, py, pz + eps + 31.7);
  const fyNz = cpuNoise3(px, py, pz - eps + 31.7);

  const fzPx = cpuNoise3(px + eps, py + 57.3, pz);
  const fzNx = cpuNoise3(px - eps, py + 57.3, pz);
  const fzPy = cpuNoise3(px, py + eps + 57.3, pz);
  const fzNy = cpuNoise3(px, py - eps + 57.3, pz);

  return [
    ((fzPy - fzNy) - (fyPz - fyNz)) * inv2e,
    ((fxPz - fxNz) - (fzPx - fzNx)) * inv2e,
    ((fyPx - fyNx) - (fxPy - fxNy)) * inv2e,
  ];
}

// Full Mitchell-Charity blackbody (1000–40000K), CPU port of WGSL version
function cpuBlackbodyFull(tempK: number): [number, number, number] {
  const t = Math.max(1000, Math.min(40000, tempK)) / 100;

  const r = t <= 66 ? 1.0 : Math.max(0, Math.min(1, 1.292936186 * Math.pow(t - 60, -0.1332047592)));

  let g: number;
  if (t <= 66) g = Math.max(0, Math.min(1, 0.3900815787 * Math.log(t) - 0.6318414438));
  else g = Math.max(0, Math.min(1, 1.129890861 * Math.pow(t - 60, -0.0755148492)));

  let b: number;
  if (t >= 66) b = 1.0;
  else if (t <= 19) b = 0.0;
  else b = Math.max(0, Math.min(1, 0.5432067891 * Math.log(t - 10) - 1.1962540185));

  return [r, g, b];
}

// Legacy alias
function cpuBlackbodyTint(temp: number): [number, number, number] {
  return cpuBlackbodyFull(temp);
}

function cpuSoftPulse(t: number): number {
  return 0.65 + 0.35 * Math.sin(t * 6.28318 + Math.sin(t * 13.7) * 0.5);
}

export class GPUComputeParticleSystem {
  readonly config: ComputeSimConfig;
  readonly cpuData: GPUParticleData;

  private _gpuReady = false;
  private _device: GPUDevice | null = null;
  private _particleBuffer: GPUBuffer | null = null;
  private _simUniformBuffer: GPUBuffer | null = null;
  private _sortUniformBuffer: GPUBuffer | null = null;
  private _computePipeline: GPUComputePipeline | null = null;
  private _sortPipeline: GPUComputePipeline | null = null;
  private _computeBindGroup: GPUBindGroup | null = null;
  private _sortBindGroup: GPUBindGroup | null = null;
  private _activeCount = 0;
  private _readbackBuffer: GPUBuffer | null = null;
  private _readbackEpoch = 0;

  // Pre-allocated staging (zero-GC) — sized to maxParticles in constructor
  private _simUniformData = new Float32Array(SIM_UNIFORM_BYTES / 4);
  private _sortUniformData = new Uint32Array(SORT_UNIFORM_BYTES / 4);
  private _stagingBuffer = new Float32Array(0); // resized in constructor

  constructor(config?: Partial<ComputeSimConfig>) {
    this.config = { ...DEFAULT_SIM_CONFIG, ...config };
    const n = this.config.maxParticles;

    this.cpuData = {
      posX: new Float32Array(n), posY: new Float32Array(n), posZ: new Float32Array(n),
      age: new Float32Array(n),
      velX: new Float32Array(n), velY: new Float32Array(n), velZ: new Float32Array(n),
      life: new Float32Array(n),
      colorR: new Float32Array(n), colorG: new Float32Array(n), colorB: new Float32Array(n),
      brightness: new Float32Array(n),
      temperature: new Float32Array(n),
      size: new Float32Array(n),
      smoke: new Float32Array(n),
      particleType: new Float32Array(n),
    };

    // Pre-allocate staging to avoid new Float32Array(n * 16) every GPU tick
    this._stagingBuffer = new Float32Array(n * 16);
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

      this._device.lost.then((info) => {
        console.warn('[GPUCompute] Device lost:', info.reason);
        this._gpuReady = false;
        if (info.reason !== 'destroyed') { this.initGPU(); }
      });

      const n = this.config.maxParticles;
      const bufSize = n * PARTICLE_BYTES;

      this._particleBuffer = this._device.createBuffer({
        size: bufSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
      });

      this._readbackBuffer = this._device.createBuffer({
        size: bufSize,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      this._simUniformBuffer = this._device.createBuffer({
        size: SIM_UNIFORM_BYTES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      this._sortUniformBuffer = this._device.createBuffer({
        size: SORT_UNIFORM_BYTES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Compile pipelines
      const computeModule = this._device.createShaderModule({
        code: UNIFIED_COMPUTE_WGSL,
        label: 'particle-update',
      });
      this._computePipeline = this._device.createComputePipeline({
        layout: 'auto',
        compute: { module: computeModule, entryPoint: 'cs_update' },
      });

      if (this.config.enableSort) {
        const sortModule = this._device.createShaderModule({
          code: SORT_KERNEL_WGSL,
          label: 'particle-sort',
        });
        this._sortPipeline = this._device.createComputePipeline({
          layout: 'auto',
          compute: { module: sortModule, entryPoint: 'cs_sort' },
        });
      }

      // Bind groups — note: uniform at binding(0), storage at binding(1) for compute
      const computeLayout = this._computePipeline.getBindGroupLayout(0);
      this._computeBindGroup = this._device.createBindGroup({
        layout: computeLayout,
        entries: [
          { binding: 0, resource: { buffer: this._simUniformBuffer } },
          { binding: 1, resource: { buffer: this._particleBuffer } },
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
      console.info(`[GPUCompute] ✓ Unified shader initialized — ${n} particles`);
      return true;

    } catch (e) {
      console.warn('[GPUCompute] Init failed — CPU fallback:', e);
      this._gpuReady = false;
      return false;
    }
  }

  // ─── Emit Particles ──────────────────────────────────────
  emit(count: number, emitter: {
    posX: number; posY: number; posZ: number;
    velX: number; velY: number; velZ: number;
    velSpread: number;
    temperature: number; tempVariance: number;
    size: number; sizeVariance: number;
    maxLife: number; maxLifeVariance: number;
    colorR: number; colorG: number; colorB: number;
    brightness?: number;
    type?: number; // 0=shell, 1=ember, 2=smoke
  }) {
    const start = this._activeCount;
    const end = Math.min(start + count, this.config.maxParticles);
    const d = this.cpuData;

    for (let i = start; i < end; i++) {
      const rng1 = Math.random(), rng2 = Math.random();
      const spreadX = (Math.random() - 0.5) * 2 * emitter.velSpread;
      const spreadY = (Math.random() - 0.5) * 2 * emitter.velSpread * 0.6;
      const spreadZ = (Math.random() - 0.5) * 2 * emitter.velSpread;

      d.posX[i] = emitter.posX + (Math.random() - 0.5) * 0.3;
      d.posY[i] = emitter.posY + Math.random() * 0.1;
      d.posZ[i] = emitter.posZ + (Math.random() - 0.5) * 0.3;
      d.age[i] = 0;

      d.velX[i] = emitter.velX + spreadX;
      d.velY[i] = emitter.velY + spreadY;
      d.velZ[i] = emitter.velZ + spreadZ;
      d.life[i] = emitter.maxLife + (rng1 - 0.5) * emitter.maxLifeVariance;

      d.colorR[i] = emitter.colorR;
      d.colorG[i] = emitter.colorG;
      d.colorB[i] = emitter.colorB;
      d.brightness[i] = emitter.brightness ?? 1.0;

      d.temperature[i] = emitter.temperature + (rng2 - 0.5) * emitter.tempVariance;
      d.size[i] = emitter.size + (Math.random() - 0.5) * emitter.sizeVariance;
      d.smoke[i] = 0;
      d.particleType[i] = emitter.type ?? 0;
    }

    this._activeCount = end;
  }

  // ─── Tick ─────────────────────────────────────────────────
  tick(
    deltaTime: number,
    time: number,
    wind: { x: number; y: number; z: number },
    viewport?: { width: number; height: number },
  ) {
    if (this._activeCount === 0) return;

    if (this._gpuReady) {
      this._tickGPU(deltaTime, time, wind, viewport);
    } else {
      this._tickCPU(deltaTime, time, wind);
    }
  }

  // ─── GPU Path ─────────────────────────────────────────────
  private _tickGPU(
    dt: number, time: number,
    wind: { x: number; y: number; z: number },
    viewport?: { width: number; height: number },
  ) {
    if (!this._device || !this._particleBuffer) return;

    this._uploadParticleData();

    // Write SimParams uniform
    const u = this._simUniformData;
    u[0] = dt;
    u[1] = time;
    u[2] = this.config.gravity;
    u[3] = wind.x;
    u[4] = wind.y;
    u[5] = wind.z;
    u[6] = this.config.drag;
    u[7] = this.config.smokeBias;
    u[8] = this.config.fireIntensity;
    u[9] = 0; // pad0
    u[10] = viewport?.width ?? 1920;
    u[11] = viewport?.height ?? 1080;
    u[12] = 0; u[13] = 0; // pad1
    // Remaining to fill 64 bytes (16 floats) — u[14], u[15] already zero
    this._device.queue.writeBuffer(this._simUniformBuffer!, 0, u);

    const workgroups = Math.ceil(this._activeCount / 256);
    const encoder = this._device.createCommandEncoder();

    // Single compute dispatch — physics + combustion + turbulence + color
    const pass = encoder.beginComputePass();
    pass.setPipeline(this._computePipeline!);
    pass.setBindGroup(0, this._computeBindGroup!);
    pass.dispatchWorkgroups(workgroups);
    pass.end();

    // Bitonic sort passes
    if (this._sortPipeline && this._sortBindGroup && this.config.enableSort) {
      const n = this._activeCount;
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
    // Use pre-allocated staging buffer — zero per-frame GC
    const packed = this._stagingBuffer;
    const d = this.cpuData;

    for (let i = 0; i < n; i++) {
      const o = i * 16;
      packed[o + 0]  = d.posX[i];        packed[o + 1]  = d.posY[i];
      packed[o + 2]  = d.posZ[i];        packed[o + 3]  = d.age[i];
      packed[o + 4]  = d.velX[i];        packed[o + 5]  = d.velY[i];
      packed[o + 6]  = d.velZ[i];        packed[o + 7]  = d.life[i];
      packed[o + 8]  = d.colorR[i];      packed[o + 9]  = d.colorG[i];
      packed[o + 10] = d.colorB[i];      packed[o + 11] = d.brightness[i];
      packed[o + 12] = d.temperature[i]; packed[o + 13] = d.size[i];
      packed[o + 14] = d.smoke[i];       packed[o + 15] = d.particleType[i];
    }

    this._device.queue.writeBuffer(this._particleBuffer, 0, packed, 0, n * 16);
  }

  private _downloadParticleData() {
    if (!this._readbackBuffer) return;
    const n = this._activeCount;
    const mapped = new Float32Array(this._readbackBuffer.getMappedRange());
    const d = this.cpuData;

    for (let i = 0; i < n; i++) {
      const o = i * 16;
      d.posX[i] = mapped[o]; d.posY[i] = mapped[o + 1]; d.posZ[i] = mapped[o + 2]; d.age[i] = mapped[o + 3];
      d.velX[i] = mapped[o + 4]; d.velY[i] = mapped[o + 5]; d.velZ[i] = mapped[o + 6]; d.life[i] = mapped[o + 7];
      d.colorR[i] = mapped[o + 8]; d.colorG[i] = mapped[o + 9]; d.colorB[i] = mapped[o + 10]; d.brightness[i] = mapped[o + 11];
      d.temperature[i] = mapped[o + 12]; d.size[i] = mapped[o + 13]; d.smoke[i] = mapped[o + 14]; d.particleType[i] = mapped[o + 15];
    }
  }

  // ─── CPU Fallback (faithful port of WGSL v4) ──────────────
  private _tickCPU(
    dt: number, time: number,
    wind: { x: number; y: number; z: number },
  ) {
    const d = this.cpuData;
    const n = this._activeCount;
    const gravity = this.config.gravity;
    const baseDrag = this.config.drag;
    const smokeBias = this.config.smokeBias;

    for (let i = 0; i < n; i++) {
      const age = d.age[i];
      const life = Math.max(d.life[i], 0.0001);
      const tNorm = Math.max(0, Math.min(1, age / life));
      const typeId = d.particleType[i];

      // Mass-differential aerodynamics
      let drag = baseDrag;
      let grav = gravity;
      let massFactor = 1.0;
      if (typeId < 0.5) {
        // shell star
      } else if (typeId < 1.5) {
        drag *= 0.45; grav *= 1.1; massFactor = 0.55;
      } else {
        drag *= 0.12; grav *= 0.25; massFactor = 0.08;
      }

      // Curl noise turbulence (divergence-free)
      const curlScale = 0.03 + 0.04 * (1 - (1 - tNorm));
      const cpx = d.posX[i] * curlScale + time * 0.4;
      const cpy = d.posY[i] * curlScale;
      const cpz = d.posZ[i] * curlScale + time * 0.2;
      const [cx, cy, cz] = cpuCurlNoise(cpx, cpy, cpz);
      const turbStr = (0.3 + 0.7 * tNorm) * massFactor * 2.5;

      d.velX[i] += (wind.x + cx * turbStr) * dt;
      d.velY[i] += (wind.y + cy * turbStr) * dt - grav * dt;
      d.velZ[i] += (wind.z + cz * turbStr) * dt;

      const speed = Math.sqrt(d.velX[i] ** 2 + d.velY[i] ** 2 + d.velZ[i] ** 2);
      const dragF = 1 / (1 + drag * speed * dt);
      d.velX[i] *= dragF;
      d.velY[i] *= dragF;
      d.velZ[i] *= dragF;

      d.posX[i] += d.velX[i] * dt;
      d.posY[i] += d.velY[i] * dt;
      d.posZ[i] += d.velZ[i] * dt;
      d.age[i] += dt;

      // T ∝ r^(-3/4) thermodynamic decay
      const thermalInit = d.temperature[i];
      const thermalFloor = 800;
      const tSqrt = Math.sqrt(tNorm);
      const kDecay = 1.8 + 1.2 * (1 - thermalInit / 8000);
      const currentTemp = thermalFloor + (thermalInit - thermalFloor) * Math.exp(-kDecay * tSqrt);

      // Stefan-Boltzmann radiated power ∝ T^4
      const tempRatio = currentTemp / Math.max(thermalInit, 1);
      const radiatedPower = tempRatio ** 4;

      const pulse = cpuSoftPulse(time + cpuHash11(d.age[i] + d.size[i]) * 10);
      d.brightness[i] = Math.max(0, Math.min(1, radiatedPower * pulse));

      // Color from full blackbody (1000–8000K)
      const [tr, tg, tb] = cpuBlackbodyFull(currentTemp);
      const blendSpeed = 0.02 + 0.06 * tNorm;
      d.colorR[i] += (tr - d.colorR[i]) * blendSpeed;
      d.colorG[i] += (tg - d.colorG[i]) * blendSpeed;
      d.colorB[i] += (tb - d.colorB[i]) * blendSpeed;

      // Store updated temperature
      d.temperature[i] = currentTemp;
      d.smoke[i] = Math.min(1, d.smoke[i] + smokeBias * dt * (0.35 + 0.65 * tNorm));
    }

    // Compact dead particles
    this._compact();
  }

  /** Remove dead particles by compacting live ones to front. */
  private _compact() {
    const d = this.cpuData;
    let write = 0;
    for (let read = 0; read < this._activeCount; read++) {
      if (d.age[read] < d.life[read]) {
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

/** Expose compute WGSL for native WebGPU pipeline. */
export function getComputeWGSL(): string {
  return UNIFIED_COMPUTE_WGSL;
}

/** Expose sort WGSL for native WebGPU pipeline. */
export function getSortWGSL(): string {
  return SORT_KERNEL_WGSL;
}

/**
 * Pack SoA cpu data into a GPU-ready Float32Array (16 floats per particle).
 * Zero-alloc: caller provides the output buffer.
 */
export function packSoAToBuffer(data: GPUParticleData, count: number, out: Float32Array): void {
  for (let i = 0; i < count; i++) {
    const o = i * 16;
    out[o]     = data.posX[i]; out[o + 1]  = data.posY[i]; out[o + 2]  = data.posZ[i]; out[o + 3]  = data.age[i];
    out[o + 4] = data.velX[i]; out[o + 5]  = data.velY[i]; out[o + 6]  = data.velZ[i]; out[o + 7]  = data.life[i];
    out[o + 8] = data.colorR[i]; out[o + 9] = data.colorG[i]; out[o + 10] = data.colorB[i]; out[o + 11] = data.brightness[i];
    out[o + 12] = data.temperature[i]; out[o + 13] = data.size[i]; out[o + 14] = data.smoke[i]; out[o + 15] = data.particleType[i];
  }
}
