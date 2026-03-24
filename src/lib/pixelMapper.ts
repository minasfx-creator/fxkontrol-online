/**
 * Pixel Mapper — Extended with matrix/snake topologies, grouping,
 * DMX output routing, and PixelMappingManager (from BP_PixelMappingManager).
 */

export type Topology = 'grid' | 'circle' | 'custom' | 'matrix' | 'snake';

export interface PixelMapConfig {
  topology: Topology;
  columns: number;
  rows: number;
  groupSize?: number;
  startCorner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export interface MappedPixel {
  index: number;
  fixtureId: string;
  gridX: number;
  gridY: number;
  normX: number;
  normY: number;
}

export interface DMXPixelOutput {
  universe: number;
  startChannel: number;
  pixelIndex: number;
}

function applyStartCorner(
  gx: number, gy: number, cols: number, rows: number,
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
): { gx: number; gy: number } {
  switch (corner) {
    case 'top-right': return { gx: cols - 1 - gx, gy };
    case 'bottom-left': return { gx, gy: rows - 1 - gy };
    case 'bottom-right': return { gx: cols - 1 - gx, gy: rows - 1 - gy };
    default: return { gx, gy };
  }
}

export function mapFixturesToGrid(
  fixtures: { id: string; x: number; z: number }[],
  config: PixelMapConfig
): MappedPixel[] {
  if (fixtures.length === 0) return [];

  const { topology, columns, rows, groupSize = 1, startCorner = 'top-left' } = config;

  if (topology === 'grid' || topology === 'matrix') {
    const sorted = topology === 'matrix'
      ? [...fixtures]
      : [...fixtures].sort((a, b) => a.z !== b.z ? a.z - b.z : a.x - b.x);

    return sorted.map((f, i) => {
      const groupIdx = groupSize > 1 ? Math.floor(i / groupSize) : i;
      let gx = groupIdx % columns;
      let gy = Math.floor(groupIdx / columns) % rows;
      ({ gx, gy } = applyStartCorner(gx, gy, columns, rows, startCorner));
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

  if (topology === 'snake') {
    const sorted = [...fixtures].sort((a, b) => a.z !== b.z ? a.z - b.z : a.x - b.x);
    return sorted.map((f, i) => {
      const groupIdx = groupSize > 1 ? Math.floor(i / groupSize) : i;
      let gy = Math.floor(groupIdx / columns) % rows;
      let gx = groupIdx % columns;
      if (gy % 2 === 1) gx = columns - 1 - gx;
      ({ gx, gy } = applyStartCorner(gx, gy, columns, rows, startCorner));
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

  // custom
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

export function getPixelCount(config: PixelMapConfig): number {
  return config.columns * config.rows;
}

export function mapFixturesToDMXOutput(
  pixels: MappedPixel[],
  channelsPerPixel = 3,
  startUniverse = 1,
  startChannel = 1,
): DMXPixelOutput[] {
  const results: DMXPixelOutput[] = [];
  let currentChannel = startChannel;
  let currentUniverse = startUniverse;

  for (const pixel of pixels) {
    if (currentChannel + channelsPerPixel - 1 > 512) {
      currentUniverse++;
      currentChannel = 1;
    }
    results.push({
      universe: currentUniverse,
      startChannel: currentChannel,
      pixelIndex: pixel.index,
    });
    currentChannel += channelsPerPixel;
  }
  return results;
}

export class PixelMappingManager {
  private groups = new Map<string, {
    fixtures: { id: string; x: number; z: number }[];
    config: PixelMapConfig;
    mapping: MappedPixel[];
  }>();

  addGroup(name: string, fixtures: { id: string; x: number; z: number }[], config: PixelMapConfig): void {
    const mapping = mapFixturesToGrid(fixtures, config);
    this.groups.set(name, { fixtures, config, mapping });
  }

  removeGroup(name: string): void {
    this.groups.delete(name);
  }

  getMapping(groupName: string): MappedPixel[] {
    return this.groups.get(groupName)?.mapping ?? [];
  }

  getConfig(groupName: string): PixelMapConfig | undefined {
    return this.groups.get(groupName)?.config;
  }

  getAllMappings(): Map<string, MappedPixel[]> {
    const result = new Map<string, MappedPixel[]>();
    for (const [name, group] of this.groups) {
      result.set(name, group.mapping);
    }
    return result;
  }

  getGroupNames(): string[] {
    return Array.from(this.groups.keys());
  }

  getDMXOutput(groupName: string, channelsPerPixel = 3, startUniverse = 1): DMXPixelOutput[] {
    const mapping = this.getMapping(groupName);
    return mapFixturesToDMXOutput(mapping, channelsPerPixel, startUniverse);
  }
}
