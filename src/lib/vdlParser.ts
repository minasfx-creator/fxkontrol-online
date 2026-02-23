/**
 * Visual Descriptive Language (VDL) Parser
 * Converts text like "3in Red Peony" into structured effect parameters.
 * Based on Finale 3D VDL specification.
 */

export interface VDLResult {
  caliber: number;       // inches (e.g. 3, 4, 5, 6)
  caliberMM: number;     // mm equivalent
  colors: string[];      // hex colors
  colorNames: string[];  // original color names
  type: string;          // effect type (peony, chrysanthemum, willow, etc.)
  typeName: string;      // display name
  modifiers: string[];   // tail, strobe, blink, etc.
  height: number;        // burst height in meters
  spread: number;        // spread angle degrees
  duration: number;      // seconds
  starCount: number;     // number of stars
  cost: number;          // estimated cost
  raw: string;           // original input
  valid: boolean;
}

// VDL Color map
const VDL_COLORS: Record<string, string> = {
  red: '#FF0000',
  green: '#00FF00',
  blue: '#0000FF',
  gold: '#FFD700',
  silver: '#C0C0C0',
  white: '#FFFFFF',
  yellow: '#FFFF00',
  orange: '#FF8C00',
  purple: '#9B30FF',
  pink: '#FF69B4',
  magenta: '#FF00FF',
  cyan: '#00FFFF',
  aqua: '#00FFFF',
  lemon: '#FFF44F',
  lime: '#32CD32',
  violet: '#8A2BE2',
  titanium: '#E8E8E8',
  brocade: '#FFE4B5',
  nishiki: '#FFD700',
  crackling: '#FFA500',
};

// VDL Effect types
const VDL_TYPES: Record<string, { name: string; baseSpread: number; baseDuration: number; baseStars: number }> = {
  peony: { name: 'Peony', baseSpread: 45, baseDuration: 2.0, baseStars: 80 },
  chrysanthemum: { name: 'Chrysanthemum', baseSpread: 50, baseDuration: 2.5, baseStars: 120 },
  dahlia: { name: 'Dahlia', baseSpread: 40, baseDuration: 2.5, baseStars: 60 },
  willow: { name: 'Willow', baseSpread: 55, baseDuration: 3.5, baseStars: 100 },
  palm: { name: 'Palm', baseSpread: 60, baseDuration: 4.0, baseStars: 40 },
  coconut: { name: 'Coconut Palm', baseSpread: 65, baseDuration: 5.0, baseStars: 30 },
  brocade: { name: 'Brocade Crown', baseSpread: 50, baseDuration: 3.0, baseStars: 150 },
  kamuro: { name: 'Kamuro', baseSpread: 55, baseDuration: 4.0, baseStars: 200 },
  comet: { name: 'Comet', baseSpread: 10, baseDuration: 1.5, baseStars: 1 },
  crossette: { name: 'Crossette', baseSpread: 35, baseDuration: 2.0, baseStars: 16 },
  ring: { name: 'Ring', baseSpread: 40, baseDuration: 2.0, baseStars: 40 },
  horsetail: { name: 'Horsetail', baseSpread: 30, baseDuration: 4.0, baseStars: 60 },
  strobe: { name: 'Strobe', baseSpread: 45, baseDuration: 3.0, baseStars: 50 },
  mine: { name: 'Mine', baseSpread: 70, baseDuration: 1.5, baseStars: 30 },
  fountain: { name: 'Fountain', baseSpread: 15, baseDuration: 5.0, baseStars: 200 },
  waterfall: { name: 'Waterfall', baseSpread: 20, baseDuration: 6.0, baseStars: 300 },
  gerb: { name: 'Gerb', baseSpread: 10, baseDuration: 4.0, baseStars: 100 },
  roman: { name: 'Roman Candle', baseSpread: 5, baseDuration: 8.0, baseStars: 8 },
  cake: { name: 'Cake', baseSpread: 30, baseDuration: 10.0, baseStars: 50 },
  shell: { name: 'Shell', baseSpread: 45, baseDuration: 2.5, baseStars: 80 },
  salute: { name: 'Salute', baseSpread: 60, baseDuration: 0.5, baseStars: 0 },
  flare: { name: 'Flare', baseSpread: 5, baseDuration: 5.0, baseStars: 1 },
  fan: { name: 'Fan', baseSpread: 90, baseDuration: 2.0, baseStars: 40 },
  tourbillion: { name: 'Tourbillion', baseSpread: 20, baseDuration: 3.0, baseStars: 10 },
  spinner: { name: 'Spinner', baseSpread: 360, baseDuration: 4.0, baseStars: 20 },
};

// VDL Modifiers
const VDL_MODIFIERS = [
  'tail', 'glitter', 'strobe', 'blink', 'crackle', 'crackling',
  'pistil', 'rising', 'falling', 'flying', 'hummer', 'whistle',
  'report', 'flash', 'smoke', 'parachute', 'go-getter', 'serpent',
  'split', 'twinkle', 'flicker', 'wave',
];

