/**
 * ─── Complete Effect Type System ─────────────────────────────────────
 * Finale 3D compatible classification: Shell, Cake, Mine, Comet,
 * Roman Candle, Fan, Gerb, Flame, SFX (Cryo, Confetti, Laser)
 */

export type PyroEffectType =
  | 'shell' | 'cake' | 'mine' | 'comet' | 'roman_candle'
  | 'fan' | 'gerb' | 'flame' | 'strobe' | 'waterfall'
  | 'crossette' | 'tourbillon' | 'salute' | 'cryo' | 'confetti' | 'laser'
  | 'sparkle_pot' | 'set_piece' | 'lance' | 'wheel';

export interface PyroEffectSpec {
  type: PyroEffectType;
  label: string;
  icon: string;
  defaultDuration: number;
  defaultHeight: number;       // meters (break height for shells, jet height for gerbs)
  defaultSpread: number;       // degrees
  hasLiftPhase: boolean;       // true for shells, comets
  isChainable: boolean;        // true for shells, roman candles
  isCake: boolean;             // multi-shot device
  defaultShotsPerDevice: number;
  minCaliber: number;          // inches
  maxCaliber: number;
  liftTimePerInch: number;     // seconds per inch of caliber
  category: 'aerial' | 'ground' | 'sfx';
  colorChannels: number;       // 1 = single color, 3 = RGB
  description: string;
}

