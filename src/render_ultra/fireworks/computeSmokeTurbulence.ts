/**
 * FX KONTROL · Compute Smoke Turbulence Kernel — Camada 9
 * Dedicated advection stage for smoke particles:
 *   - Zero-divergence curl noise (central differences, eps=0.1)
 *   - Multi-octave turbulence (macro + micro scales)
 *   - Thermal buoyancy for rising smoke
 *   - Progressive dissipation by life phase
 *   - CPU fallback faithful to WGSL
 *
 * Pipeline stage 3 of 7:
 *   Physics → Combustion → [Smoke Turbulence] → Vertex → Fragment → Post
 */

// ═══════════════════════════════════════════════════════════════
// WGSL Kernel
// ═══════════════════════════════════════════════════════════════

export const SMOKE_TURBULENCE_KERNEL_WGSL = /* wgsl */ `
struct SmokeParticle {
  position: vec3<f32>,
  _pad0: f32,
  velocity: vec3<f32>,
  _pad1: f32,
  force: vec3<f32>,
  _pad2: f32,
  life: f32,
  maxLife: f32,
  temperature: f32,
  mass: f32,
  drag: f32,
  seed: f32,
  size: f32,
  sortKey: f32,
  energy: f32,
  fuel: f32,
  _pad3: f32,
  _pad4: f32,
};

struct TurbulenceUniforms {
  time: f32,
  deltaTime: f32,
  particleCount: u32,
  macroScale: f32,
  microScale: f32,
  macroStrength: f32,
  microStrength: f32,
  buoyancyStrength: f32,
};

@group(0) @binding(0) var<storage, read_write> particles: array<SmokeParticle>;
@group(0) @binding(1) var<uniform> params: TurbulenceUniforms;

// ── Value noise hash ──
fn hash31(p: vec3<f32>) -> f32 {
  var p3 = fract(p * vec3<f32>(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// ── Curl noise: ∇×noise for divergence-free field ──
fn curlNoise(p: vec3<f32>, scale: f32) -> vec3<f32> {
  let eps = 0.1;
  let sp = p * scale;

  let dx_p = hash31(sp + vec3<f32>(eps, 0.0, 0.0));
  let dx_n = hash31(sp - vec3<f32>(eps, 0.0, 0.0));
  let dy_p = hash31(sp + vec3<f32>(0.0, eps, 0.0));
  let dy_n = hash31(sp - vec3<f32>(0.0, eps, 0.0));
  let dz_p = hash31(sp + vec3<f32>(0.0, 0.0, eps));
  let dz_n = hash31(sp - vec3<f32>(0.0, 0.0, eps));

  let dx = dx_p - dx_n;
  let dy = dy_p - dy_n;
  let dz = dz_p - dz_n;

  // curl = (dFz/dy - dFy/dz, dFx/dz - dFz/dx, dFy/dx - dFx/dy)
  return vec3<f32>(dz - dy, dx - dz, dy - dx);
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.particleCount) { return; }

  var p = particles[idx];
  if (p.life >= p.maxLife) { return; }

  let dt = params.deltaTime;
  let lifeRatio = p.life / max(p.maxLife, 0.001);

  // ── Time-advected position for noise sampling ──
  let advectedPos = p.position + vec3<f32>(
    params.time * 0.12,
    params.time * 0.08 + lifeRatio * 1.5,
    params.time * 0.06
  );

  // ── Macro turbulence (large swirling motions) ──
  let macro = curlNoise(advectedPos, params.macroScale) * params.macroStrength;

  // ── Micro turbulence (fine detail, higher frequency) ──
  let microPos = advectedPos + vec3<f32>(42.0, 17.0, 83.0); // offset to decorrelate
  let micro = curlNoise(microPos, params.microScale) * params.microStrength;

  // ── Combined turbulence with life-based dissipation ──
  let dissipation = 1.0 - smoothstep(0.5, 1.0, lifeRatio);
  let totalTurbulence = (macro + micro) * dissipation;

  p.velocity += totalTurbulence * dt;

  // ── Thermal buoyancy: hot smoke rises faster ──
  let thermalRise = max(0.0, (p.temperature - 400.0) / 3000.0) * params.buoyancyStrength;
  p.velocity.y += thermalRise * dt;

  // ── Lateral spread as smoke cools ──
  let spreadPhase = smoothstep(0.2, 0.7, lifeRatio);
  let lateralSpread = spreadPhase * 0.4 * dt;
  p.velocity.x += (hash31(p.position + params.time) - 0.5) * lateralSpread;
  p.velocity.z += (hash31(p.position * 1.7 + params.time) - 0.5) * lateralSpread;

  // ── Damping: smoke decelerates over time ──
  let damping = 1.0 - 0.8 * dt * lifeRatio;
  p.velocity *= damping;

  particles[idx] = p;
}
`;

