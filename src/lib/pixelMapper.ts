/**
 * Pixel Mapper
 * Maps fixture/drone positions to a virtual 2D grid for generative engine output.
 */

export type Topology = 'grid' | 'circle' | 'custom';

export interface PixelMapConfig {
  topology: Topology;
  columns: number;
  rows: number;
}

export interface MappedPixel {
  index: number;         // pixel index for generative engine
  fixtureId: string;     // position/drone id
  gridX: number;         // 0-based column
  gridY: number;         // 0-based row
  normX: number;         // 0-1 normalized x
  normY: number;         // 0-1 normalized y
}

/**
 * Map fixture positions to a pixel grid.
 */
export function mapFixturesToGrid(
  fixtures: { id: string; x: number; z: number }[],
  config: PixelMapConfig
): MappedPixel[] {
  if (fixtures.length === 0) return [];

  const { topology, columns, rows } = config;

  if (topology === 'grid') {
    // Sort fixtures by Z then X and assign to grid cells
    const sorted = [...fixtures].sort((a, b) => a.z !== b.z ? a.z - b.z : a.x - b.x);
    return sorted.map((f, i) => {
      const gx = i % columns;
      const gy = Math.floor(i / columns) % rows;
      return {
        index: i,
        fixtureId: f.id,
        gridX: gx,
        gridY: gy,
        normX: columns > 1 ? gx / (columns - 1) : 0.5,
        normY: rows > 1 ? gy / (rows - 1) : 0.5,
      };
    });
  }

  if (topology === 'circle') {
    return fixtures.map((f, i) => {
      const angle = (i / fixtures.length) * Math.PI * 2;
      return {
        index: i,
        fixtureId: f.id,
        gridX: i % columns,
        gridY: Math.floor(i / columns),
        normX: (Math.cos(angle) + 1) / 2,
        normY: (Math.sin(angle) + 1) / 2,
      };
    });
  }

  // custom — use raw position normalized
  const minX = Math.min(...fixtures.map(f => f.x));
  const maxX = Math.max(...fixtures.map(f => f.x));
  const minZ = Math.min(...fixtures.map(f => f.z));
  const maxZ = Math.max(...fixtures.map(f => f.z));
  const rangeX = maxX - minX || 1;
  const rangeZ = maxZ - minZ || 1;

  return fixtures.map((f, i) => ({
    index: i,
    fixtureId: f.id,
    gridX: i % columns,
    gridY: Math.floor(i / columns),
    normX: (f.x - minX) / rangeX,
    normY: (f.z - minZ) / rangeZ,
  }));
}

/**
 * Get total pixel count for a given config.
 */
export function getPixelCount(config: PixelMapConfig): number {
  return config.columns * config.rows;
}
