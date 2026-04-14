/**
 * Light Scattering Pass — Fullscreen Triangle
 * 
 * Radial light falloff from fire sources.
 * Additive low-intensity output to warm smoke edges.
 * Uses fullscreen triangle (3 vertices, no index buffer).
 */

export const LIGHT_SCATTER_WGSL = /* wgsl */ `

struct LightScatterParams {
  intensity: f32,
  falloff: f32,
  radius: f32,
  time: f32,
  // Up to 4 light positions in screen space (xy = ndc, z = intensity, w = radius)
  light0: vec4<f32>,
  light1: vec4<f32>,
  light2: vec4<f32>,
  light3: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: LightScatterParams;

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// Fullscreen triangle (covers entire screen with 3 vertices)
@vertex
fn vs_scatter(@builtin(vertex_index) vid: u32) -> VSOut {
  var out: VSOut;
  // Oversize triangle: positions that cover [-1,1] clip space
  let x = f32(i32(vid & 1u)) * 4.0 - 1.0;
  let y = f32(i32(vid >> 1u)) * 4.0 - 1.0;
  out.pos = vec4<f32>(x, y, 0.0, 1.0);
  out.uv = vec2<f32>(x * 0.5 + 0.5, 1.0 - (y * 0.5 + 0.5));
  return out;
}

fn light_contribution(uv: vec2<f32>, light: vec4<f32>, global_falloff: f32) -> vec3<f32> {
  let light_uv = light.xy * 0.5 + vec2<f32>(0.5, 0.5); // NDC to UV
  let light_intensity = light.z;
  let light_radius = light.w;

  if (light_intensity <= 0.001) { return vec3<f32>(0.0); }

  let d = distance(uv, light_uv);
  let norm_d = d / max(light_radius, 0.001);

  // Inverse-square falloff with soft knee
  let attenuation = 1.0 / (1.0 + global_falloff * norm_d * norm_d);
  let edge = saturate(1.0 - norm_d);

  // Warm fire light color
  let warm = vec3<f32>(1.0, 0.65, 0.25);
  return warm * light_intensity * attenuation * edge * edge;
}

fn saturate(v: f32) -> f32 { return clamp(v, 0.0, 1.0); }

@fragment
fn fs_scatter(input: VSOut) -> @location(0) vec4<f32> {
  var scatter = vec3<f32>(0.0);

  scatter += light_contribution(input.uv, params.light0, params.falloff);
  scatter += light_contribution(input.uv, params.light1, params.falloff);
  scatter += light_contribution(input.uv, params.light2, params.falloff);
  scatter += light_contribution(input.uv, params.light3, params.falloff);

  scatter *= params.intensity;

  let alpha = saturate(length(scatter) * 0.5);
  return vec4<f32>(scatter, alpha);
}
`;
