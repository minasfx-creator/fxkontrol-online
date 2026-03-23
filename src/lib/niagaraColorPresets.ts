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
  // ── UE5 Blueprint-derived Presets ──
  {
    id: 'bp-firework-v2',
    name: 'BP Firework v2',
    source: 'BP_Firework_v2.uasset',
    primary: '#FF4422',
    secondary: '#FFAA00',
    tertiary: '#FF6600',
    gradient: ['#FFFFFF', '#FFCC44', '#FF4422', '#CC2200', '#440000'],
    shaderUniforms: {
      uColor: [1.0, 0.27, 0.13],
      uColor2: [1.0, 0.67, 0.0],
      uGlowIntensity: 3.0,
      uFadeProfile: 'ember',
    },
    particleProfile: {
      starCount: 500,
      lifetime: 2.5,
      velocity: 45,
      drag: 0.965,
      gravityScale: 1.0,
      sparkleRate: 0.5,
    },
    autoMatchColors: ['fire', 'flame'],
    autoMatchTypes: ['peony', 'chrysanthemum'],
  },
  {
    id: 'bp-pyro-v4',
    name: 'BP Pyro v4',
    source: 'BP_Pyro_v4.uasset',
    primary: '#FF8800',
    secondary: '#FF4400',
    tertiary: '#CC3300',
    gradient: ['#FFFFFF', '#FFBB44', '#FF8800', '#FF4400', '#331100'],
    shaderUniforms: {
      uColor: [1.0, 0.53, 0.0],
      uColor2: [1.0, 0.27, 0.0],
      uGlowIntensity: 3.5,
      uFadeProfile: 'ember',
    },
    particleProfile: {
      starCount: 300,
      lifetime: 1.5,
      velocity: 30,
      drag: 0.95,
      gravityScale: 0.8,
      sparkleRate: 0.2,
    },
    autoMatchColors: ['pyro', 'fire'],
    autoMatchTypes: ['gerb', 'flame'],
  },
  {
    id: 'bp-laser-extended',
    name: 'BP Laser Extended',
    source: 'BP_Laser_Extended.uasset',
    primary: '#00FF66',
    secondary: '#00CCFF',
    tertiary: '#FF0044',
    gradient: ['#FFFFFF', '#00FF66', '#00CCFF', '#FF0044', '#220011'],
    shaderUniforms: {
      uColor: [0.0, 1.0, 0.4],
      uColor2: [0.0, 0.8, 1.0],
      uGlowIntensity: 4.0,
      uFadeProfile: 'linear',
    },
    particleProfile: {
      starCount: 100,
      lifetime: 0.5,
      velocity: 200,
      drag: 1.0,
      gravityScale: 0.0,
      sparkleRate: 0.0,
    },
    autoMatchColors: ['laser'],
    autoMatchTypes: ['laser'],
  },
  {
    id: 'bp-sphere-orb',
    name: 'BP Sphere Orb',
    source: 'BP_Sphere.uasset',
    primary: '#88AAFF',
    secondary: '#FFFFFF',
    tertiary: '#4466CC',
    gradient: ['#FFFFFF', '#CCDDFF', '#88AAFF', '#4466CC', '#112244'],
    shaderUniforms: {
      uColor: [0.53, 0.67, 1.0],
      uColor2: [1.0, 1.0, 1.0],
      uGlowIntensity: 2.0,
      uFadeProfile: 'linear',
    },
    particleProfile: {
      starCount: 1,
      lifetime: 60,
      velocity: 0,
      drag: 1.0,
      gravityScale: 0.0,
      sparkleRate: 0.0,
    },
    autoMatchColors: ['orb', 'sphere'],
    autoMatchTypes: ['orb'],
  },
  // ── Effect-Type Presets (physics-calibrated per real pyrotechnics) ──
  {
    id: 'niagara-crossette',
    name: 'Niagara Crossette Split',
    source: 'Ns_Firework_Crossette.uasset',
    primary: '#FFFFFF',
    secondary: '#FFDD88',
    gradient: ['#FFFFFF', '#FFEE99', '#FFDD88', '#AA7744', '#332200'],
    shaderUniforms: {
      uColor: [1.0, 1.0, 1.0],
      uColor2: [1.0, 0.87, 0.53],
      uGlowIntensity: 2.8,
      uFadeProfile: 'linear' as const,
    },
    particleProfile: {
      starCount: 100,
      lifetime: 1.8,
      velocity: 50,
      drag: 0.95,
      gravityScale: 1.2,
      sparkleRate: 0.15,
    },
    autoMatchColors: [],
    autoMatchTypes: ['crossette'],
  },
  {
    id: 'niagara-mine',
    name: 'Niagara Mine Burst',
    source: 'Ns_Firework_Mine.uasset',
    primary: '#FFAA00',
    secondary: '#FF6600',
    gradient: ['#FFFFFF', '#FFCC44', '#FFAA00', '#FF6600', '#441100'],
    shaderUniforms: {
      uColor: [1.0, 0.67, 0.0],
      uColor2: [1.0, 0.4, 0.0],
      uGlowIntensity: 3.0,
      uFadeProfile: 'linear' as const,
    },
    particleProfile: {
      starCount: 200,
      lifetime: 1.5,
      velocity: 60,
      drag: 0.92,
      gravityScale: 0.8,
      sparkleRate: 0.2,
    },
    autoMatchColors: [],
    autoMatchTypes: ['mine'],
  },
  {
    id: 'niagara-comet',
    name: 'Niagara Comet Trail',
    source: 'Ns_Firework_Comet.uasset',
    primary: '#FFD700',
    secondary: '#FF8800',
    gradient: ['#FFFFFF', '#FFEE66', '#FFD700', '#FF8800', '#442200'],
    shaderUniforms: {
      uColor: [1.0, 0.84, 0.0],
      uColor2: [1.0, 0.53, 0.0],
      uGlowIntensity: 3.2,
      uFadeProfile: 'ember' as const,
    },
    particleProfile: {
      starCount: 50,
      lifetime: 3.0,
      velocity: 45,
      drag: 0.98,
      gravityScale: 0.9,
      sparkleRate: 0.4,
    },
    autoMatchColors: [],
    autoMatchTypes: ['comet'],
  },
  {
    id: 'niagara-palm',
    name: 'Niagara Palm Drooping',
    source: 'Ns_Firework_Palm.uasset',
    primary: '#FFB833',
    secondary: '#CC7700',
    gradient: ['#FFFFFF', '#FFDD77', '#FFB833', '#CC7700', '#442200'],
    shaderUniforms: {
      uColor: [1.0, 0.72, 0.2],
      uColor2: [0.8, 0.47, 0.0],
      uGlowIntensity: 2.4,
      uFadeProfile: 'exponential' as const,
    },
    particleProfile: {
      starCount: 250,
      lifetime: 3.0,
      velocity: 40,
      drag: 0.97,
      gravityScale: 1.3,
      sparkleRate: 0.1,
    },
    autoMatchColors: [],
    autoMatchTypes: ['palm', 'coconut'],
  },
  {
    id: 'niagara-horsetail',
    name: 'Niagara Horsetail Hang',
    source: 'Ns_Firework_Horsetail.uasset',
    primary: '#CCAA44',
    secondary: '#887722',
    gradient: ['#FFFFFF', '#EEDD88', '#CCAA44', '#887722', '#332200'],
    shaderUniforms: {
      uColor: [0.8, 0.67, 0.27],
      uColor2: [0.53, 0.47, 0.13],
      uGlowIntensity: 2.0,
      uFadeProfile: 'ember' as const,
    },
    particleProfile: {
      starCount: 400,
      lifetime: 6.0,
      velocity: 25,
      drag: 0.995,
      gravityScale: 0.4,
      sparkleRate: 0.5,
    },
    autoMatchColors: [],
    autoMatchTypes: ['horsetail'],
  },
  {
    id: 'niagara-strobe',
    name: 'Niagara Strobe Flash',
    source: 'Ns_Firework_Strobe.uasset',
    primary: '#FFFFFF',
    secondary: '#CCCCCC',
    gradient: ['#FFFFFF', '#FFFFFF', '#CCCCCC', '#666666', '#111111'],
    shaderUniforms: {
      uColor: [1.0, 1.0, 1.0],
      uColor2: [0.8, 0.8, 0.8],
      uGlowIntensity: 4.0,
      uFadeProfile: 'linear' as const,
    },
    particleProfile: {
      starCount: 150,
      lifetime: 2.5,
      velocity: 35,
      drag: 0.96,
      gravityScale: 1.0,
      sparkleRate: 8.0,
    },
    autoMatchColors: ['strobe'],
    autoMatchTypes: ['strobe'],
  },
  {
    id: 'niagara-dahlia',
    name: 'Niagara Dahlia Burst',
    source: 'Ns_Firework_Dahlia.uasset',
    primary: '#FF4488',
    secondary: '#CC2266',
    gradient: ['#FFFFFF', '#FF88AA', '#FF4488', '#CC2266', '#440022'],
    shaderUniforms: {
      uColor: [1.0, 0.27, 0.53],
      uColor2: [0.8, 0.13, 0.4],
      uGlowIntensity: 2.6,
      uFadeProfile: 'exponential' as const,
    },
    particleProfile: {
      starCount: 80,
      lifetime: 1.2,
      velocity: 55,
      drag: 0.94,
      gravityScale: 1.1,
      sparkleRate: 0.15,
    },
    autoMatchColors: [],
    autoMatchTypes: ['dahlia'],
  },
  {
    id: 'niagara-ring',
    name: 'Niagara Ring Torus',
    source: 'Ns_Firework_Ring.uasset',
    primary: '#44AAFF',
    secondary: '#2266CC',
    gradient: ['#FFFFFF', '#88CCFF', '#44AAFF', '#2266CC', '#112244'],
    shaderUniforms: {
      uColor: [0.27, 0.67, 1.0],
      uColor2: [0.13, 0.4, 0.8],
      uGlowIntensity: 2.2,
      uFadeProfile: 'linear' as const,
    },
    particleProfile: {
      starCount: 80,
      lifetime: 1.8,
      velocity: 28,
      drag: 0.96,
      gravityScale: 1.0,
      sparkleRate: 0.1,
    },
    autoMatchColors: [],
    autoMatchTypes: ['ring'],
  },
  {
    id: 'niagara-fan',
    name: 'Niagara Fan Spread',
    source: 'Ns_Firework_Fan.uasset',
    primary: '#FF6644',
    secondary: '#FFAA22',
    gradient: ['#FFFFFF', '#FFBB66', '#FF6644', '#CC3322', '#331100'],
    shaderUniforms: {
      uColor: [1.0, 0.4, 0.27],
      uColor2: [1.0, 0.67, 0.13],
      uGlowIntensity: 2.4,
      uFadeProfile: 'linear' as const,
    },
    particleProfile: {
      starCount: 60,
      lifetime: 2.5,
      velocity: 28,
      drag: 0.96,
      gravityScale: 1.0,
      sparkleRate: 0.2,
    },
    autoMatchColors: [],
    autoMatchTypes: ['fan'],
  },
  {
    id: 'niagara-waterfall',
    name: 'Niagara Waterfall Cascade',
    source: 'Ns_Firework_Waterfall.uasset',
    primary: '#FFD700',
    secondary: '#FFAA00',
    gradient: ['#FFFFFF', '#FFEE88', '#FFD700', '#FFAA00', '#553300'],
    shaderUniforms: {
      uColor: [1.0, 0.84, 0.0],
      uColor2: [1.0, 0.67, 0.0],
      uGlowIntensity: 2.8,
      uFadeProfile: 'ember' as const,
    },
    particleProfile: {
      starCount: 500,
      lifetime: 15.0,
      velocity: 3,
      drag: 0.99,
      gravityScale: 1.5,
      sparkleRate: 0.6,
    },
    autoMatchColors: [],
    autoMatchTypes: ['waterfall'],
  },
  {
    id: 'niagara-salute',
    name: 'Niagara Salute Flash',
    source: 'Ns_Firework_Salute.uasset',
    primary: '#FFFFFF',
    secondary: '#FFEE88',
    gradient: ['#FFFFFF', '#FFFFFF', '#FFEE88', '#FF8844', '#440000'],
    shaderUniforms: {
      uColor: [1.0, 1.0, 1.0],
      uColor2: [1.0, 0.93, 0.53],
      uGlowIntensity: 5.0,
      uFadeProfile: 'exponential' as const,
    },
    particleProfile: {
      starCount: 20,
      lifetime: 0.3,
      velocity: 80,
      drag: 0.9,
      gravityScale: 0.5,
      sparkleRate: 0.0,
    },
    autoMatchColors: ['salute'],
    autoMatchTypes: ['salute'],
  },
  {
    id: 'niagara-willow',
    name: 'Niagara Willow Droop',
    source: 'Ns_Firework_Willow.uasset',
    primary: '#CCAA44',
    secondary: '#997722',
    gradient: ['#FFFFFF', '#EEDD88', '#CCAA44', '#997722', '#332200'],
    shaderUniforms: {
      uColor: [0.8, 0.67, 0.27],
      uColor2: [0.6, 0.47, 0.13],
      uGlowIntensity: 2.0,
      uFadeProfile: 'ember' as const,
    },
    particleProfile: {
      starCount: 300,
      lifetime: 4.5,
      velocity: 30,
      drag: 0.985,
      gravityScale: 0.6,
      sparkleRate: 0.3,
    },
    autoMatchColors: [],
    autoMatchTypes: ['willow'],
  },
  // ── Ethereal Fire Presets — supernatural cold-flame variants ──
  {
    id: 'stylized-fire-01-ethereal',
    name: 'Ethereal Fire 01',
    source: 'NS_Stylized_Fire_01_Ethereal.uasset',
    primary: '#22DDFF',
    secondary: '#8833FF',
    tertiary: '#440088',
    gradient: ['#FFFFFF', '#88EEFF', '#22DDFF', '#8833FF', '#1A0044'],
    shaderUniforms: {
      uColor: [0.1, 0.8, 1.0],
      uColor2: [0.4, 0.15, 1.0],
      uGlowIntensity: 3.5,
      uFadeProfile: 'exponential',
    },
    particleProfile: {
      starCount: 60,
      lifetime: 1.5,
      velocity: 35,
      drag: 0.96,
      gravityScale: 0.55,
      sparkleRate: 0.45,
    },
    autoMatchColors: ['ethereal', 'magic', 'spirit', 'ghost', 'spectral'],
    autoMatchTypes: ['peony', 'chrysanthemum'],
  },
  {
    id: 'stylized-fire-02-ethereal',
    name: 'Ethereal Fire 02 Spread',
    source: 'NS_Stylized_Fire_02_Ethereal.uasset',
    primary: '#44BBFF',
    secondary: '#6622CC',
    tertiary: '#330066',
    gradient: ['#FFFFFF', '#99DDFF', '#44BBFF', '#6622CC', '#110033'],
    shaderUniforms: {
      uColor: [0.2, 0.7, 1.0],
      uColor2: [0.35, 0.1, 0.8],
      uGlowIntensity: 3.2,
      uFadeProfile: 'exponential',
    },
    particleProfile: {
      starCount: 80,
      lifetime: 1.2,
      velocity: 40,
      drag: 0.955,
      gravityScale: 0.65,
      sparkleRate: 0.35,
    },
    autoMatchColors: ['ethereal', 'mystic'],
    autoMatchTypes: ['dahlia', 'peony'],
  },
  {
    id: 'stylized-fire-radial-01-ethereal',
    name: 'Ethereal Radial Fire 01',
    source: 'NS_Stylized_Fire_Radial_01_Ethereal.uasset',
    primary: '#00EEFF',
    secondary: '#9944FF',
    tertiary: '#5500AA',
    gradient: ['#FFFFFF', '#66FFFF', '#00EEFF', '#9944FF', '#220055'],
    shaderUniforms: {
      uColor: [0.0, 0.9, 1.0],
      uColor2: [0.6, 0.25, 1.0],
      uGlowIntensity: 3.8,
      uFadeProfile: 'linear',
    },
    particleProfile: {
      starCount: 120,
      lifetime: 1.0,
      velocity: 50,
      drag: 0.94,
      gravityScale: 0.85,
      sparkleRate: 0.5,
    },
    autoMatchColors: ['ethereal', 'plasma'],
    autoMatchTypes: ['palm', 'chrysanthemum'],
  },
  {
    id: 'stylized-fire-radial-02-ethereal',
    name: 'Ethereal Radial Fire 02',
    source: 'NS_Stylized_Fire_Radial_02_Ethereal.uasset',
    primary: '#33CCFF',
    secondary: '#AA33FF',
    tertiary: '#6600BB',
    gradient: ['#FFFFFF', '#77EEFF', '#33CCFF', '#AA33FF', '#2A0066'],
    shaderUniforms: {
      uColor: [0.15, 0.75, 1.0],
      uColor2: [0.65, 0.2, 1.0],
      uGlowIntensity: 4.0,
      uFadeProfile: 'linear',
    },
    particleProfile: {
      starCount: 150,
      lifetime: 0.75,
      velocity: 55,
      drag: 0.935,
      gravityScale: 0.92,
      sparkleRate: 0.55,
    },
    autoMatchColors: ['ethereal', 'arcane'],
    autoMatchTypes: ['dahlia', 'palm'],
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