const CALIBER_REGEX = /(\d+(?:\.\d+)?)\s*(?:in(?:ch)?|"|''|pol)/i;
const CALIBER_MM_REGEX = /(\d+)\s*mm/i;

export function parseVDL(input: string): VDLResult {
  const raw = input.trim();
  const lower = raw.toLowerCase();

  const result: VDLResult = {
    caliber: 3,
    caliberMM: 75,
    colors: [],
    colorNames: [],
    type: 'peony',
    typeName: 'Peony',
    modifiers: [],
    height: 80,
    spread: 45,
    duration: 2.0,
    starCount: 80,
    cost: 10,
    raw,
    valid: false,
  };

  if (!raw) return result;

  // Parse caliber
  const calMatch = lower.match(CALIBER_REGEX);
  const calMmMatch = lower.match(CALIBER_MM_REGEX);
  if (calMatch) {
    result.caliber = parseFloat(calMatch[1]);
    result.caliberMM = Math.round(result.caliber * 25.4);
  } else if (calMmMatch) {
    result.caliberMM = parseInt(calMmMatch[1]);
    result.caliber = Math.round((result.caliberMM / 25.4) * 10) / 10;
  }

  // Parse colors
  for (const [name, hex] of Object.entries(VDL_COLORS)) {
    if (lower.includes(name)) {
      result.colors.push(hex);
      result.colorNames.push(name);
    }
  }
  if (result.colors.length === 0) {
    result.colors = ['#FFD700'];
    result.colorNames = ['gold'];
  }

  // Parse type
  let foundType = false;
  for (const [key, data] of Object.entries(VDL_TYPES)) {
    if (lower.includes(key)) {
      result.type = key;
      result.typeName = data.name;
      result.spread = data.baseSpread;
      result.duration = data.baseDuration;
      result.starCount = data.baseStars;
      foundType = true;
      break;
    }
  }

  // Parse modifiers
  for (const mod of VDL_MODIFIERS) {
    if (lower.includes(mod)) {
      result.modifiers.push(mod);
    }
  }

  // Apply caliber scaling
  const calScale = result.caliber / 3;
  result.height = Math.round(30 + calScale * 50);
  result.spread = Math.round(result.spread * (0.8 + calScale * 0.4));
  result.duration = Math.round(result.duration * (0.8 + calScale * 0.3) * 10) / 10;
  result.starCount = Math.round(result.starCount * (0.7 + calScale * 0.5));
  result.cost = Math.round(5 * Math.pow(calScale, 1.8) * 10) / 10;

  // Modifier adjustments
  if (result.modifiers.includes('tail')) result.duration += 0.5;
  if (result.modifiers.includes('strobe') || result.modifiers.includes('blink')) result.duration += 1.0;
  if (result.modifiers.includes('crackle') || result.modifiers.includes('crackling')) result.duration += 0.8;
  if (result.modifiers.includes('glitter')) result.starCount = Math.round(result.starCount * 1.5);
  if (result.modifiers.includes('pistil')) result.starCount += 20;

  result.valid = foundType || result.colorNames.length > 0 || calMatch !== null || calMmMatch !== null;

  return result;
}

/** Generate a VDL string from parameters */
export function toVDL(params: Partial<VDLResult>): string {
  const parts: string[] = [];
  if (params.caliber) parts.push(`${params.caliber}in`);
  if (params.colorNames?.length) parts.push(...params.colorNames.map(c => c.charAt(0).toUpperCase() + c.slice(1)));
  if (params.typeName) parts.push(params.typeName);
  if (params.modifiers?.length) parts.push(`w/ ${params.modifiers.join(', ')}`);
  return parts.join(' ');
}

/** Get all available VDL color names */
export function getVDLColors() {
  return Object.entries(VDL_COLORS).map(([name, hex]) => ({ name, hex }));
}

/** Get all available VDL effect types */
export function getVDLTypes() {
  return Object.entries(VDL_TYPES).map(([key, data]) => ({ key, ...data }));
}

/** Convert VDL result to an Effect-compatible object for timeline */
export function vdlToEffect(vdl: VDLResult): {
  id: string;
  name: string;
  category: 'morteiros' | 'peonias';
  type: 'firework';
  color: string;
  duration: number;
  cost: number;
  icon: string;
} {
  const typeIcons: Record<string, string> = {
    peony: '🔴', chrysanthemum: '💥', dahlia: '🟣', willow: '🎆',
    palm: '🌴', coconut: '🌴', brocade: '👑', kamuro: '✨',
    comet: '☄️', crossette: '✳️', ring: '💍', horsetail: '🎇',
    strobe: '⚡', mine: '💫', fountain: '⚜️', waterfall: '🌊',
    gerb: '🔥', roman: '🎇', cake: '🎆', shell: '💫',
    salute: '💢', flare: '🔥', fan: '🪭', tourbillion: '🌀',
    spinner: '🌀',
  };

  const calStr = `${vdl.caliber}"` || '';
  const colorStr = vdl.colorNames.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join('/');
  const name = `${calStr} ${colorStr} ${vdl.typeName}`.trim();

  return {
    id: `vdl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    category: vdl.caliber >= 4 ? 'morteiros' : 'peonias',
    type: 'firework',
    color: vdl.colors[0],
    duration: vdl.duration,
    cost: vdl.cost,
    icon: typeIcons[vdl.type] || '💥',
  };
}
