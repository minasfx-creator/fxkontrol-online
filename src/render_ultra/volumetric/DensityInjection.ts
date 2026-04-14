/**
 * DensityInjection — Seeds voxel grid from particle emitters.
 * Gaussian falloff, no uniform fill, zero allocation in hot path.
 */
import { VoxelGrid } from './VoxelGrid';

export interface InjectionSource {
  position: [number, number, number];
  radius: number;
  density: number;
  temperature: number;
  emissive: number;
  velocity?: [number, number, number];
}

const _gaussian = (d: number, r: number) => Math.exp(-(d * d) / (2 * r * r));

export function injectSources(grid: VoxelGrid, sources: InjectionSource[]): void {
  for (const src of sources) {
    const [cx, cy, cz] = grid.worldToGrid(src.position[0], src.position[1], src.position[2]);

    // Radius in grid cells
    const cellSizeX = grid.worldSize[0] / grid.resX;
    const cellSizeY = grid.worldSize[1] / grid.resY;
    const cellSizeZ = grid.worldSize[2] / grid.resZ;
    const radiusCellsX = Math.ceil(src.radius / cellSizeX);
    const radiusCellsY = Math.ceil(src.radius / cellSizeY);
    const radiusCellsZ = Math.ceil(src.radius / cellSizeZ);

    const x0 = Math.max(0, cx - radiusCellsX);
    const x1 = Math.min(grid.resX - 1, cx + radiusCellsX);
    const y0 = Math.max(0, cy - radiusCellsY);
    const y1 = Math.min(grid.resY - 1, cy + radiusCellsY);
    const z0 = Math.max(0, cz - radiusCellsZ);
    const z1 = Math.min(grid.resZ - 1, cz + radiusCellsZ);

    for (let z = z0; z <= z1; z++) {
      const dz = (z - cz) * cellSizeZ;
      for (let y = y0; y <= y1; y++) {
        const dy = (y - cy) * cellSizeY;
        for (let x = x0; x <= x1; x++) {
          const dx = (x - cx) * cellSizeX;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > src.radius) continue;

          const w = _gaussian(dist, src.radius * 0.5);
          const idx = grid.index(x, y, z);

          grid.density[idx] += src.density * w;
          grid.temperature[idx] = Math.max(grid.temperature[idx], src.temperature * w);
          grid.emissive[idx] += src.emissive * w;

          if (src.velocity) {
            grid.velocityX[idx] += src.velocity[0] * w;
            grid.velocityY[idx] += src.velocity[1] * w;
            grid.velocityZ[idx] += src.velocity[2] * w;
          }
        }
      }
    }
  }
  grid.markDirty();
}
