/**
 * Parametric Effect System — Generative firework definitions.
 *
 * Replaces static presets with behavioural archetypes defined by
 * parameter ranges. Each slider in the LiveCard or Properties panel
 * modifies these values in real-time, feeding into burstSimulation.ts.
 *
 * The 20 existing EFFECT_LIBRARY presets become pre-configured instances
 * of this parametric system.
 */

// ── Burst Pattern Archetypes ──
export type BurstPattern =
  | 'peony'
  | 'chrysanthemum'
  | 'willow'
  | 'crossette'
  | 'kamuro'
  | 'brocade'
  | 'horsetail'
  | 'palm'
  | 'ring'
  | 'dahlia'
  | 'strobe'
  | 'mine'
  | 'comet'
  | 'waterfall'
  | 'girandola';

// ── Parameter Range (min, max, default) ──
export type ParamRange = readonly [min: number, max: number, defaultVal: number];

// ── Core Parametric Effect Definition ──
export interface ParametricEffect {
  /** Unique archetype ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Base burst pattern that determines physics behaviour */
  basePattern: BurstPattern;
  /** Mortar caliber in mm */
  caliber: ParamRange;
  /** Number of stars emitted */
  starCount: ParamRange;
  /** Initial radial velocity in m/s */
  velocity: ParamRange;
  /** Angular spread factor (0 = laser, 1.5 = wide hemisphere) */
  spread: ParamRange;
  /** Gravity multiplier (1.0 = earth gravity) */
  gravityScale: ParamRange;
  /** Star lifetime in seconds */
  lifetime: ParamRange;
  /** Trail persistence factor (0 = no trail, 3 = long trails) */
  trailFactor: ParamRange;
  /** Brightness decay rate k (higher = faster fade) */
  decayRate: ParamRange;
  /** Default VDL colour name */
  colorVDL: string;
  /** Number of sub-burst branches (crossette only, 0 for others) */
  branches: number;
  /** Whether stars have a secondary pistil break */
  hasPistil: boolean;
  /** Default pistil colour (VDL name) */
  pistilColor?: string;
  /** Description for the library UI */
  description: string;
}

// ── Resolved effect (with user overrides applied) ──
export interface ResolvedEffect {
  basePattern: BurstPattern;
  caliber: number;
  starCount: number;
  velocity: number;
  spread: number;
  gravityScale: number;
  lifetime: number;
  trailFactor: number;
  decayRate: number;
  colorVDL: string;
  branches: number;
  hasPistil: boolean;
  pistilColor?: string;
}

// ── Resolve a parametric effect with optional user overrides ──
export function resolveEffect(
  effect: ParametricEffect,
  overrides: Partial<Record<keyof ResolvedEffect, number | string | boolean>> = {}
): ResolvedEffect {
  const getVal = (range: ParamRange, key: string): number => {
    const override = overrides[key as keyof ResolvedEffect];
    if (typeof override === 'number') {
      return Math.max(range[0], Math.min(range[1], override));
    }
    return range[2]; // default
  };

  return {
    basePattern: effect.basePattern,
    caliber: getVal(effect.caliber, 'caliber'),
    starCount: Math.round(getVal(effect.starCount, 'starCount')),
    velocity: getVal(effect.velocity, 'velocity'),
    spread: getVal(effect.spread, 'spread'),
    gravityScale: getVal(effect.gravityScale, 'gravityScale'),
    lifetime: getVal(effect.lifetime, 'lifetime'),
    trailFactor: getVal(effect.trailFactor, 'trailFactor'),
    decayRate: getVal(effect.decayRate, 'decayRate'),
    colorVDL: (typeof overrides.colorVDL === 'string' ? overrides.colorVDL : effect.colorVDL),
    branches: typeof overrides.branches === 'number' ? overrides.branches : effect.branches,
    hasPistil: typeof overrides.hasPistil === 'boolean' ? overrides.hasPistil : effect.hasPistil,
    pistilColor: typeof overrides.pistilColor === 'string' ? overrides.pistilColor : effect.pistilColor,
  };
}

// ── Slider configuration for UI rendering ──
export interface ParameterSliderConfig {
  key: keyof ResolvedEffect;
  label: string;
  unit: string;
  step: number;
  range: ParamRange;
}

