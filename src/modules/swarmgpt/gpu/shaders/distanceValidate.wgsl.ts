/**
 * distanceValidate.wgsl — Approximate parallel min-distance check.
 *
 * Each invocation `i` compares point `i` to the next K=32 points (cyclic).
 * Worst-case it's O(N*K) work; the true pairwise minimum may be missed if it
 * lies outside the K window — this is documented as APPROXIMATE and intended
 * for fast preview validation, not for safety-critical clearance checks.
 *
 * Output buffer (atomic u32 array of length 2):
 *   [0] violationCount
 *   [1] minDistanceFixed  (min distance × 1000, rounded; atomicMin works on u32)
 */
export const DISTANCE_VALIDATE_WGSL = /* wgsl */ `
struct Params {
  count: u32,
  minDistance: f32,
  window: u32,
  pad: u32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> points: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> result: array<atomic<u32>>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= params.count) { return; }

  let a = points[i].xyz;
  let n = params.count;
  let w = params.window;
  let minD = params.minDistance;

  var localMinFixed: u32 = 0xFFFFFFFFu;
  var localViolations: u32 = 0u;

  for (var k: u32 = 1u; k <= w; k = k + 1u) {
    let j = (i + k) % n;
    if (j == i) { continue; }
    let b = points[j].xyz;
    let d = distance(a, b);
    if (d < minD) {
      localViolations = localViolations + 1u;
    }
    let dFixed = u32(d * 1000.0);
    if (dFixed < localMinFixed) {
      localMinFixed = dFixed;
    }
  }

  if (localViolations > 0u) {
    atomicAdd(&result[0], localViolations);
  }
  atomicMin(&result[1], localMinFixed);
}
`;
