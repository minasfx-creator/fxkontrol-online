/**
 * ─── Complete Effect Type System ─────────────────────────────────────
 * Finale 3D compatible classification: Shell, Cake, Mine, Comet,
 * Roman Candle, Fan, Gerb, Flame, SFX (Cryo, Confetti, Laser)
 */

export type PyroEffectType =
  | 'shell' | 'cake' | 'mine' | 'comet' | 'roman_candle'
  | 'fan' | 'gerb' | 'flame' | 'strobe' | 'waterfall'
  | 'crossette' | 'tourbillon' | 'salute' | 'cryo' | 'confetti' | 'laser'
  | 'sparkle_pot' | 'set_piece' | 'lance' | 'wheel'
  | 'sparkular' | 'fog_low' | 'streamer'
  | 'bengal' | 'rocket' | 'firecracker_string' | 'saxon' | 'parachute_flare'
  | 'strobe_pot' | 'go_getter' | 'flying_fish' | 'crackling' | 'girandola' | 'whistler'
  | 'caduceus' | 'table_rocket' | 'spur_fire';

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
    defaultDuration: 2.0, defaultHeight: 55, defaultSpread: 35,
    hasLiftPhase: true, isChainable: true, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 2, maxCaliber: 5, liftTimePerInch: 0.38,
    category: 'aerial', colorChannels: 1,
    description: 'Stars that split into smaller fragments',
  },
  tourbillon: {
    type: 'tourbillon', label: 'Tourbillon', icon: '🌀',
    defaultDuration: 3.5, defaultHeight: 30, defaultSpread: 20,
    hasLiftPhase: true, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 2, maxCaliber: 4, liftTimePerInch: 0.35,
    category: 'aerial', colorChannels: 1,
    description: 'Spinning rising effect with spiral trail',
  },
  salute: {
    type: 'salute', label: 'Salute / Report', icon: '💣',
    defaultDuration: 0.3, defaultHeight: 55, defaultSpread: 60,
    hasLiftPhase: true, isChainable: true, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 2, maxCaliber: 12, liftTimePerInch: 0.38,
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
  sparkular: {
    type: 'sparkular', label: 'Sparkular / Cold Sparks', icon: '✨',
    defaultDuration: 8, defaultHeight: 5, defaultSpread: 15,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 0, maxCaliber: 0, liftTimePerInch: 0,
    category: 'sfx', colorChannels: 0,
    description: 'Indoor-safe cold spark fountain (Showven Sparkular)',
  },
  fog_low: {
    type: 'fog_low', label: 'Low Fog', icon: '🌫️',
    defaultDuration: 30, defaultHeight: 0.5, defaultSpread: 360,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 0, maxCaliber: 0, liftTimePerInch: 0,
    category: 'sfx', colorChannels: 0,
    description: 'Floor-hugging low fog (Showven Creeper AQ)',
  },
  streamer: {
    type: 'streamer', label: 'Metallic Streamer', icon: '🎗️',
    defaultDuration: 3, defaultHeight: 10, defaultSpread: 30,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 0, maxCaliber: 0, liftTimePerInch: 0,
    category: 'sfx', colorChannels: 3,
    description: 'Metallic streamer cannon for celebrations',
  },
  bengal: {
    type: 'bengal', label: 'Bengal Light', icon: '🔴',
    defaultDuration: 60, defaultHeight: 0, defaultSpread: 0,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 0, maxCaliber: 0, liftTimePerInch: 0,
    category: 'ground', colorChannels: 1,
    description: 'Intense monochromatic ground flare (bengala) — Sr=red, Ba=green, Cu=blue, Na=yellow',
  },
  rocket: {
    type: 'rocket', label: 'Rocket', icon: '🚀',
    defaultDuration: 3, defaultHeight: 80, defaultSpread: 15,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 1, maxCaliber: 6, liftTimePerInch: 0,
    category: 'aerial', colorChannels: 1,
    description: 'Self-propelled aerial device with stick stabilizer and motor exhaust trail (cohete)',
  },
  firecracker_string: {
    type: 'firecracker_string', label: 'Firecracker String', icon: '🧨',
    defaultDuration: 5, defaultHeight: 0, defaultSpread: 0,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 50,
    minCaliber: 0, maxCaliber: 0, liftTimePerInch: 0,
    category: 'ground', colorChannels: 0,
    description: 'Rapid sequence of small reports connected by quick-match (traca) — 1m/s propagation',
  },
  saxon: {
    type: 'saxon', label: 'Saxon / Ground Spinner', icon: '🌻',
    defaultDuration: 8, defaultHeight: 0, defaultSpread: 360,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 0, maxCaliber: 0, liftTimePerInch: 0,
    category: 'ground', colorChannels: 1,
    description: 'Horizontal ground spinner with radiating flame arms (margarita/girasol)',
  },
  parachute_flare: {
    type: 'parachute_flare', label: 'Parachute Flare', icon: '🪂',
    defaultDuration: 20, defaultHeight: 60, defaultSpread: 5,
    hasLiftPhase: true, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 2, maxCaliber: 8, liftTimePerInch: 0.38,
    category: 'aerial', colorChannels: 1,
    description: 'Aerial shell deploying a slow-descending illumination star on a parachute',
  },
  strobe_pot: {
    type: 'strobe_pot', label: 'Strobe Pot', icon: '💡',
    defaultDuration: 30, defaultHeight: 0, defaultSpread: 360,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 0, maxCaliber: 0, liftTimePerInch: 0,
    category: 'ground', colorChannels: 1,
    description: 'Flashing ground strobe pot (KClO4+Mg+BaCrO4) — rapid bright pulses',
  },
  go_getter: {
    type: 'go_getter', label: 'Go-Getter / Microjet', icon: '🐝',
    defaultDuration: 3, defaultHeight: 50, defaultSpread: 40,
    hasLiftPhase: true, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 2, maxCaliber: 8, liftTimePerInch: 0.38,
    category: 'aerial', colorChannels: 1,
    description: 'Thrust-driven animated stars that swim erratically through the sky',
  },
  flying_fish: {
    type: 'flying_fish', label: 'Flying Fish', icon: '🐟',
    defaultDuration: 2.5, defaultHeight: 45, defaultSpread: 35,
    hasLiftPhase: true, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 2, maxCaliber: 6, liftTimePerInch: 0.38,
    category: 'aerial', colorChannels: 1,
    description: 'Small self-propelled stars zipping around erratically (flying fish fuse)',
  },
  crackling: {
    type: 'crackling', label: 'Crackling / Dragon Eggs', icon: '🥚',
    defaultDuration: 2, defaultHeight: 50, defaultSpread: 40,
    hasLiftPhase: true, isChainable: true, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 2, maxCaliber: 8, liftTimePerInch: 0.38,
    category: 'aerial', colorChannels: 0,
    description: 'Bismuth subcarbonate-based crackling stars (dragon eggs)',
  },
  girandola: {
    type: 'girandola', label: 'Girandola', icon: '🎡',
    defaultDuration: 5, defaultHeight: 40, defaultSpread: 360,
    hasLiftPhase: true, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 2, maxCaliber: 6, liftTimePerInch: 0.35,
    category: 'aerial', colorChannels: 1,
    description: 'Rotating wheel that ascends with lift — spinning rising device (APA 87-1)',
  },
  whistler: {
    type: 'whistler', label: 'Whistler', icon: '🎵',
    defaultDuration: 2, defaultHeight: 50, defaultSpread: 10,
    hasLiftPhase: true, isChainable: true, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 1, maxCaliber: 4, liftTimePerInch: 0.35,
    category: 'aerial', colorChannels: 0,
    description: 'Whistle composition tube (KClO4+sodium benzoate) — ascending screamer',
  },

  // ── Historical Effect Types (Pyrotechny 1829 / Anderson 1696) ──────

  caduceus: {
    type: 'caduceus', label: 'Caduceus Rockets', icon: '⚕️',
    defaultDuration: 5, defaultHeight: 60, defaultSpread: 25,
    hasLiftPhase: true, isChainable: false, isCake: false, defaultShotsPerDevice: 2,
    minCaliber: 1, maxCaliber: 4, liftTimePerInch: 0.35,
    category: 'aerial', colorChannels: 1,
    description: 'Two rockets on opposite sides of a stick forming intertwined spiral trails (Pyrotechny 1829)',
  },
  table_rocket: {
    type: 'table_rocket', label: 'Table Rocket', icon: '🔄',
    defaultDuration: 8, defaultHeight: 0, defaultSpread: 360,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 1, maxCaliber: 3, liftTimePerInch: 0,
    category: 'ground', colorChannels: 1,
    description: 'Horizontal spinner on a cone pivot — circle of fire on a table or post (Pyrotechny 1829)',
  },
  spur_fire: {
    type: 'spur_fire', label: 'Spur Fire', icon: '🌟',
    defaultDuration: 12, defaultHeight: 2, defaultSpread: 20,
    hasLiftPhase: false, isChainable: false, isCake: false, defaultShotsPerDevice: 1,
    minCaliber: 0, maxCaliber: 0, liftTimePerInch: 0,
    category: 'ground', colorChannels: 1,
    description: '"Most beautiful fire known" — clusters of stars/pinks without drossy sparks (Pyrotechny 1829, KNO3+S+Lampblack)',
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