// ═══════════════════════════════════════════════════════════════
// CPU Fallback
// ═══════════════════════════════════════════════════════════════

export interface SmokeTurbulenceConfig {
  macroScale: number;
  microScale: number;
  macroStrength: number;
  microStrength: number;
  buoyancyStrength: number;
}

export const DEFAULT_SMOKE_TURBULENCE: SmokeTurbulenceConfig = {
  macroScale: 0.08,       // large-scale swirl frequency
  microScale: 0.25,       // fine-detail frequency
  macroStrength: 3.0,     // large swirl intensity
  microStrength: 1.2,     // fine detail intensity
  buoyancyStrength: 3.2,  // thermal rise force
};

function cpuHash31(x: number, y: number, z: number): number {
  let px = ((x * 0.1031) % 1 + 1) % 1;
  let py = ((y * 0.1030) % 1 + 1) % 1;
  let pz = ((z * 0.0973) % 1 + 1) % 1;
  const d = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33);
  px += d; py += d; pz += d;
  return ((px + py) * pz) % 1;
}

function cpuCurlNoise(
  x: number, y: number, z: number, scale: number,
): [number, number, number] {
  const eps = 0.1;
  const sx = x * scale, sy = y * scale, sz = z * scale;

  const dxp = cpuHash31(sx + eps, sy, sz);
  const dxn = cpuHash31(sx - eps, sy, sz);
  const dyp = cpuHash31(sx, sy + eps, sz);
  const dyn = cpuHash31(sx, sy - eps, sz);
  const dzp = cpuHash31(sx, sy, sz + eps);
  const dzn = cpuHash31(sx, sy, sz - eps);

  const dx = dxp - dxn;
  const dy = dyp - dyn;
  const dz = dzp - dzn;

  return [dz - dy, dx - dz, dy - dx];
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * CPU smoke turbulence tick — call after combustion, before rendering.
 * Modifies velocity arrays in-place for smoke-flagged particles.
 */
export function tickSmokeTurbulenceCPU(
  count: number,
  dt: number,
  time: number,
  posX: Float32Array, posY: Float32Array, posZ: Float32Array,
  velX: Float32Array, velY: Float32Array, velZ: Float32Array,
  life: Float32Array, maxLife: Float32Array,
  temperature: Float32Array,
  config: SmokeTurbulenceConfig = DEFAULT_SMOKE_TURBULENCE,
) {
  for (let i = 0; i < count; i++) {
    if (life[i] >= maxLife[i]) continue;

    const lifeRatio = life[i] / Math.max(maxLife[i], 0.001);

    // Time-advected position
    const ax = posX[i] + time * 0.12;
    const ay = posY[i] + time * 0.08 + lifeRatio * 1.5;
    const az = posZ[i] + time * 0.06;

    // Macro turbulence
    const [mx, my, mz] = cpuCurlNoise(ax, ay, az, config.macroScale);
    // Micro turbulence (offset to decorrelate)
    const [ux, uy, uz] = cpuCurlNoise(ax + 42, ay + 17, az + 83, config.microScale);

    // Dissipation
    const dissipation = 1 - smoothstep(0.5, 1.0, lifeRatio);
    const tx = (mx * config.macroStrength + ux * config.microStrength) * dissipation;
    const ty = (my * config.macroStrength + uy * config.microStrength) * dissipation;
    const tz = (mz * config.macroStrength + uz * config.microStrength) * dissipation;

    velX[i] += tx * dt;
    velY[i] += ty * dt;
    velZ[i] += tz * dt;

    // Thermal buoyancy
    const thermalRise = Math.max(0, (temperature[i] - 400) / 3000) * config.buoyancyStrength;
    velY[i] += thermalRise * dt;

    // Lateral spread
    const spreadPhase = smoothstep(0.2, 0.7, lifeRatio);
    const lateralSpread = spreadPhase * 0.4 * dt;
    velX[i] += (cpuHash31(posX[i] + time, posY[i], posZ[i]) - 0.5) * lateralSpread;
    velZ[i] += (cpuHash31(posX[i] * 1.7 + time, posY[i], posZ[i]) - 0.5) * lateralSpread;

    // Damping
    const damping = 1 - 0.8 * dt * lifeRatio;
    velX[i] *= damping;
    velY[i] *= damping;
    velZ[i] *= damping;
  }
}
