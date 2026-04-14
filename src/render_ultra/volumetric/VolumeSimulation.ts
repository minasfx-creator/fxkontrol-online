/**
 * VolumeSimulation — CPU semi-Lagrangian advection with curl noise turbulence.
 * 5-phase dissipation: breakup → density → contrast → emissive → residual.
 * Zero allocation in hot path.
 */
import { VoxelGrid } from './VoxelGrid';

export interface SimulationConfig {
  windX: number;
  windY: number;
  windZ: number;
  buoyancy: number;
  turbulenceScale: number;
  turbulenceSpeed: number;
  dissipationRate: number;
  coolingRate: number;
}

export const DEFAULT_SIM_CONFIG: SimulationConfig = {
  windX: 0.3,
  windY: 0,
  windZ: 0,
  buoyancy: 2.0,
  turbulenceScale: 0.15,
  turbulenceSpeed: 0.8,
  dissipationRate: 0.12,
  coolingRate: 0.2,
};

// Simple 3D value noise (deterministic, no alloc)
function valueNoise3D(x: number, y: number, z: number): number {
  const ix = Math.floor(x); const iy = Math.floor(y); const iz = Math.floor(z);
  const fx = x - ix; const fy = y - iy; const fz = z - iz;
  const hash = (a: number, b: number, c: number) => {
    let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
    h = ((h >> 13) ^ h) * 1274126177;
    return ((h >> 16) ^ h) & 0x7fffffff;
  };
  const s = 1 / 0x7fffffff;
  const n000 = hash(ix, iy, iz) * s;
  const n100 = hash(ix + 1, iy, iz) * s;
  const n010 = hash(ix, iy + 1, iz) * s;
  const n110 = hash(ix + 1, iy + 1, iz) * s;
  const n001 = hash(ix, iy, iz + 1) * s;
  const n101 = hash(ix + 1, iy, iz + 1) * s;
  const n011 = hash(ix, iy + 1, iz + 1) * s;
  const n111 = hash(ix + 1, iy + 1, iz + 1) * s;

  const nx00 = n000 + (n100 - n000) * fx;
  const nx10 = n010 + (n110 - n010) * fx;
  const nx01 = n001 + (n101 - n001) * fx;
  const nx11 = n011 + (n111 - n011) * fx;
  const nxy0 = nx00 + (nx10 - nx00) * fy;
  const nxy1 = nx01 + (nx11 - nx01) * fy;
  return nxy0 + (nxy1 - nxy0) * fz;
}

// Curl noise from value noise (divergence-free)
function curlNoise(x: number, y: number, z: number, e: number): [number, number, number] {
  const dnydz = (valueNoise3D(x, y, z + e) - valueNoise3D(x, y, z - e)) / (2 * e);
  const dnzdy = (valueNoise3D(x, y + e, z) - valueNoise3D(x, y - e, z)) / (2 * e);
  const dnzdx = (valueNoise3D(x + e, y, z) - valueNoise3D(x - e, y, z)) / (2 * e);
  const dnxdz = (valueNoise3D(x, y, z + e) - valueNoise3D(x, y, z - e)) / (2 * e);
  const dnxdy = (valueNoise3D(x, y + e, z) - valueNoise3D(x, y - e, z)) / (2 * e);
  const dnydx = (valueNoise3D(x + e, y, z) - valueNoise3D(x - e, y, z)) / (2 * e);
  return [dnydz - dnzdy, dnzdx - dnxdz, dnxdy - dnydx];
}

// Scratch buffer for advection (reused)
let _scratchDensity: Float32Array | null = null;

