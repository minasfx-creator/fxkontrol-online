// FX KONTROL · Firework Particle Compute Shader
// GPU-accelerated particle physics for pyrotechnic effects

struct Particle {
  pos: vec3<f32>,
  vel: vec3<f32>,
  color: vec3<f32>,
  life: f32,
  size: f32,
  _pad: vec3<f32>,
};

struct SimParams {
  dt: f32,
  gravity: f32,
  drag: f32,
  windX: f32,
  windY: f32,
  windZ: f32,
  time: f32,
  particleCount: u32,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: SimParams;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.particleCount) { return; }

  var p = particles[idx];

  if (p.life <= 0.0) { return; }

  // Wind force
  let wind = vec3<f32>(params.windX, params.windY, params.windZ);

  // Gravity
  p.vel.y += params.gravity * params.dt;

  // Drag
  p.vel *= (1.0 - params.drag * params.dt);

  // Wind
  p.vel += wind * params.dt;

  // Integrate position
  p.pos += p.vel * params.dt;

  // Decay life
  p.life -= params.dt;

  // Thermal color shift (white-hot → saturated → ember)
  let lifeRatio = max(p.life / 2.5, 0.0);
  if (lifeRatio > 0.7) {
    // White-hot core
    p.color = mix(p.color, vec3<f32>(1.0, 1.0, 0.95), 0.3);
  } else if (lifeRatio < 0.2) {
    // Ember fade
    p.color *= 0.95;
  }

  // Size decay
  p.size = max(p.size * (0.98 + lifeRatio * 0.02), 0.01);

  particles[idx] = p;
}
