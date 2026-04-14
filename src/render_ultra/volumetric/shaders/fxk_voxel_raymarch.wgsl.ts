/**
 * FXK Volumetric Raymarch — WGSL Shader
 * Ray-box intersection, adaptive raymarch, Beer-Lambert absorption,
 * Henyey-Greenstein scattering, blackbody fire, ACES tonemap.
 */

export const FXK_VOXEL_RAYMARCH_WGSL = /* wgsl */ `

// ═══════════════════════════════
// STRUCTS
// ═══════════════════════════════

struct Camera {
  view: mat4x4<f32>,
  proj: mat4x4<f32>,
  inv_view_proj: mat4x4<f32>,
  position: vec4<f32>,
};

struct VolumeParams {
  step_size: f32,
  max_steps: i32,
  density_scale: f32,
  emission_scale: f32,
  absorption: f32,
  scattering: f32,
  anisotropy: f32,
  pad: f32,
};

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> params: VolumeParams;
@group(0) @binding(2) var volumeTex: texture_3d<f32>;
@group(0) @binding(3) var volumeSampler: sampler;

// ═══════════════════════════════
// UTIL
// ═══════════════════════════════

fn saturate_f(x: f32) -> f32 {
  return clamp(x, 0.0, 1.0);
}

fn ray_box_intersect(ray_origin: vec3<f32>, ray_dir: vec3<f32>) -> vec2<f32> {
  let box_min = vec3<f32>(-1.0, -1.0, -1.0);
  let box_max = vec3<f32>(1.0, 1.0, 1.0);
  let inv_dir = 1.0 / ray_dir;
  let t0 = (box_min - ray_origin) * inv_dir;
  let t1 = (box_max - ray_origin) * inv_dir;
  let tmin = max(max(min(t0.x, t1.x), min(t0.y, t1.y)), min(t0.z, t1.z));
  let tmax = min(min(max(t0.x, t1.x), max(t0.y, t1.y)), max(t0.z, t1.z));
  return vec2<f32>(tmin, tmax);
}

fn phase_hg(cos_theta: f32, g: f32) -> f32 {
  let denom = 1.0 + g * g - 2.0 * g * cos_theta;
  return (1.0 - g * g) / (4.0 * 3.14159 * denom * sqrt(denom));
}

// ═══════════════════════════════
// RAYMARCH CORE
// ═══════════════════════════════

fn raymarch(origin: vec3<f32>, dir: vec3<f32>) -> vec4<f32> {
  var t_range = ray_box_intersect(origin, dir);
  if (t_range.x > t_range.y) {
    return vec4<f32>(0.0);
  }

  var t = max(t_range.x, 0.0);
  let t_end = t_range.y;
  var transmittance = 1.0;
  var color = vec3<f32>(0.0);
  let step = params.step_size;

  var i = 0;
  loop {
    if (i >= params.max_steps) { break; }
    if (t > t_end) { break; }
    if (transmittance < 0.01) { break; }

    let pos = origin + dir * t;
    let uvw = pos * 0.5 + vec3<f32>(0.5);

    let sample_val = textureSample(volumeTex, volumeSampler, uvw);

    let density = sample_val.r * params.density_scale;
    let emission = sample_val.g * params.emission_scale;
    let temperature = sample_val.b;

    let absorb = exp(-density * params.absorption * step);

    let light_dir = normalize(vec3<f32>(0.2, 1.0, 0.3));
    let cos_theta = dot(dir, light_dir);
    let phase = phase_hg(cos_theta, params.anisotropy);
    let scatter = density * params.scattering * phase;

    let fire_color = vec3<f32>(
      1.0,
      mix(0.3, 0.9, temperature),
      mix(0.05, 0.4, temperature)
    );

    let step_color = fire_color * emission + vec3<f32>(0.5) * scatter;
    color += step_color * transmittance * step;
    transmittance *= absorb;

    t += step;
    i += 1;
  }

  return vec4<f32>(color, 1.0 - transmittance);
}

// ═══════════════════════════════
// VERTEX — fullscreen quad
// ═══════════════════════════════

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VSOut {
  var positions = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0),
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0,  1.0),
    vec2<f32>(-1.0,  1.0)
  );
  var out: VSOut;
  out.pos = vec4<f32>(positions[vid], 0.0, 1.0);
  out.uv = positions[vid] * 0.5 + vec2<f32>(0.5);
  return out;
}

// ═══════════════════════════════
// FRAGMENT
// ═══════════════════════════════

fn aces_tonemap(x: vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let uv = in.uv * 2.0 - vec2<f32>(1.0);
  let clip = vec4<f32>(uv, 0.0, 1.0);
  let world = camera.inv_view_proj * clip;
  let world_pos = world.xyz / world.w;
  let ray_dir = normalize(world_pos - camera.position.xyz);
  let ray_origin = camera.position.xyz;

  let result = raymarch(ray_origin, ray_dir);
  let mapped = aces_tonemap(result.rgb);
  return vec4<f32>(mapped, result.a);
}
`;
