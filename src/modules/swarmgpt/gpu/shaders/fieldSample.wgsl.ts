/**
 * fieldSample.wgsl — Compute shader: generates `count` deterministic
 * pseudo-random candidate points inside `bounds`, evaluates a single field's
 * density at each, and writes (x, y, z, density) to `output[i]` as vec4f.
 *
 * Field encoding (params layout, all f32):
 *   radial:  p0..p2 = center, p3 = radius
 *   wave:    p0..p2 = center, p3 = amplitude, p4 = frequency, p5 = width
 *   spiral:  p0..p2 = center, p3 = radius, p4 = height, p5 = turns
 *   cone:    p0..p2 = origin, p3..p5 = dir (normalized), p6 = cosHalfAngle, p7 = length
 *   cluster: p0..p2 = single center, p3 = radius (multi-center on CPU only)
 *
 * `fieldType`:  0=radial, 1=wave, 2=spiral, 3=cone, 4=cluster
 *
 * Note: `Params` keeps all 8 user params as discrete f32s (not vec3) to avoid
 * WGSL's 16-byte vec3 padding traps when the JS serializer doesn't match.
 */
export const FIELD_SAMPLE_WGSL = /* wgsl */ `
struct Params {
  minX: f32,
  maxX: f32,
  minY: f32,
  maxY: f32,
  minZ: f32,
  maxZ: f32,
  seed: f32,
  fieldType: f32,
  p0: f32,
  p1: f32,
  p2: f32,
  p3: f32,
  p4: f32,
  p5: f32,
  p6: f32,
  p7: f32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> output: array<vec4f>;

fn rand(n: f32) -> f32 {
  return fract(sin(n) * 43758.5453123);
}

fn densityRadial(p: vec3f) -> f32 {
  let center = vec3f(params.p0, params.p1, params.p2);
  let radius = max(params.p3, 0.001);
  let d = distance(p, center);
  return clamp(1.0 - d / radius, 0.0, 1.0);
}

fn densityWave(p: vec3f) -> f32 {
  let center = vec3f(params.p0, params.p1, params.p2);
  let amplitude = params.p3;
  let frequency = params.p4;
  let width = max(params.p5, 1.0);
  let localX = p.x - center.x;
  let waveZ = center.z + sin(localX * frequency) * amplitude;
  let dz = abs(p.z - waveZ);
  let dx = abs(localX);
  let widthScore = clamp(1.0 - dx / width, 0.0, 1.0);
  let lineScore = clamp(1.0 - dz / max(abs(amplitude), 1.0), 0.0, 1.0);
  return widthScore * lineScore;
}

fn densitySpiral(p: vec3f) -> f32 {
  let center = vec3f(params.p0, params.p1, params.p2);
  let radius = max(params.p3, 1.0);
  let height = max(params.p4, 1.0);
  let turns = max(params.p5, 1.0);
  let rel = p - center;
  let radial = sqrt(rel.x * rel.x + rel.z * rel.z);
  let y01 = clamp((rel.y + height * 0.5) / height, 0.0, 1.0);
  let target = radius * y01;
  let radialScore = clamp(1.0 - abs(radial - target) / radius, 0.0, 1.0);
  let angle = atan2(rel.z, rel.x);
  let expectedAngle = y01 * 6.2831853 * turns;
  let angleScore = clamp(1.0 - abs(sin((angle - expectedAngle) * 0.5)), 0.0, 1.0);
  return radialScore * angleScore;
}

fn densityCone(p: vec3f) -> f32 {
  let origin = vec3f(params.p0, params.p1, params.p2);
  let dir = vec3f(params.p3, params.p4, params.p5);
  let cosHalf = params.p6;
  let len = max(params.p7, 0.001);
  let toPoint = p - origin;
  let dist = length(toPoint);
  if (dist <= 0.000001 || dist > len) { return 0.0; }
  let ray = toPoint / dist;
  let alignment = dot(ray, dir);
  if (alignment < cosHalf) { return 0.0; }
  let coneScore = (alignment - cosHalf) / max(0.000001, 1.0 - cosHalf);
  let falloff = 1.0 - dist / len;
  return clamp(coneScore * falloff, 0.0, 1.0);
}

fn densityCluster(p: vec3f) -> f32 {
  // Single-center cluster on GPU. Multi-center clusters fall back to CPU.
  let center = vec3f(params.p0, params.p1, params.p2);
  let radius = max(params.p3, 0.001);
  let d = distance(p, center);
  return clamp(1.0 - d / radius, 0.0, 1.0);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = f32(id.x);
  let s = params.seed;
  let rx = rand(i * 12.9898 + s);
  let ry = rand(i * 78.2330 + s + 1.0);
  let rz = rand(i * 37.7190 + s + 2.0);

  let p = vec3f(
    params.minX + rx * (params.maxX - params.minX),
    params.minY + ry * (params.maxY - params.minY),
    params.minZ + rz * (params.maxZ - params.minZ),
  );

  var d: f32 = 0.0;
  let ft = params.fieldType;
  if (ft < 0.5) {
    d = densityRadial(p);
  } else if (ft < 1.5) {
    d = densityWave(p);
  } else if (ft < 2.5) {
    d = densitySpiral(p);
  } else if (ft < 3.5) {
    d = densityCone(p);
  } else {
    d = densityCluster(p);
  }

  output[id.x] = vec4f(p.x, p.y, p.z, d);
}
`;
