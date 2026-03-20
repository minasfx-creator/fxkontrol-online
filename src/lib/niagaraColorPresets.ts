/**
 * Niagara-Inspired Color Presets
 * Extracted from UE5 Niagara firework particle systems.
 * Each preset defines primary, secondary, thermal gradient, and shader uniforms.
 */

export interface NiagaraColorPreset {
  id: string;
  name: string;
  source: string; // Original UE asset name
  primary: string;
  secondary: string;
  tertiary?: string;
  gradient: string[]; // Thermal gradient (hot → cool)
  shaderUniforms: {
    uColor: [number, number, number];
    uColor2: [number, number, number];
    uGlowIntensity: number;
    uFadeProfile: 'linear' | 'exponential' | 'ember';
  };
  particleProfile: {
    starCount: number;
    lifetime: number;
    velocity: number;
    drag: number;
    gravityScale: number;
    sparkleRate: number;
  };
  /** VDL color names that auto-match this preset */
  autoMatchColors?: string[];
  /** VDL type names that auto-match this preset */
  autoMatchTypes?: string[];
}

export const NIAGARA_COLOR_PRESETS: NiagaraColorPreset[] = [
  {
    id: 'niagara-blue',
    name: 'Niagara Blue Peony',
    source: 'Ns_Firework_Blue.uasset',
    primary: '#0066FF',
    secondary: '#00CCFF',
    tertiary: '#0033AA',
    gradient: ['#FFFFFF', '#88CCFF', '#0066FF', '#0033AA', '#001155'],
    shaderUniforms: {
      uColor: [0.0, 0.4, 1.0],
      uColor2: [0.0, 0.8, 1.0],
      uGlowIntensity: 2.2,
      uFadeProfile: 'exponential',
    },
    particleProfile: {
      starCount: 450,
      lifetime: 2.0,
      velocity: 42,
      drag: 0.97,
      gravityScale: 1.0,
      sparkleRate: 0.3,
    },
    autoMatchColors: ['blue', 'sea blue', 'sky blue'],
    autoMatchTypes: ['peony', 'chrysanthemum'],
  },
  {
    id: 'niagara-yellow',
    name: 'Niagara Gold Kamuro',
    source: 'Ns_Firework_Yellow.uasset',
    primary: '#FFD700',
    secondary: '#FF8C00',
    tertiary: '#FF6600',
    gradient: ['#FFFFFF', '#FFEE88', '#FFD700', '#FF8C00', '#884400'],
    shaderUniforms: {
      uColor: [1.0, 0.84, 0.0],
      uColor2: [1.0, 0.55, 0.0],
      uGlowIntensity: 2.8,
      uFadeProfile: 'ember',
    },
    particleProfile: {
      starCount: 600,
      lifetime: 3.5,
      velocity: 35,
      drag: 0.985,
      gravityScale: 0.7,
      sparkleRate: 0.6,
    },
    autoMatchColors: ['gold', 'yellow', 'lemon', 'amber', 'nishiki'],
    autoMatchTypes: ['kamuro', 'brocade', 'willow'],
  },
  {
    id: 'niagara-pink',
    name: 'Niagara Pink Multi-Break',
    source: 'Ns_Fireworks_Pink.uasset',
    primary: '#FF69B4',
    secondary: '#FF1493',
    tertiary: '#CC0066',
    gradient: ['#FFFFFF', '#FFAACC', '#FF69B4', '#FF1493', '#660033'],
    shaderUniforms: {
      uColor: [1.0, 0.41, 0.71],
      uColor2: [1.0, 0.08, 0.58],
      uGlowIntensity: 2.5,
      uFadeProfile: 'exponential',
    },
    particleProfile: {
      starCount: 350,
      lifetime: 1.8,
      velocity: 48,
      drag: 0.96,
      gravityScale: 1.1,
      sparkleRate: 0.4,
    },
    autoMatchColors: ['pink', 'fuchsia', 'rose', 'magenta'],
    autoMatchTypes: ['peony', 'dahlia'],
  },
  {
    id: 'niagara-red',
    name: 'Niagara Red Chrysanthemum',
    source: 'Ns_Firework_Red.uasset',
    primary: '#FF2020',
    secondary: '#CC0000',
    tertiary: '#880000',
    gradient: ['#FFFFFF', '#FF8866', '#FF2020', '#CC0000', '#440000'],
    shaderUniforms: {
      uColor: [1.0, 0.12, 0.12],
      uColor2: [0.8, 0.0, 0.0],
      uGlowIntensity: 2.4,
      uFadeProfile: 'exponential',
    },
    particleProfile: {
      starCount: 400,
      lifetime: 2.2,
      velocity: 40,
      drag: 0.965,
      gravityScale: 1.0,
      sparkleRate: 0.25,
    },
    autoMatchColors: ['red', 'ruby', 'scarlet', 'crimson'],
    autoMatchTypes: ['chrysanthemum', 'peony'],
  },
  {
    id: 'niagara-green',
    name: 'Niagara Green Palm',
    source: 'Ns_Firework_Green.uasset',
    primary: '#00CC44',
    secondary: '#008833',
    tertiary: '#005522',
    gradient: ['#FFFFFF', '#88FF99', '#00CC44', '#008833', '#003311'],
    shaderUniforms: {
      uColor: [0.0, 0.8, 0.27],
      uColor2: [0.0, 0.53, 0.2],
      uGlowIntensity: 2.0,
      uFadeProfile: 'linear',
    },
    particleProfile: {
      starCount: 380,
      lifetime: 2.5,
      velocity: 38,
      drag: 0.96,
      gravityScale: 1.0,
      sparkleRate: 0.2,
    },
    autoMatchColors: ['green', 'grass green', 'lime', 'emerald'],
    autoMatchTypes: ['palm', 'peony'],
  },
  {
    id: 'niagara-white',
    name: 'Niagara White Strobe',
    source: 'Ns_Firework_White.uasset',
    primary: '#EEEEFF',
    secondary: '#CCCCDD',
    tertiary: '#AAAACC',
    gradient: ['#FFFFFF', '#EEEEFF', '#CCCCDD', '#999999', '#333333'],
    shaderUniforms: {
      uColor: [0.93, 0.93, 1.0],
      uColor2: [0.8, 0.8, 0.87],
      uGlowIntensity: 3.0,
      uFadeProfile: 'linear',
    },
    particleProfile: {
      starCount: 500,
      lifetime: 1.6,
      velocity: 45,
      drag: 0.955,
      gravityScale: 1.05,
      sparkleRate: 0.8,
    },
    autoMatchColors: ['white', 'silver', 'titanium'],
    autoMatchTypes: ['peony', 'dahlia', 'crossette'],
  },
  {
    id: 'niagara-silver',
    name: 'Niagara Silver Kamuro',
    source: 'Ns_Firework_Silver.uasset',
    primary: '#C0C0D0',
    secondary: '#8888AA',
    tertiary: '#555566',
    gradient: ['#FFFFFF', '#DDDDEE', '#C0C0D0', '#8888AA', '#333344'],
    shaderUniforms: {
      uColor: [0.75, 0.75, 0.82],
      uColor2: [0.53, 0.53, 0.67],
      uGlowIntensity: 2.6,
      uFadeProfile: 'ember',
    },
    particleProfile: {
      starCount: 550,
      lifetime: 4.0,
      velocity: 30,
      drag: 0.99,
      gravityScale: 0.65,
      sparkleRate: 0.7,
    },
    autoMatchColors: ['silver', 'charcoal'],
    autoMatchTypes: ['kamuro', 'horsetail', 'willow'],
  },
  {
    id: 'niagara-purple',
    name: 'Niagara Purple Peony',
    source: 'Ns_Firework_Purple.uasset',
    primary: '#9933FF',
    secondary: '#6600CC',
    tertiary: '#440088',
    gradient: ['#FFFFFF', '#CC88FF', '#9933FF', '#6600CC', '#220044'],
    shaderUniforms: {
      uColor: [0.6, 0.2, 1.0],
      uColor2: [0.4, 0.0, 0.8],
      uGlowIntensity: 2.3,
      uFadeProfile: 'exponential',
    },
    particleProfile: {
      starCount: 420,
      lifetime: 2.0,
      velocity: 42,
      drag: 0.965,
      gravityScale: 1.0,
      sparkleRate: 0.35,
    },
    autoMatchColors: ['purple', 'violet', 'lavender', 'indigo'],
    autoMatchTypes: ['peony', 'chrysanthemum'],
  },
  {
    id: 'niagara-orange',
    name: 'Niagara Orange Dahlia',
    source: 'Ns_Firework_Orange.uasset',
    primary: '#FF6600',
    secondary: '#CC4400',
    tertiary: '#993300',
    gradient: ['#FFFFFF', '#FFAA55', '#FF6600', '#CC4400', '#441100'],
    shaderUniforms: {
      uColor: [1.0, 0.4, 0.0],
      uColor2: [0.8, 0.27, 0.0],
      uGlowIntensity: 2.6,
      uFadeProfile: 'ember',
    },
    particleProfile: {
      starCount: 350,
      lifetime: 1.5,
      velocity: 50,
      drag: 0.955,
      gravityScale: 1.1,
      sparkleRate: 0.3,
    },
    autoMatchColors: ['orange', 'peach', 'gamboge', 'copper'],
    autoMatchTypes: ['dahlia', 'peony'],
  },
];

