/**
 * FX KONTROL · Compute Combustion Kernel — Camada 9
 * Dedicated energy/combustion compute stage:
 *   - Exponential fuel consumption
 *   - 7-harmonic organic flicker injected at compute level
 *   - Stefan-Boltzmann thermal radiation (dT/dt ∝ -T⁴)
 *   - CPU fallback faithful to WGSL logic
 *
 * Pipeline stage 2 of 7:
 *   Physics → [Combustion] → Smoke Turbulence → Vertex → Fragment → Post
 */

// ═══════════════════════════════════════════════════════════════
// WGSL Kernel (compiled at runtime by WebGPU)
// ═══════════════════════════════════════════════════════════════

export const COMBUSTION_KERNEL_WGSL = /* wgsl */ `
struct CombustionParticle {
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

struct CombustionUniforms {
  time: f32,
  deltaTime: f32,
  particleCount: u32,
  _pad: u32,
};

@group(0) @binding(0) var<storage, read_write> particles: array<CombustionParticle>;
@group(0) @binding(1) var<uniform> params: CombustionUniforms;

// ── 7-harmonic organic flicker ──
fn flicker7(time: f32, seed: f32) -> f32 {
  let f1 = sin(time * 17.3 + seed * 7.91) * 0.28;
  let f2 = sin(time * 41.7 + seed * 19.3) * 0.15;
  let f3 = sin(time * 7.1  + seed * 3.7)  * 0.20;
  let f4 = sin(time * 97.0 + seed * 53.0) * 0.06;
  let f5 = sin(time * 2.3  + seed * 1.1)  * 0.10;
  let f6 = sin(time * 157.0 + seed * 89.0) * 0.04;
  let f7 = sin(time * 0.7  + seed * 0.3)  * 0.08;
  return 0.80 + (f1 + f2 + f3 + f4 + f5 + f6 + f7);
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.particleCount) { return; }

  var p = particles[idx];
  if (p.life >= p.maxLife) { return; }

  let dt = params.deltaTime;
  let lifeRatio = p.life / max(p.maxLife, 0.001);

  // ── Fuel consumption: exponential burn ──
  let burnRate = p.energy * 0.55 * dt;
  p.fuel = max(0.0, p.fuel - burnRate);

  // ── Energy from fuel (proportional to remaining fuel) ──
  let fuelContribution = p.fuel * 0.8;

  // ── Flicker modulation at compute level ──
  let flick = flicker7(params.time, p.seed);

  // ── Stefan-Boltzmann cooling: dT/dt ∝ -σT⁴ (simplified) ──
  // σ_eff calibrated for real-time: ~2e-6 gives visible cooling over 2-3s
  let T = p.temperature;
  let T_norm = T / 6500.0; // normalize to max temp range
  let coolingPower = 2.2e-6 * T * T * T * T_norm;
  p.temperature = max(300.0, T - coolingPower * dt);

  // ── Energy = fuel contribution × flicker × thermal factor ──
  let thermalFactor = smoothstep(300.0, 2000.0, p.temperature);
  p.energy = fuelContribution * flick * thermalFactor;

  // ── Late-life ember glow: residual energy from hot particles ──
  let emberPhase = smoothstep(0.55, 1.0, lifeRatio);
  let emberGlow = max(0.0, (p.temperature - 800.0) / 4000.0) * 0.15;
  p.energy = max(p.energy, emberGlow * (1.0 - emberPhase * 0.7));

  particles[idx] = p;
}
`;

// ═══════════════════════════════════════════════════════════════
// CPU Fallback — faithful port
// ═══════════════════════════════════════════════════════════════

export interface CombustionData {
  energy: Float32Array;
  fuel: Float32Array;
}

function cpuFlicker7(time: number, seed: number): number {
  const f1 = Math.sin(time * 17.3 + seed * 7.91) * 0.28;
  const f2 = Math.sin(time * 41.7 + seed * 19.3) * 0.15;
  const f3 = Math.sin(time * 7.1  + seed * 3.7)  * 0.20;
  const f4 = Math.sin(time * 97.0 + seed * 53.0) * 0.06;
  const f5 = Math.sin(time * 2.3  + seed * 1.1)  * 0.10;
  const f6 = Math.sin(time * 157.0 + seed * 89.0) * 0.04;
  const f7 = Math.sin(time * 0.7  + seed * 0.3)  * 0.08;
  return 0.80 + (f1 + f2 + f3 + f4 + f5 + f6 + f7);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * CPU combustion tick — call after force accumulation, before smoke turbulence.
 * Mutates energy, fuel, and temperature arrays in-place.
 */
export function tickCombustionCPU(
  count: number,
  dt: number,
  time: number,
  life: Float32Array,
  maxLife: Float32Array,
  temperature: Float32Array,
  seed: Float32Array,
  combustion: CombustionData,
) {
  const { energy, fuel } = combustion;

  for (let i = 0; i < count; i++) {
    if (life[i] >= maxLife[i]) continue;

    const lifeRatio = life[i] / Math.max(maxLife[i], 0.001);

    // Fuel consumption
    const burnRate = energy[i] * 0.55 * dt;
    fuel[i] = Math.max(0, fuel[i] - burnRate);

    // Energy from fuel
    const fuelContribution = fuel[i] * 0.8;

    // Flicker
    const flick = cpuFlicker7(time, seed[i]);

    // Stefan-Boltzmann cooling
    const T = temperature[i];
    const T_norm = T / 6500;
    const coolingPower = 2.2e-6 * T * T * T * T_norm;
    temperature[i] = Math.max(300, T - coolingPower * dt);

    // Energy
    const thermalFactor = smoothstep(300, 2000, temperature[i]);
    energy[i] = fuelContribution * flick * thermalFactor;

    // Ember glow
    const emberPhase = smoothstep(0.55, 1.0, lifeRatio);
    const emberGlow = Math.max(0, (temperature[i] - 800) / 4000) * 0.15;
    energy[i] = Math.max(energy[i], emberGlow * (1 - emberPhase * 0.7));
  }
}

/**
 * Create pre-allocated combustion data arrays.
 */
export function createCombustionData(maxParticles: number): CombustionData {
  return {
    energy: new Float32Array(maxParticles),
    fuel: new Float32Array(maxParticles),
  };
}
