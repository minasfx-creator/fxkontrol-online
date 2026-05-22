/**
 * poissonPreview.wgsl — GPU Poisson-disk *preview* downsampling.
 *
 * Strategy:
 *   1. Hash each candidate into a 3D voxel grid sized to `minDistance`.
 *      Two points within √3·minDistance can only collide if they share a
 *      voxel or sit in adjacent voxels (3x3x3 = 27 cells to scan).
 *   2. Per voxel, atomically claim the candidate with the HIGHEST density
 *      (we encode density+index into a single u32 so atomicMax is total).
 *   3. A second pass marks each candidate `accepted = 1` iff it is the
 *      winner of its own voxel AND no neighboring winner sits within
 *      `minDistance` of it.
 *
 * This is INTENTIONALLY approximate:
 *   - Two candidates in different cells but < minDistance apart can both
 *     win their cells and both pass the neighbor check if they are exactly
 *     on a cell boundary. The CPU final pass is the authority.
 *   - The grid caps cell count to avoid OOM; oversize bounds degrade to
 *     lower resolution silently.
 *
 * Output buffer layout (one u32 per candidate): 0 = rejected, 1 = accepted.
 *
 * Reserved keyword note: avoids `meta`, `target`, `type` per WGSL gotchas.
 */

export const POISSON_PREVIEW_WGSL = /* wgsl */ `
struct Params {
  // Cell size = minDistance. Grid origin at (originX, originY, originZ).
  minDistance: f32,
  cellSize:    f32,
  candidateCount: u32,
  cellsX: u32,
  cellsY: u32,
  cellsZ: u32,
  originX: f32,
  originY: f32,
  originZ: f32,
  // 3 floats of padding to keep struct 16-aligned (next member is u32 array binding)
  _pad0: f32, _pad1: f32, _pad2: f32,
};

@group(0) @binding(0) var<uniform> params: Params;

// Candidates: vec4f(x, y, z, density) — same layout sampleFieldGpu emits.
@group(0) @binding(1) var<storage, read> candidates: array<vec4f>;

// Per-voxel winner: high 24 bits = density (quantized), low 8 bits unused.
// Actually we pack (densityQ << 20) | (index & 0xFFFFF), so 1M candidate cap
// matches the engine ceiling and density gets 12 bits of resolution.
@group(0) @binding(2) var<storage, read_write> voxelWinner: array<atomic<u32>>;

// Per-candidate output: 0 rejected, 1 accepted.
@group(0) @binding(3) var<storage, read_write> accepted: array<u32>;

fn cellIndex(p: vec3f) -> i32 {
  let cx = i32(floor((p.x - params.originX) / params.cellSize));
  let cy = i32(floor((p.y - params.originY) / params.cellSize));
  let cz = i32(floor((p.z - params.originZ) / params.cellSize));
  if (cx < 0 || cy < 0 || cz < 0) { return -1; }
  if (u32(cx) >= params.cellsX || u32(cy) >= params.cellsY || u32(cz) >= params.cellsZ) {
    return -1;
  }
  return cx + cy * i32(params.cellsX) + cz * i32(params.cellsX * params.cellsY);
}

fn packed(densityQ: u32, idx: u32) -> u32 {
  // densityQ in [0, 4095], idx in [0, 1_048_575]. atomicMax favors higher density.
  return (densityQ << 20u) | (idx & 0xFFFFFu);
}

// ── Pass 1: each thread proposes itself to its voxel via atomicMax. ──
@compute @workgroup_size(64)
fn claim(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= params.candidateCount) { return; }
  let c = candidates[i];
  if (c.w <= 0.0) { return; }
  let cell = cellIndex(c.xyz);
  if (cell < 0) { return; }
  // Quantize density to 12 bits (0..4095). Clamp first.
  let dq = u32(clamp(c.w, 0.0, 1.0) * 4095.0);
  atomicMax(&voxelWinner[u32(cell)], packed(dq, i));
}

// ── Pass 2: candidate accepts itself iff it is its cell's winner AND
//    no neighboring winner sits closer than minDistance.
@compute @workgroup_size(64)
fn select(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= params.candidateCount) { return; }
  accepted[i] = 0u;
  let c = candidates[i];
  if (c.w <= 0.0) { return; }
  let cell = cellIndex(c.xyz);
  if (cell < 0) { return; }

  let winner = atomicLoad(&voxelWinner[u32(cell)]);
  let winnerIdx = winner & 0xFFFFFu;
  if (winnerIdx != i) { return; }

  // Scan 3x3x3 neighborhood for closer winners.
  let cx = i32(floor((c.x - params.originX) / params.cellSize));
  let cy = i32(floor((c.y - params.originY) / params.cellSize));
  let cz = i32(floor((c.z - params.originZ) / params.cellSize));
  let minD2 = params.minDistance * params.minDistance;
  for (var dz = -1; dz <= 1; dz = dz + 1) {
    for (var dy = -1; dy <= 1; dy = dy + 1) {
      for (var dx = -1; dx <= 1; dx = dx + 1) {
        if (dx == 0 && dy == 0 && dz == 0) { continue; }
        let nx = cx + dx;
        let ny = cy + dy;
        let nz = cz + dz;
        if (nx < 0 || ny < 0 || nz < 0) { continue; }
        if (u32(nx) >= params.cellsX || u32(ny) >= params.cellsY || u32(nz) >= params.cellsZ) { continue; }
        let nCell = u32(nx) + u32(ny) * params.cellsX + u32(nz) * params.cellsX * params.cellsY;
        let nWinner = atomicLoad(&voxelWinner[nCell]);
        let nIdx = nWinner & 0xFFFFFu;
        // Empty cell sentinel: voxelWinner is initialized to 0, which packs
        // density=0/index=0. We must distinguish "no winner" from "candidate 0".
        // Cheap guard: if neighbor's encoded density is 0, treat as empty.
        let nDensityQ = nWinner >> 20u;
        if (nDensityQ == 0u) { continue; }
        let n = candidates[nIdx];
        let diff = n.xyz - c.xyz;
        let d2 = dot(diff, diff);
        if (d2 < minD2) {
          // A neighbor winner (with density >= ours OR equal-density-lower-index)
          // is too close. Tie-break: lower index wins to keep result deterministic.
          let nDQ = nDensityQ;
          let myDQ = u32(clamp(c.w, 0.0, 1.0) * 4095.0);
          if (nDQ > myDQ) { return; }
          if (nDQ == myDQ && nIdx < i) { return; }
        }
      }
    }
  }
  accepted[i] = 1u;
}
`;