/**
 * Get a preset by ID.
 */
export function getNiagaraPreset(id: string): NiagaraColorPreset | undefined {
  return NIAGARA_COLOR_PRESETS.find(p => p.id === id);
}

/**
 * Get all preset IDs.
 */
export function getNiagaraPresetIds(): string[] {
  return NIAGARA_COLOR_PRESETS.map(p => p.id);
}

/**
 * Convert preset colors to Three.js-compatible Color constructor args.
 */
export function presetToThreeColors(preset: NiagaraColorPreset) {
  return {
    primary: preset.shaderUniforms.uColor,
    secondary: preset.shaderUniforms.uColor2,
    glow: preset.shaderUniforms.uGlowIntensity,
  };
}

/**
 * Auto-match a Niagara preset based on VDL color name and type.
 * Returns the best matching preset or undefined if no good match.
 */
export function autoMatchNiagaraPreset(colorName: string, typeName: string): NiagaraColorPreset | undefined {
  const lowerColor = colorName.toLowerCase();
  const lowerType = typeName.toLowerCase();

  // Priority 1: exact color + type match
  for (const preset of NIAGARA_COLOR_PRESETS) {
    if (
      preset.autoMatchColors?.includes(lowerColor) &&
      preset.autoMatchTypes?.includes(lowerType)
    ) {
      return preset;
    }
  }

  // Priority 2: color match only
  for (const preset of NIAGARA_COLOR_PRESETS) {
    if (preset.autoMatchColors?.includes(lowerColor)) {
      return preset;
    }
  }

  return undefined;
}

/**
 * Build a NiagaraProfile object from a preset for use in the rendering pipeline.
 */
export function presetToNiagaraProfile(preset: NiagaraColorPreset) {
  return {
    starCount: preset.particleProfile.starCount,
    lifetime: preset.particleProfile.lifetime,
    velocity: preset.particleProfile.velocity,
    drag: preset.particleProfile.drag,
    gravityScale: preset.particleProfile.gravityScale,
    sparkleRate: preset.particleProfile.sparkleRate,
    glowIntensity: preset.shaderUniforms.uGlowIntensity,
    fadeProfile: preset.shaderUniforms.uFadeProfile,
  };
}
