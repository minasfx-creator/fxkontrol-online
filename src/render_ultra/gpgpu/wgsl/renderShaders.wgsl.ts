/**
 * Cinematic Render Shaders — Fire + Smoke with ACES Tonemapping
 * 
 * Fire: emissive core + soft halo, blackbody tint, ACES output
 * Smoke: Beer-Lambert absorption, density-driven alpha, dark base with heat warming
 * Billboard via storage buffer read (native instancing)
 */

export const RENDER_WGSL = /* wgsl */ `

struct CameraUniforms {
  viewProj: mat4x4<f32>,
  camRight: vec3<f32>,
  _pad0: f32,
  camUp: vec3<f32>,
  _pad1: f32,
};

struct Particle {
  pos: vec4<f32>,   // xyz = world pos, w = age
  vel: vec4<f32>,   // xyz = velocity, w = life
  color: vec4<f32>, // rgb = emissive color, a = brightness
  misc: vec4<f32>,  // x = temperature, y = size, z = smoke, w = type
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(0) @binding(1) var<storage, read> particles: array<Particle>;

struct VSOutput {
  @builtin(position) clipPos: vec4<f32>,
  @location(0) vColor: vec4<f32>,
  @location(1) vUV: vec2<f32>,
  @location(2) vSmoke: f32,
  @location(3) vAlive: f32,
  @location(4) vTemp: f32,
};

// Billboard quad (2 triangles, 6 vertices)
const QUAD_POS = array<vec2<f32>, 6>(
  vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
  vec2(-1.0, 1.0),  vec2(1.0, -1.0), vec2(1.0, 1.0),
);
const QUAD_UV = array<vec2<f32>, 6>(
  vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(0.0, 1.0),
  vec2(0.0, 1.0), vec2(1.0, 0.0), vec2(1.0, 1.0),
);

fn saturate(v: f32) -> f32 { return clamp(v, 0.0, 1.0); }

// ── ACES Tonemapping (Narkowicz fit) ──
fn aces_tonemap(x: vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

// ── Blackbody approximation for temperature-based tint ──
fn blackbody_color(temp: f32) -> vec3<f32> {
  // Attempt to map [800..6000] K to perceptual fire colors
  let t = clamp(temp, 800.0, 6000.0);
  let n = (t - 800.0) / 5200.0; // normalize to [0,1]
  let r = saturate(1.0);
  let g = saturate(n * n * 0.85);
  let b_ch = saturate((n - 0.4) * (n - 0.4) * 2.5);
  return vec3<f32>(r, g, b_ch);
}

// ── Fire Vertex ──
@vertex
fn vs_fire(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VSOutput {
  var out: VSOutput;
  let p = particles[iid];
  let age = p.pos.w;
  let life = max(p.vel.w, 0.0001);
  let alive = saturate(1.0 - age / life);

  // Kill dead particles
  if (alive <= 0.0) {
    out.clipPos = vec4(0.0, 0.0, -2.0, 1.0);
    return out;
  }

  let size = p.misc.y * (0.5 + 0.5 * alive);
  let offset = QUAD_POS[vid];
  let worldPos = p.pos.xyz
    + camera.camRight * offset.x * size
    + camera.camUp * offset.y * size;

  out.clipPos = camera.viewProj * vec4(worldPos, 1.0);
  out.vColor = vec4(p.color.rgb * p.color.a, p.color.a);
  out.vUV = QUAD_UV[vid];
  out.vSmoke = p.misc.z;
  out.vAlive = alive;
  out.vTemp = p.misc.x;
  return out;
}

// ── Fire Fragment (ACES tonemapped) ──
@fragment
fn fs_fire(input: VSOutput) -> @location(0) vec4<f32> {
  // Only render fire particles (low smoke)
  if (input.vSmoke > 0.5) { discard; }

  let uv = input.vUV * 2.0 - vec2(1.0, 1.0);
  let r = length(uv);

  // Core + halo (cinematic falloff)
  let core = exp(-r * r * 7.0);
  let halo = exp(-r * r * 1.8) * 0.35;
  let shape = core * 1.7 + halo;

  // Blackbody tint by temperature
  let bb = blackbody_color(input.vTemp);
  let emissive = input.vColor.rgb * bb * shape * input.vAlive;

  // ACES tonemapping — preserves HDR until final output
  let mapped = aces_tonemap(emissive * 3.0);

  let alpha = saturate(shape * input.vAlive * input.vColor.a);
  return vec4(mapped, alpha);
}

// ── Smoke Vertex ──
@vertex
fn vs_smoke(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VSOutput {
  var out: VSOutput;
  let p = particles[iid];
  let age = p.pos.w;
  let life = max(p.vel.w, 0.0001);
  let alive = saturate(1.0 - age / life);

  if (alive <= 0.0) {
    out.clipPos = vec4(0.0, 0.0, -2.0, 1.0);
    return out;
  }

  // Smoke grows larger over time
  let size = p.misc.y * (1.0 + 2.0 * (1.0 - alive));
  let offset = QUAD_POS[vid];
  let worldPos = p.pos.xyz
    + camera.camRight * offset.x * size
    + camera.camUp * offset.y * size;

  out.clipPos = camera.viewProj * vec4(worldPos, 1.0);
  out.vColor = vec4(0.12, 0.10, 0.08, 1.0); // dark smoke base
  out.vUV = QUAD_UV[vid];
  out.vSmoke = p.misc.z;
  out.vAlive = alive;
  out.vTemp = p.misc.x;
  return out;
}

// ── Smoke Fragment (Beer-Lambert absorption) ──
@fragment
fn fs_smoke(input: VSOutput) -> @location(0) vec4<f32> {
  // Only render smoke particles
  if (input.vSmoke < 0.3) { discard; }

  let uv = input.vUV * 2.0 - vec2(1.0, 1.0);
  let r = length(uv);
  let falloff = saturate(1.0 - r);
  let soft = falloff * falloff;

  // Beer-Lambert absorption model
  let optical_depth = input.vSmoke * 0.92 * soft;
  let transmittance = exp(-optical_depth * 2.5);
  let alpha = (1.0 - transmittance) * input.vAlive * 0.75;

  // Warm smoke near heat sources (temperature-based tinting)
  let heat_factor = saturate(input.vTemp / 2000.0) * 0.15;
  let smoke_color = mix(
    input.vColor.rgb,
    vec3<f32>(0.25, 0.12, 0.05), // warm brown-orange
    heat_factor
  );

  return vec4(smoke_color, alpha);
}
`;
