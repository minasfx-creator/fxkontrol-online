/**
 * Fixture Auto-Layout Engine
 * 
 * Distributes imported fixtures spatially in the 3D viewport based on their
 * category/type, simulating a realistic stage layout:
 * 
 *   - spot / beam  → overhead truss (y=8–10m), spread along X
 *   - wash          → mid-height truss or floor (y=6m), arc arrangement
 *   - strobe        → truss front edge (y=9m), evenly spaced
 *   - led-bar       → ground level (y=0.3m), semicircle behind stage
 *   - sfx / pyro    → ground level (y=0), line across stage front
 *   - laser         → elevated rear (y=7m, z negative = upstage)
 *   - drone         → ground pads (y=0), grid behind stage
 *   - default       → ground level semicircle
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

interface CategoryConfig {
  /** Height above ground (meters) */
  y: number;
  /** Base Z depth (negative = upstage, positive = downstage) */
  baseZ: number;
  /** Spread radius along X axis */
  spreadX: number;
  /** Arrangement pattern */
  pattern: 'line' | 'arc' | 'grid';
  /** Arc angle in radians (for 'arc' pattern) */
  arcAngle?: number;
}

const CATEGORY_CONFIGS: Record<string, CategoryConfig> = {
  spot:     { y: 10, baseZ: -2,  spreadX: 20, pattern: 'line' },
  beam:     { y: 9,  baseZ: -4,  spreadX: 18, pattern: 'line' },
  wash:     { y: 7,  baseZ: 0,   spreadX: 16, pattern: 'arc', arcAngle: Math.PI * 0.6 },
  strobe:   { y: 9,  baseZ: 2,   spreadX: 14, pattern: 'line' },
  'led-bar':{ y: 0.3,baseZ: -6,  spreadX: 22, pattern: 'arc', arcAngle: Math.PI * 0.8 },
  sfx:      { y: 0,  baseZ: 4,   spreadX: 16, pattern: 'line' },
  laser:    { y: 7,  baseZ: -8,  spreadX: 12, pattern: 'line' },
  drone:    { y: 0,  baseZ: -12, spreadX: 20, pattern: 'grid' },
};

const DEFAULT_CONFIG: CategoryConfig = {
  y: 0, baseZ: 0, spreadX: 15, pattern: 'arc', arcAngle: Math.PI * 0.5,
};

/**
 * Compute 3D positions for a batch of fixtures.
 * Groups by category, then distributes each group according to its spatial config.
 */
export function computeFixtureLayout(fixtures: LayoutableFixture[]): LayoutResult[] {
  // Group by category
  const groups = new Map<string, number[]>();
  for (let i = 0; i < fixtures.length; i++) {
    const cat = fixtures[i].category;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(i);
  }

  const results: LayoutResult[] = new Array(fixtures.length);

  // Stack offset for categories sharing the same height tier
  let tierOffset = 0;

  for (const [category, indices] of groups) {
    const config = CATEGORY_CONFIGS[category] || DEFAULT_CONFIG;
    const count = indices.length;

    if (config.pattern === 'grid') {
      layoutGrid(indices, config, results, count);
    } else if (config.pattern === 'arc') {
      layoutArc(indices, config, results, count);
    } else {
      layoutLine(indices, config, results, count);
    }

    tierOffset++;
  }

  return results;
}

function layoutLine(indices: number[], config: CategoryConfig, out: LayoutResult[], count: number) {
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1; // -1 to 1
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