export function getSlidersForEffect(effect: ParametricEffect): ParameterSliderConfig[] {
  return [
    { key: 'caliber', label: 'Caliber', unit: 'mm', step: 5, range: effect.caliber },
    { key: 'starCount', label: 'Stars', unit: '', step: 1, range: effect.starCount },
    { key: 'velocity', label: 'Velocity', unit: 'm/s', step: 0.5, range: effect.velocity },
    { key: 'spread', label: 'Spread', unit: '', step: 0.05, range: effect.spread },
    { key: 'gravityScale', label: 'Gravity', unit: '×', step: 0.1, range: effect.gravityScale },
    { key: 'lifetime', label: 'Lifetime', unit: 's', step: 0.1, range: effect.lifetime },
    { key: 'trailFactor', label: 'Trail', unit: '', step: 0.1, range: effect.trailFactor },
    { key: 'decayRate', label: 'Decay', unit: '', step: 0.1, range: effect.decayRate },
  ];
}

// ═══════════════════════════════════════════════════════════════════════
// ── PARAMETRIC PRESETS — Core Archetypes ──
// ═══════════════════════════════════════════════════════════════════════

export const PARAMETRIC_PRESETS: ParametricEffect[] = [
  {
    id: 'param-peony',
    name: 'Peony',
    basePattern: 'peony',
    caliber: [50, 300, 100],
    starCount: [30, 400, 120],
    velocity: [15, 45, 28],
    spread: [0.8, 1.5, 1.0],
    gravityScale: [0.8, 2.0, 1.0],
    lifetime: [1.0, 4.0, 2.2],
    trailFactor: [0, 0.3, 0],
    decayRate: [0.5, 3.0, 1.2],
    colorVDL: 'Red',
    branches: 0,
    hasPistil: false,
    description: 'Symmetric spherical burst with no trails. Pure colour sphere.',
  },
  {
    id: 'param-chrysanthemum',
    name: 'Chrysanthemum',
    basePattern: 'chrysanthemum',
    caliber: [75, 300, 150],
    starCount: [80, 500, 200],
    velocity: [20, 50, 35],
    spread: [0.9, 1.4, 1.1],
    gravityScale: [0.6, 1.8, 1.0],
    lifetime: [2.0, 6.0, 3.5],
    trailFactor: [0.5, 3.0, 1.5],
    decayRate: [0.3, 2.0, 0.8],
    colorVDL: 'Gold',
    branches: 0,
    hasPistil: false,
    description: 'Spherical burst with luminous trails throughout the ballistic descent.',
  },
  {
    id: 'param-willow',
    name: 'Willow',
    basePattern: 'willow',
    caliber: [100, 300, 150],
    starCount: [60, 300, 150],
    velocity: [8, 25, 14],
    spread: [0.6, 1.2, 0.9],
    gravityScale: [1.5, 3.0, 2.2],
    lifetime: [3.0, 8.0, 5.0],
    trailFactor: [1.5, 3.0, 2.5],
    decayRate: [0.2, 1.0, 0.4],
    colorVDL: 'Gold',
    branches: 0,
    hasPistil: false,
    description: 'Low-velocity burst with heavy gravity. Long-lasting cascading golden rain.',
  },
  {
    id: 'param-crossette',
    name: 'Crossette',
    basePattern: 'crossette',
    caliber: [75, 200, 100],
    starCount: [20, 80, 36],
    velocity: [20, 40, 30],
    spread: [0.8, 1.3, 1.0],
    gravityScale: [0.8, 1.5, 1.0],
    lifetime: [1.5, 3.5, 2.0],
    trailFactor: [0.3, 1.5, 0.8],
    decayRate: [0.8, 2.5, 1.5],
    colorVDL: 'Silver',
    branches: 4,
    hasPistil: false,
    description: 'Stars that sub-burst into 4 perpendicular fragments after a delay.',
  },
  {
    id: 'param-kamuro',
    name: 'Kamuro',
    basePattern: 'kamuro',
    caliber: [100, 300, 200],
    starCount: [100, 500, 250],
    velocity: [12, 30, 20],
    spread: [0.7, 1.2, 0.9],
    gravityScale: [1.2, 2.5, 1.8],
    lifetime: [4.0, 8.0, 6.0],
    trailFactor: [2.0, 3.0, 2.8],
    decayRate: [0.1, 0.8, 0.3],
    colorVDL: 'Gold',
    branches: 0,
    hasPistil: false,
    description: 'Dense golden waterfall with extremely long-lasting bright trails.',
  },
  {
    id: 'param-brocade',
    name: 'Brocade Crown',
    basePattern: 'brocade',
    caliber: [100, 300, 150],
    starCount: [80, 400, 180],
    velocity: [15, 35, 25],
    spread: [0.8, 1.3, 1.0],
    gravityScale: [1.0, 2.0, 1.4],
    lifetime: [2.5, 5.0, 3.5],
    trailFactor: [1.0, 2.5, 1.8],
    decayRate: [0.3, 1.5, 0.6],
    colorVDL: 'Gold',
    branches: 0,
    hasPistil: true,
    pistilColor: 'Green',
    description: 'Golden crown with trailing stars and coloured pistil centre break.',
  },
  {
    id: 'param-horsetail',
    name: 'Horsetail',
    basePattern: 'horsetail',
    caliber: [75, 200, 125],
    starCount: [40, 200, 100],
    velocity: [10, 25, 16],
    spread: [0.3, 0.8, 0.5],
    gravityScale: [1.5, 3.0, 2.0],
    lifetime: [3.0, 7.0, 4.5],
    trailFactor: [2.0, 3.0, 2.5],
    decayRate: [0.2, 1.0, 0.5],
    colorVDL: 'Gold',
    branches: 0,
    hasPistil: false,
    description: 'Narrow burst that falls like a horse tail. Gravity-dominated cascade.',
  },
  {
    id: 'param-palm',
    name: 'Palm',
    basePattern: 'palm',
    caliber: [100, 300, 150],
    starCount: [8, 30, 12],
    velocity: [20, 45, 32],
    spread: [0.4, 1.0, 0.7],
    gravityScale: [0.8, 1.8, 1.2],
    lifetime: [2.0, 5.0, 3.0],
    trailFactor: [1.5, 3.0, 2.2],
    decayRate: [0.4, 1.5, 0.8],
    colorVDL: 'Gold',
    branches: 0,
    hasPistil: false,
    description: 'Few thick-trailed stars arcing outward like palm fronds.',
  },
  {
    id: 'param-ring',
    name: 'Ring',
    basePattern: 'ring',
    caliber: [75, 200, 125],
    starCount: [20, 80, 40],
    velocity: [20, 40, 28],
    spread: [0.05, 0.3, 0.1],
    gravityScale: [0.3, 1.0, 0.5],
    lifetime: [1.5, 3.5, 2.0],
    trailFactor: [0, 1.0, 0.3],
    decayRate: [0.5, 2.0, 1.0],
    colorVDL: 'White',
    branches: 0,
    hasPistil: false,
    description: 'Stars emitted on a toroidal plane forming a visible ring shape.',
  },
  {
    id: 'param-dahlia',
    name: 'Dahlia',
    basePattern: 'dahlia',
    caliber: [75, 250, 150],
    starCount: [15, 60, 30],
    velocity: [25, 50, 38],
    spread: [0.6, 1.2, 0.9],
    gravityScale: [0.8, 1.5, 1.0],
    lifetime: [1.5, 4.0, 2.5],
    trailFactor: [0, 0.5, 0.1],
    decayRate: [0.8, 2.5, 1.5],
    colorVDL: 'Red',
    branches: 0,
    hasPistil: false,
    description: 'Fewer, larger stars with wider gaps creating a flower-petal pattern.',
  },
];

// ── Lookup helpers ──
const _presetMap = new Map(PARAMETRIC_PRESETS.map(p => [p.id, p]));

export function getParametricPreset(id: string): ParametricEffect | undefined {
  return _presetMap.get(id);
}

export function getParametricPresetByPattern(pattern: BurstPattern): ParametricEffect | undefined {
  return PARAMETRIC_PRESETS.find(p => p.basePattern === pattern);
}
