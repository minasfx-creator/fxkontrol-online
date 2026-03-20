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
