/**
 * Fixture Auto-Layout Engine
 * 
 * Distributes imported fixtures spatially in the 3D viewport based on their
 * category/type, with support for venue presets and per-category overrides.
 */

export interface LayoutableFixture {
  name: string;
  category: string;
  universe: number;
  startChannel: number;
}

export interface LayoutResult {
  x: number;
  y: number;
  z: number;
}

export type LayoutPreset = 'stage' | 'arena' | 'festival';

export interface LayoutOverrides {
  spreadScale?: number;   // multiplier on spreadX (default 1.0)
  heightOffset?: number;  // additive offset on y (default 0)
}

interface CategoryConfig {
  y: number;
  baseZ: number;
  spreadX: number;
  pattern: 'line' | 'arc' | 'grid';
  arcAngle?: number;
}

const STAGE_CONFIGS: Record<string, CategoryConfig> = {
  spot:     { y: 10, baseZ: -2,  spreadX: 20, pattern: 'line' },
  beam:     { y: 9,  baseZ: -4,  spreadX: 18, pattern: 'line' },
  wash:     { y: 7,  baseZ: 0,   spreadX: 16, pattern: 'arc', arcAngle: Math.PI * 0.6 },
  strobe:   { y: 9,  baseZ: 2,   spreadX: 14, pattern: 'line' },
  'led-bar':{ y: 0.3,baseZ: -6,  spreadX: 22, pattern: 'arc', arcAngle: Math.PI * 0.8 },
  sfx:      { y: 0,  baseZ: 4,   spreadX: 16, pattern: 'line' },
  laser:    { y: 7,  baseZ: -8,  spreadX: 12, pattern: 'line' },
  drone:    { y: 0,  baseZ: -12, spreadX: 20, pattern: 'grid' },
};

const ARENA_CONFIGS: Record<string, CategoryConfig> = {
  spot:     { y: 12, baseZ: 0,   spreadX: 24, pattern: 'arc', arcAngle: Math.PI * 1.8 },
  beam:     { y: 11, baseZ: 0,   spreadX: 22, pattern: 'arc', arcAngle: Math.PI * 1.6 },
  wash:     { y: 8,  baseZ: 0,   spreadX: 20, pattern: 'arc', arcAngle: Math.PI * 2 },
  strobe:   { y: 10, baseZ: 0,   spreadX: 18, pattern: 'arc', arcAngle: Math.PI * 1.8 },
  'led-bar':{ y: 0.3,baseZ: 0,   spreadX: 26, pattern: 'arc', arcAngle: Math.PI * 2 },
  sfx:      { y: 0,  baseZ: 0,   spreadX: 20, pattern: 'arc', arcAngle: Math.PI * 2 },
  laser:    { y: 8,  baseZ: 0,   spreadX: 16, pattern: 'arc', arcAngle: Math.PI * 1.4 },
  drone:    { y: 0,  baseZ: -14, spreadX: 24, pattern: 'grid' },
};

const FESTIVAL_CONFIGS: Record<string, CategoryConfig> = {
  spot:     { y: 14, baseZ: -3,  spreadX: 30, pattern: 'line' },
  beam:     { y: 13, baseZ: -6,  spreadX: 28, pattern: 'line' },
  wash:     { y: 10, baseZ: 0,   spreadX: 24, pattern: 'arc', arcAngle: Math.PI * 0.7 },
  strobe:   { y: 12, baseZ: 3,   spreadX: 22, pattern: 'line' },
  'led-bar':{ y: 0.3,baseZ: -8,  spreadX: 34, pattern: 'arc', arcAngle: Math.PI * 0.9 },
  sfx:      { y: 0,  baseZ: 6,   spreadX: 24, pattern: 'line' },
  laser:    { y: 10, baseZ: -12, spreadX: 18, pattern: 'line' },
  drone:    { y: 0,  baseZ: -20, spreadX: 30, pattern: 'grid' },
};

const PRESET_MAP: Record<LayoutPreset, Record<string, CategoryConfig>> = {
  stage: STAGE_CONFIGS,
  arena: ARENA_CONFIGS,
  festival: FESTIVAL_CONFIGS,
};

const DEFAULT_CONFIG: CategoryConfig = {
  y: 0, baseZ: 0, spreadX: 15, pattern: 'arc', arcAngle: Math.PI * 0.5,
};

/**
 * Compute 3D positions for a batch of fixtures.
 * Groups by category, then distributes each group according to its spatial config.
 */
export function computeFixtureLayout(
  fixtures: LayoutableFixture[],
  preset: LayoutPreset = 'stage',
  categoryOverrides?: Record<string, LayoutOverrides>,
): LayoutResult[] {
  const configs = PRESET_MAP[preset] || STAGE_CONFIGS;

  // Group by category
  const groups = new Map<string, number[]>();
  for (let i = 0; i < fixtures.length; i++) {
    const cat = fixtures[i].category;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(i);
  }

  const results: LayoutResult[] = new Array(fixtures.length);

  for (const [category, indices] of groups) {
    let config = { ...(configs[category] || DEFAULT_CONFIG) };

    // Apply per-category overrides
    const ov = categoryOverrides?.[category];
    if (ov) {
      if (ov.spreadScale !== undefined) config.spreadX *= ov.spreadScale;
      if (ov.heightOffset !== undefined) config.y += ov.heightOffset;
    }

    const count = indices.length;
    if (config.pattern === 'grid') {
      layoutGrid(indices, config, results, count);
    } else if (config.pattern === 'arc') {
      layoutArc(indices, config, results, count);
    } else {
      layoutLine(indices, config, results, count);
    }
  }

  return results;
}

function layoutLine(indices: number[], config: CategoryConfig, out: LayoutResult[], count: number) {
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
    out[indices[i]] = {
      x: t * config.spreadX * 0.5,
      y: config.y,
      z: config.baseZ,
    };
  }
}

function layoutArc(indices: number[], config: CategoryConfig, out: LayoutResult[], count: number) {
  const angle = config.arcAngle || Math.PI * 0.6;
  const startAngle = Math.PI * 0.5 - angle * 0.5;

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const a = startAngle + t * angle;
    const radius = config.spreadX * 0.5;
    out[indices[i]] = {
      x: Math.cos(a) * radius,
      y: config.y,
      z: config.baseZ + Math.sin(a) * radius * 0.3 - radius * 0.15,
    };
  }
}

function layoutGrid(indices: number[], config: CategoryConfig, out: LayoutResult[], count: number) {
  const cols = Math.ceil(Math.sqrt(count));
  const spacing = config.spreadX / Math.max(cols, 1);

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    out[indices[i]] = {
      x: (col - (cols - 1) * 0.5) * spacing,
      y: config.y,
      z: config.baseZ - row * spacing,
    };
  }
}
