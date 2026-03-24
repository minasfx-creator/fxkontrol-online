// FX KONTROL · Swarm Boids Compute Shader
// GPU-accelerated flocking behavior for drone swarms

struct Drone {
  pos: vec3<f32>,
  vel: vec3<f32>,
  target: vec3<f32>,
  color: vec3<f32>,
};

struct SwarmParams {
  dt: f32,
  separationWeight: f32,
  alignmentWeight: f32,
  cohesionWeight: f32,
  separationRadius: f32,
  neighborRadius: f32,
  maxSpeed: f32,
  maxForce: f32,
  droneCount: u32,
  boundaryRadius: f32,
  targetWeight: f32,
  _pad: f32,
};

@group(0) @binding(0) var<storage, read> dronesIn: array<Drone>;
@group(0) @binding(1) var<storage, read_write> dronesOut: array<Drone>;
@group(0) @binding(2) var<uniform> params: SwarmParams;

fn limit(v: vec3<f32>, maxLen: f32) -> vec3<f32> {
  let len = length(v);
  if (len > maxLen) { return v * (maxLen / len); }
  return v;
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.droneCount) { return; }

  let me = dronesIn[idx];
  var separation = vec3<f32>(0.0);
  var alignment = vec3<f32>(0.0);
  var cohesion = vec3<f32>(0.0);
  var sepCount: f32 = 0.0;
  var neighborCount: f32 = 0.0;

  for (var j: u32 = 0u; j < params.droneCount; j++) {
    if (j == idx) { continue; }
    let other = dronesIn[j];
    let diff = me.pos - other.pos;
    let dist = length(diff);

    if (dist < params.separationRadius && dist > 0.001) {
      separation += normalize(diff) / dist;
      sepCount += 1.0;
    }

    if (dist < params.neighborRadius) {
      alignment += other.vel;
      cohesion += other.pos;
      neighborCount += 1.0;
    }
  }

  var force = vec3<f32>(0.0);

  if (sepCount > 0.0) {
    force += normalize(separation / sepCount) * params.separationWeight;
  }
  if (neighborCount > 0.0) {
    let avgVel = alignment / neighborCount;
    force += (avgVel - me.vel) * params.alignmentWeight;

    let center = cohesion / neighborCount;
    force += (center - me.pos) * params.cohesionWeight;
  }

  // Target seeking
  let toTarget = me.target - me.pos;
  force += normalize(toTarget) * params.targetWeight;

  // Boundary containment
  let distFromCenter = length(me.pos);
  if (distFromCenter > params.boundaryRadius) {
    force += -normalize(me.pos) * 2.0;
  }

  force = limit(force, params.maxForce);

  var newVel = limit(me.vel + force * params.dt, params.maxSpeed);
  var newPos = me.pos + newVel * params.dt;

  dronesOut[idx] = Drone(newPos, newVel, me.target, me.color);
}