export function simulateVolume(grid: VoxelGrid, dt: number, time: number, cfg: SimulationConfig = DEFAULT_SIM_CONFIG): void {
  const { resX, resY, resZ } = grid;
  const n = grid.cellCount;

  // Ensure scratch buffer
  if (!_scratchDensity || _scratchDensity.length < n) {
    _scratchDensity = new Float32Array(n);
  }

  const csX = grid.worldSize[0] / resX;
  const csY = grid.worldSize[1] / resY;
  const csZ = grid.worldSize[2] / resZ;

  // 1. Advect + turbulence + buoyancy
  _scratchDensity.fill(0);
  for (let z = 0; z < resZ; z++) {
    for (let y = 0; y < resY; y++) {
      for (let x = 0; x < resX; x++) {
        const idx = grid.index(x, y, z);
        if (grid.density[idx] < 0.001) continue;

        // World position of cell
        const wx = x * csX + grid.worldOrigin[0] - grid.worldSize[0] * 0.5;
        const wy = y * csY + grid.worldOrigin[1] - grid.worldSize[1] * 0.5;
        const wz = z * csZ + grid.worldOrigin[2] - grid.worldSize[2] * 0.5;

        // Curl noise turbulence
        const ts = cfg.turbulenceScale;
        const [cx, cy, cz] = curlNoise(wx * ts + time * cfg.turbulenceSpeed, wy * ts, wz * ts, 0.5);

        // Total velocity
        const vx = grid.velocityX[idx] + cfg.windX + cx * cfg.turbulenceScale * 5;
        const vy = grid.velocityY[idx] + cfg.windY + cfg.buoyancy * grid.temperature[idx] + cy * cfg.turbulenceScale * 3;
        const vz = grid.velocityZ[idx] + cfg.windZ + cz * cfg.turbulenceScale * 5;

        // Semi-Lagrangian backtrace
        const srcX = Math.max(0, Math.min(resX - 1.001, x - vx * dt / csX));
        const srcY = Math.max(0, Math.min(resY - 1.001, y - vy * dt / csY));
        const srcZ = Math.max(0, Math.min(resZ - 1.001, z - vz * dt / csZ));

        // Trilinear sample from source
        const sx = Math.floor(srcX); const sy = Math.floor(srcY); const sz = Math.floor(srcZ);
        const fx = srcX - sx; const fy = srcY - sy; const fz = srcZ - sz;
        const sx1 = Math.min(sx + 1, resX - 1);
        const sy1 = Math.min(sy + 1, resY - 1);
        const sz1 = Math.min(sz + 1, resZ - 1);

        const d000 = grid.density[grid.index(sx, sy, sz)];
        const d100 = grid.density[grid.index(sx1, sy, sz)];
        const d010 = grid.density[grid.index(sx, sy1, sz)];
        const d110 = grid.density[grid.index(sx1, sy1, sz)];
        const d001 = grid.density[grid.index(sx, sy, sz1)];
        const d101 = grid.density[grid.index(sx1, sy, sz1)];
        const d011 = grid.density[grid.index(sx, sy1, sz1)];
        const d111 = grid.density[grid.index(sx1, sy1, sz1)];

        const dx00 = d000 + (d100 - d000) * fx;
        const dx10 = d010 + (d110 - d010) * fx;
        const dx01 = d001 + (d101 - d001) * fx;
        const dx11 = d011 + (d111 - d011) * fx;
        const dxy0 = dx00 + (dx10 - dx00) * fy;
        const dxy1 = dx01 + (dx11 - dx01) * fy;
        _scratchDensity[idx] = dxy0 + (dxy1 - dxy0) * fz;
      }
    }
  }

  // Write back advected density
  grid.density.set(_scratchDensity.subarray(0, n));

  // 2. Five-phase dissipation
  for (let i = 0; i < n; i++) {
    if (grid.density[i] < 0.001 && grid.emissive[i] < 0.001) continue;

    grid.age[i] += dt;
    const a = grid.age[i];

    // Phase 1: Volume breakup (edges fragment via turbulence increase)
    if (a > 0.5) grid.turbulence[i] = Math.min(grid.turbulence[i] + dt * 0.3, 1.0);

    // Phase 2: Density reduction
    grid.density[i] *= 1 - cfg.dissipationRate * dt;

    // Phase 3: Contrast loss (push toward average)
    if (a > 1.0) grid.density[i] *= 0.998;

    // Phase 4: Emissive decay
    grid.emissive[i] *= 1 - cfg.dissipationRate * dt * 2;

    // Phase 5: Residual fade
    if (grid.density[i] < 0.01) grid.density[i] *= 0.9;

    // Thermal cooling
    grid.temperature[i] *= 1 - cfg.coolingRate * dt;

    // Absorption tracks density
    grid.absorption[i] = grid.density[i] * 0.8;
  }

  grid.markDirty();
}
