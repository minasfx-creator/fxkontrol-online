/**
 * Smoke Compute Shader — Curl Noise Divergence-Free Advection
 * 
 * Dedicated smoke simulation with:
 * - 3D value noise → curl noise (divergence-free by construction)
 * - Buoyant rise force scaled by alive ratio
 * - Rational drag (not exponential)
 * - Density dissipation over lifetime
 */

export const SMOKE_COMPUTE_WGSL = /* wgsl */ `

struct SmokeSimParams {
  dt: f32,
  time: f32,
  wind_x: f32,
  wind_y: f32,
  wind_z: f32,
  turbulence: f32,
  dissipation: f32,
  rise_force: f32,
};

struct Particle {
  pos: vec4<f32>,   // xyz = world pos, w = age
  vel: vec4<f32>,   // xyz = velocity, w = life
  color: vec4<f32>, // rgb = color, a = brightness
  misc: vec4<f32>,  // x = temperature, y = size, z = smoke, w = type
};

@group(0) @binding(0) var<uniform> params: SmokeSimParams;
@group(0) @binding(1) var<storage, read_write> particles: array<Particle>;

// ── 3D Value Noise ──

fn hash31(p: vec3<f32>) -> f32 {
  return fract(sin(dot(p, vec3<f32>(12.9898, 78.233, 37.719))) * 43758.5453123);
}

fn noise3(p: vec3<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f); // smoothstep

  let n000 = hash31(i + vec3<f32>(0.0, 0.0, 0.0));
  let n100 = hash31(i + vec3<f32>(1.0, 0.0, 0.0));
  let n010 = hash31(i + vec3<f32>(0.0, 1.0, 0.0));
  let n110 = hash31(i + vec3<f32>(1.0, 1.0, 0.0));
  let n001 = hash31(i + vec3<f32>(0.0, 0.0, 1.0));
  let n101 = hash31(i + vec3<f32>(1.0, 0.0, 1.0));
  let n011 = hash31(i + vec3<f32>(0.0, 1.0, 1.0));
  let n111 = hash31(i + vec3<f32>(1.0, 1.0, 1.0));

  let x00 = mix(n000, n100, u.x);
  let x10 = mix(n010, n110, u.x);
  let x01 = mix(n001, n101, u.x);
  let x11 = mix(n011, n111, u.x);
  let y0  = mix(x00, x10, u.y);
  let y1  = mix(x01, x11, u.y);
  return mix(y0, y1, u.z);
}

// ── Curl Noise (divergence-free by construction) ──

fn curl_noise(p: vec3<f32>) -> vec3<f32> {
  let e = 0.08;
  let dx = vec3<f32>(e, 0.0, 0.0);
  let dy = vec3<f32>(0.0, e, 0.0);
  let dz = vec3<f32>(0.0, 0.0, e);

  // Partial derivatives via central differences
  let dnoise_dy = noise3(p + dy) - noise3(p - dy);
  let dnoise_dz = noise3(p + dz) - noise3(p - dz);
  let dnoise_dx = noise3(p + dx) - noise3(p - dx);

  // Second noise field for full 3D curl
  let p2 = p + vec3<f32>(31.416, 17.31, 23.89);
  let dnoise2_dy = noise3(p2 + dy) - noise3(p2 - dy);
  let dnoise2_dz = noise3(p2 + dz) - noise3(p2 - dz);
  let dnoise2_dx = noise3(p2 + dx) - noise3(p2 - dx);

  let curl = vec3<f32>(
    dnoise_dy - dnoise2_dz,
    dnoise_dz - dnoise_dx,
    dnoise2_dx - dnoise_dy
  );

  return curl / (2.0 * e);
}

// ── Smoke Update Kernel ──

@compute @workgroup_size(256)
fn cs_smoke_update(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= arrayLength(&particles)) { return; }

  var p = particles[i];

  // Only process smoke particles (smoke flag > 0.3)
  if (p.misc.z < 0.3) { return; }

  let age = p.pos.w;
  let life = max(p.vel.w, 0.001);
  let alive = clamp(1.0 - age / life, 0.0, 1.0);

  if (alive <= 0.0) { return; }

  // Wind
  let wind = vec3<f32>(params.wind_x, params.wind_y, params.wind_z);

  // Curl noise turbulence (time-varying, position-dependent)
  let noise_pos = p.pos.xyz * 0.02 + vec3<f32>(params.time * 0.15, params.time * 0.08, params.time * 0.12);
  let turb = curl_noise(noise_pos) * params.turbulence;

  // Buoyant rise (stronger when young)
  let rise = vec3<f32>(0.0, params.rise_force * alive, 0.0);

  // Accumulate forces
  p.vel.xyz += (wind + turb + rise) * params.dt;

  // Rational drag (not exponential — stable at high dt)
  let drag = 1.0 / (1.0 + 0.12 * params.dt);
  p.vel.xyz *= drag;

  // Integrate position
  p.pos.xyz += p.vel.xyz * params.dt;

  // Density dissipation (faster as particle ages)
  let dissipation_rate = params.dissipation * (0.35 + 0.65 * (1.0 - alive));
  p.misc.z = max(p.misc.z - dissipation_rate * params.dt * 0.1, 0.0);

  // Smoke size grows over time
  p.misc.y = p.misc.y * (1.0 + 0.8 * params.dt * (1.0 - alive));

  particles[i] = p;
}
`;