export const EFFECT_TYPES: Record<PyroEffectType, PyroEffectSpec> = {
  shell: {
    type: 'shell', label: 'Shell', icon: '💥',
    defaultDuration: 1.6, defaultHeight: 55, defaultSpread: 45,
    hasLiftPhase: true, isChainable: true, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 2, maxCaliber: 16, liftTimePerInch: 0.38,
    category: 'aerial', colorChannels: 1,
    description: 'Single aerial shell fired from a mortar tube',
  },
  cake: {
    type: 'cake', label: 'Cake / Battery', icon: '🎂',
    defaultDuration: 15, defaultHeight: 35, defaultSpread: 30,
    hasLiftPhase: true, isChainable: false, isCake: true, defaultShotsPerDevice: 25,
    minCaliber: 1, maxCaliber: 3, liftTimePerInch: 0.25,
    category: 'aerial', colorChannels: 1,
    description: 'Multi-shot device with pre-fused internal connections',
  },
  mine: {
    type: 'mine', label: 'Mine', icon: '⛏️',
    defaultDuration: 1.2, defaultHeight: 25, defaultSpread: 70,
    hasLiftPhase: false, isChainable: true, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 2, maxCaliber: 8, liftTimePerInch: 0,
    category: 'ground', colorChannels: 1,
    description: 'Ground-level burst propelling stars upward',
  },
  comet: {
    type: 'comet', label: 'Comet', icon: '☄️',
    defaultDuration: 1.5, defaultHeight: 45, defaultSpread: 8,
    hasLiftPhase: true, isChainable: true, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 1, maxCaliber: 4, liftTimePerInch: 0.35,
    category: 'aerial', colorChannels: 1,
    description: 'Rising star that leaves a luminous trail',
  },
  roman_candle: {
    type: 'roman_candle', label: 'Roman Candle', icon: '🕯️',
    defaultDuration: 8, defaultHeight: 40, defaultSpread: 10,
    hasLiftPhase: true, isChainable: false, isCake: true, defaultShotsPerDevice: 8,
    minCaliber: 0.5, maxCaliber: 2, liftTimePerInch: 0.3,
    category: 'aerial', colorChannels: 1,
    description: 'Tube that fires stars at regular intervals',
  },
  fan: {
    type: 'fan', label: 'Fan', icon: '🪭',
    defaultDuration: 2, defaultHeight: 50, defaultSpread: 90,
    hasLiftPhase: true, isChainable: false, isCake: true, defaultShotsPerDevice: 5,
    minCaliber: 2, maxCaliber: 6, liftTimePerInch: 0.5,
    category: 'aerial', colorChannels: 1,
    description: 'Multiple shells fired simultaneously at different angles',
  },
  gerb: {
    type: 'gerb', label: 'Gerb / Fountain', icon: '⛲',
    defaultDuration: 10, defaultHeight: 5, defaultSpread: 15,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 1, maxCaliber: 4, liftTimePerInch: 0,
    category: 'ground', colorChannels: 1,
    description: 'Ground-level fountain of sparks',
  },
  flame: {
    type: 'flame', label: 'Flame Projector', icon: '🔥',
    defaultDuration: 3, defaultHeight: 8, defaultSpread: 20,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 0, maxCaliber: 0, liftTimePerInch: 0,
    category: 'sfx', colorChannels: 3,
    description: 'LPG flame projector (Flamaniac, G-Flame, etc.)',
  },
  strobe: {
    type: 'strobe', label: 'Strobe', icon: '⚡',
    defaultDuration: 5, defaultHeight: 0, defaultSpread: 360,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 0, maxCaliber: 0, liftTimePerInch: 0,
    category: 'sfx', colorChannels: 3,
    description: 'High-intensity xenon strobe light',
  },
  waterfall: {
    type: 'waterfall', label: 'Waterfall / Cascade', icon: '🌊',
    defaultDuration: 15, defaultHeight: 0, defaultSpread: 0,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 0, maxCaliber: 0, liftTimePerInch: 0,
    category: 'ground', colorChannels: 1,
    description: 'Sparks falling from an elevated position',
  },
  crossette: {
    type: 'crossette', label: 'Crossette', icon: '✳️',
    defaultDuration: 2.5, defaultHeight: 55, defaultSpread: 45,
    hasLiftPhase: true, isChainable: true, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 2, maxCaliber: 5, liftTimePerInch: 0.5,
    category: 'aerial', colorChannels: 1,
    description: 'Stars that split into smaller fragments',
  },
  tourbillon: {
    type: 'tourbillon', label: 'Tourbillon', icon: '🌀',
    defaultDuration: 3, defaultHeight: 30, defaultSpread: 20,
    hasLiftPhase: true, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 2, maxCaliber: 4, liftTimePerInch: 0.4,
    category: 'aerial', colorChannels: 1,
    description: 'Spinning rising effect with spiral trail',
  },
  salute: {
    type: 'salute', label: 'Salute / Report', icon: '💣',
    defaultDuration: 0.5, defaultHeight: 50, defaultSpread: 0,
    hasLiftPhase: true, isChainable: true, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 2, maxCaliber: 12, liftTimePerInch: 0.5,
    category: 'aerial', colorChannels: 0,
    description: 'Loud report/bang with flash',
  },
  cryo: {
    type: 'cryo', label: 'Cryo Jet', icon: '🧊',
    defaultDuration: 3, defaultHeight: 6, defaultSpread: 15,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 0, maxCaliber: 0, liftTimePerInch: 0,
    category: 'sfx', colorChannels: 0,
    description: 'CO2 cryogenic jet effect',
  },
  confetti: {
    type: 'confetti', label: 'Confetti Cannon', icon: '🎊',
    defaultDuration: 2, defaultHeight: 8, defaultSpread: 45,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 0, maxCaliber: 0, liftTimePerInch: 0,
    category: 'sfx', colorChannels: 3,
    description: 'Confetti/streamer projection',
  },
  laser: {
    type: 'laser', label: 'Laser', icon: '🔦',
    defaultDuration: 10, defaultHeight: 0, defaultSpread: 30,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 0, maxCaliber: 0, liftTimePerInch: 0,
    category: 'sfx', colorChannels: 3,
    description: 'ILDA laser projector',
  },
  sparkle_pot: {
    type: 'sparkle_pot', label: 'Sparkle Pot', icon: '✨',
    defaultDuration: 5, defaultHeight: 3, defaultSpread: 30,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 0, maxCaliber: 0, liftTimePerInch: 0,
    category: 'ground', colorChannels: 1,
    description: 'Low-level sparks and glitter',
  },
  set_piece: {
    type: 'set_piece', label: 'Set Piece', icon: '🖼️',
    defaultDuration: 30, defaultHeight: 0, defaultSpread: 0,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 0, maxCaliber: 0, liftTimePerInch: 0,
    category: 'ground', colorChannels: 1,
    description: 'Static framework with lances forming images/text',
  },
  lance: {
    type: 'lance', label: 'Lance', icon: '📍',
    defaultDuration: 45, defaultHeight: 0, defaultSpread: 0,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 0, maxCaliber: 0, liftTimePerInch: 0,
    category: 'ground', colorChannels: 1,
    description: 'Small colored torch for set pieces',
  },
  wheel: {
    type: 'wheel', label: 'Wheel / Catherine', icon: '☸️',
    defaultDuration: 15, defaultHeight: 0, defaultSpread: 360,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 0, maxCaliber: 0, liftTimePerInch: 0,
    category: 'ground', colorChannels: 1,
    description: 'Spinning firework mounted on a central pivot',
  },
};

export function getLiftTime(type: PyroEffectType, caliberInches: number): number {
  const spec = EFFECT_TYPES[type];
  if (!spec.hasLiftPhase) return 0;
  return spec.liftTimePerInch * caliberInches;
}

export function getEffectTypesByCategory(category: 'aerial' | 'ground' | 'sfx'): PyroEffectSpec[] {
  return Object.values(EFFECT_TYPES).filter(e => e.category === category);
}

export function getAllEffectTypes(): PyroEffectSpec[] {
  return Object.values(EFFECT_TYPES);
}
