/**
 * ═══════════════════════════════════════════════════════════════════════
 * Visual Descriptive Language (VDL) Parser — Finale 3D Compatible
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Converts VDL text descriptions into structured rendering parameters.
 * Based on the Finale 3D VDL specification (~300 terms).
 * 
 * VDL drives ALL simulation parameters:
 *   - Caliber → break height, star count, prefire, safety distance
 *   - Type → burst pattern, star behavior, trail characteristics
 *   - Modifiers → tail, glitter, crackle, strobe, pistil behavior
 *   - Colors → multi-color transitions, changing effects
 *   - Adjustment terms → "very large", "slightly dense", "extra bright"
 * 
 * Example VDL strings:
 *   "4in Red Peony w/ Gold Tail"
 *   "75mm Silver Kamuro w/ Crackle"
 *   "6in Blue To Green Chrysanthemum w/ Titanium Pistil"
 *   "50mm Red Comet + Blue Tail Z-Shape Cake"
 *   "3in Gold Brocade Crown w/ Falling Leaves"
 */

export interface VDLResult {
  caliber: number;          // inches
  caliberMM: number;        // mm equivalent
  colors: string[];         // hex colors (ordered: primary → secondary → tertiary)
  colorNames: string[];     // VDL color names
  colorTransition: 'none' | 'to' | 'changing' | 'alternating'; // multi-color behavior
  type: string;             // burst pattern key
  typeName: string;         // display name
  partType: string;         // physical device type (shell, cake, candle, mine, gerb, etc.)
  modifiers: string[];      // tail, strobe, crackle, pistil, etc.
  adjustments: string[];    // very large, slightly dense, extra bright
  height: number;           // break/effect height in meters (Finale HeightMeters)
  spread: number;           // spread angle degrees
  duration: number;         // star lifetime or effect duration (seconds)
  prefire: number;          // lift time for shells (seconds)
  starCount: number;        // number of stars
  breakSpeed: number;       // initial star velocity at break (m/s)
  safetyDistance: number;    // NFPA 1123 safety (meters)
  cost: number;             // estimated cost
  raw: string;
  valid: boolean;
  // Finale rendering hints
  trailType: 'none' | 'comet' | 'glitter' | 'brocade' | 'charcoal' | 'smoke';
  hasReport: boolean;       // flash/bang at break
  hasPistil: boolean;       // inner burst in different color
  pistilColor: string;      // pistil hex color
  twinkle: boolean;         // strobing/twinkling stars
  fallingLeaves: boolean;   // slow fluttering descent
  splitStars: boolean;      // crossette-style splitting
  numSplits: number;        // splits per star (crossette = 4)
}

// ═══════════════════════════════════════════════════════════════════════
// VDL Color Dictionary — Finale standard + extended
// ═══════════════════════════════════════════════════════════════════════
const VDL_COLORS: Record<string, string> = {
  red: '#FF0000', scarlet: '#FF2400', crimson: '#DC143C',
  green: '#00FF00', emerald: '#50C878',
  blue: '#0066FF', royal: '#4169E1', cobalt: '#0047AB',
  gold: '#FFD700', golden: '#FFD700',
  silver: '#C0C0C0', titanium: '#E8E8E8',
  white: '#FFFFFF',
  yellow: '#FFFF00', lemon: '#FFF44F',
  orange: '#FF8C00', amber: '#FFBF00',
  purple: '#9B30FF', violet: '#8A2BE2', lavender: '#B57EDC',
  pink: '#FF69B4', magenta: '#FF00FF', rose: '#FF007F',
  cyan: '#00FFFF', aqua: '#00FFFF', teal: '#008080',
  lime: '#32CD32', chartreuse: '#7FFF00',
  copper: '#B87333', bronze: '#CD7F32',
  nishiki: '#FFD700', // Japanese gold
  brocade: '#FFE4B5',
  crackling: '#FFA500',
  strobe: '#FFFFFF',
  charcoal: '#333333',
};

// ═══════════════════════════════════════════════════════════════════════
// VDL Effect Type Database — Finale rendering parameters per type
// ═══════════════════════════════════════════════════════════════════════
interface VDLTypeSpec {
  name: string;
  baseSpread: number;      // degrees
  baseDuration: number;    // seconds (at 3" caliber)
  baseStars: number;       // at 3" caliber
  baseBreakSpeed: number;  // m/s at 3" caliber
  trailDefault: VDLResult['trailType'];
  partType: string;
}

const VDL_TYPES: Record<string, VDLTypeSpec> = {
  // ── Aerial Burst Patterns ──
  peony:         { name: 'Peony', baseSpread: 45, baseDuration: 1.8, baseStars: 100, baseBreakSpeed: 16, trailDefault: 'none', partType: 'shell' },
  chrysanthemum: { name: 'Chrysanthemum', baseSpread: 52, baseDuration: 2.2, baseStars: 140, baseBreakSpeed: 18, trailDefault: 'comet', partType: 'shell' },
  dahlia:        { name: 'Dahlia', baseSpread: 38, baseDuration: 1.5, baseStars: 50,  baseBreakSpeed: 22, trailDefault: 'none', partType: 'shell' },
  willow:        { name: 'Willow', baseSpread: 55, baseDuration: 4.0, baseStars: 120, baseBreakSpeed: 12, trailDefault: 'charcoal', partType: 'shell' },
  palm:          { name: 'Palm', baseSpread: 60, baseDuration: 3.5, baseStars: 40,  baseBreakSpeed: 14, trailDefault: 'comet', partType: 'shell' },
  coconut:       { name: 'Coconut Palm', baseSpread: 65, baseDuration: 4.5, baseStars: 25,  baseBreakSpeed: 13, trailDefault: 'comet', partType: 'shell' },
  brocade:       { name: 'Brocade Crown', baseSpread: 50, baseDuration: 3.2, baseStars: 180, baseBreakSpeed: 15, trailDefault: 'brocade', partType: 'shell' },
  kamuro:        { name: 'Kamuro', baseSpread: 55, baseDuration: 5.0, baseStars: 220, baseBreakSpeed: 10, trailDefault: 'glitter', partType: 'shell' },
  horsetail:     { name: 'Horsetail', baseSpread: 30, baseDuration: 4.5, baseStars: 70,  baseBreakSpeed: 11, trailDefault: 'charcoal', partType: 'shell' },
  crossette:     { name: 'Crossette', baseSpread: 35, baseDuration: 2.0, baseStars: 24,  baseBreakSpeed: 20, trailDefault: 'comet', partType: 'shell' },
  ring:          { name: 'Ring', baseSpread: 40, baseDuration: 1.8, baseStars: 50,  baseBreakSpeed: 16, trailDefault: 'none', partType: 'shell' },
  // ── Special aerial ──
  salute:        { name: 'Salute', baseSpread: 60, baseDuration: 0.3, baseStars: 0,   baseBreakSpeed: 25, trailDefault: 'none', partType: 'shell' },
  flare:         { name: 'Flare', baseSpread: 5,  baseDuration: 5.0, baseStars: 1,   baseBreakSpeed: 2,  trailDefault: 'smoke', partType: 'single_shot' },
  tourbillion:   { name: 'Tourbillion', baseSpread: 20, baseDuration: 3.5, baseStars: 12,  baseBreakSpeed: 8,  trailDefault: 'comet', partType: 'shell' },
  spinner:       { name: 'Spinner', baseSpread: 360, baseDuration: 4.0, baseStars: 20,  baseBreakSpeed: 5,  trailDefault: 'comet', partType: 'ground' },
  // ── Ground effects ──
  mine:          { name: 'Mine', baseSpread: 70, baseDuration: 1.2, baseStars: 40,  baseBreakSpeed: 18, trailDefault: 'comet', partType: 'mine' },
  comet:         { name: 'Comet', baseSpread: 8,  baseDuration: 1.5, baseStars: 1,   baseBreakSpeed: 30, trailDefault: 'comet', partType: 'comet' },
  fountain:      { name: 'Fountain', baseSpread: 12, baseDuration: 8.0, baseStars: 250, baseBreakSpeed: 8,  trailDefault: 'none', partType: 'gerb' },
  gerb:          { name: 'Gerb', baseSpread: 10, baseDuration: 5.0, baseStars: 180, baseBreakSpeed: 10, trailDefault: 'none', partType: 'gerb' },
  waterfall:     { name: 'Waterfall', baseSpread: 18, baseDuration: 15.0, baseStars: 400, baseBreakSpeed: 2,  trailDefault: 'charcoal', partType: 'waterfall' },
  // ── Multi-shot devices ──
  cake:          { name: 'Cake', baseSpread: 30, baseDuration: 15.0, baseStars: 50,  baseBreakSpeed: 14, trailDefault: 'none', partType: 'cake' },
  roman:         { name: 'Roman Candle', baseSpread: 5,  baseDuration: 10.0, baseStars: 8,   baseBreakSpeed: 18, trailDefault: 'comet', partType: 'candle' },
  candle:        { name: 'Roman Candle', baseSpread: 5,  baseDuration: 10.0, baseStars: 8,   baseBreakSpeed: 18, trailDefault: 'comet', partType: 'candle' },
  fan:           { name: 'Fan', baseSpread: 90, baseDuration: 2.5, baseStars: 40,  baseBreakSpeed: 16, trailDefault: 'none', partType: 'fan' },
  // ── SFX ──
  flame:         { name: 'Flame', baseSpread: 15, baseDuration: 3.0, baseStars: 0,   baseBreakSpeed: 0,  trailDefault: 'none', partType: 'flame' },
  cryo:          { name: 'Cryo Jet', baseSpread: 20, baseDuration: 3.0, baseStars: 0,   baseBreakSpeed: 0,  trailDefault: 'none', partType: 'sfx' },
  confetti:      { name: 'Confetti', baseSpread: 60, baseDuration: 3.0, baseStars: 0,   baseBreakSpeed: 0,  trailDefault: 'none', partType: 'sfx' },
  streamer:      { name: 'Streamer', baseSpread: 45, baseDuration: 4.0, baseStars: 0,   baseBreakSpeed: 0,  trailDefault: 'none', partType: 'sfx' },
  shell:         { name: 'Shell', baseSpread: 45, baseDuration: 2.0, baseStars: 90,  baseBreakSpeed: 16, trailDefault: 'none', partType: 'shell' },
};

// ═══════════════════════════════════════════════════════════════════════
// VDL Modifiers — affect rendering behavior
// ═══════════════════════════════════════════════════════════════════════
const VDL_MODIFIERS = [
  'tail', 'glitter', 'strobe', 'blink', 'crackle', 'crackling',
  'pistil', 'rising', 'falling', 'flying', 'hummer', 'whistle',
  'report', 'flash', 'smoke', 'parachute', 'go-getter', 'serpent',
  'split', 'twinkle', 'flicker', 'wave', 'time-rain', 'ghost',
  'transform', 'core', 'leaves', 'senko', 'hanabi',
];

// VDL Adjustment terms — scale rendering parameters
const VDL_ADJUSTMENTS: { term: string; factor: string; value: number }[] = [
  { term: 'very large', factor: 'spread', value: 1.5 },
  { term: 'large', factor: 'spread', value: 1.25 },
  { term: 'slightly large', factor: 'spread', value: 1.1 },
  { term: 'slightly small', factor: 'spread', value: 0.9 },
  { term: 'small', factor: 'spread', value: 0.75 },
  { term: 'very small', factor: 'spread', value: 0.6 },
  { term: 'very dense', factor: 'stars', value: 2.0 },
  { term: 'dense', factor: 'stars', value: 1.5 },
  { term: 'slightly dense', factor: 'stars', value: 1.2 },
  { term: 'slightly sparse', factor: 'stars', value: 0.8 },
  { term: 'sparse', factor: 'stars', value: 0.6 },
  { term: 'very bright', factor: 'brightness', value: 1.5 },
  { term: 'bright', factor: 'brightness', value: 1.25 },
  { term: 'extra bright', factor: 'brightness', value: 1.4 },
  { term: 'dim', factor: 'brightness', value: 0.7 },
  { term: 'long duration', factor: 'duration', value: 1.5 },
  { term: 'short duration', factor: 'duration', value: 0.6 },
  { term: 'slow', factor: 'speed', value: 0.7 },
  { term: 'fast', factor: 'speed', value: 1.4 },
  { term: 'high', factor: 'height', value: 1.3 },
  { term: 'low', factor: 'height', value: 0.7 },
];

const CALIBER_REGEX = /(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es)?)?|"|''|pol)/i;
const CALIBER_MM_REGEX = /(\d+)\s*mm/i;
const COLOR_TRANSITION_REGEX = /(\w+)\s+(?:to|a)\s+(\w+)/i;

// ═══════════════════════════════════════════════════════════════════════
// Finale caliber → break height lookup (real-world data)
// ═══════════════════════════════════════════════════════════════════════
function getFinaleBreakHeight(caliberInches: number): number {
  const heights: Record<number, number> = {
    1: 20, 1.5: 28, 2: 35, 2.5: 45, 3: 55, 4: 80, 5: 110,
    6: 140, 8: 190, 10: 240, 12: 280, 16: 320,
  };
  const keys = Object.keys(heights).map(Number).sort((a, b) => a - b);
  if (caliberInches <= keys[0]) return heights[keys[0]];
  if (caliberInches >= keys[keys.length - 1]) return heights[keys[keys.length - 1]];
  for (let i = 0; i < keys.length - 1; i++) {
    if (caliberInches >= keys[i] && caliberInches <= keys[i + 1]) {
      const t = (caliberInches - keys[i]) / (keys[i + 1] - keys[i]);
      return heights[keys[i]] * (1 - t) + heights[keys[i + 1]] * t;
    }
  }
  return 80;
}

// Finale prefire (lift time) by caliber
function getFinalePrefire(caliberInches: number): number {
  const prefires: Record<number, number> = {
    1: 0.5, 2: 0.9, 3: 1.3, 4: 1.8, 5: 2.3, 6: 2.8, 8: 3.5, 10: 4.2, 12: 5.0,
  };
  const keys = Object.keys(prefires).map(Number).sort((a, b) => a - b);
  if (caliberInches <= keys[0]) return prefires[keys[0]];
  if (caliberInches >= keys[keys.length - 1]) return prefires[keys[keys.length - 1]];
  for (let i = 0; i < keys.length - 1; i++) {
    if (caliberInches >= keys[i] && caliberInches <= keys[i + 1]) {
      const t = (caliberInches - keys[i]) / (keys[i + 1] - keys[i]);
      return prefires[keys[i]] * (1 - t) + prefires[keys[i + 1]] * t;
    }
  }
  return 1.8;
}

// NFPA 1123 safety distances
function getFinaleSafetyDistance(caliberInches: number): number {
  if (caliberInches <= 2) return 40;
  if (caliberInches <= 3) return 70;
  if (caliberInches <= 4) return 100;
  if (caliberInches <= 5) return 140;
  if (caliberInches <= 6) return 175;
  if (caliberInches <= 8) return 210;
  if (caliberInches <= 10) return 280;
  return 300;
}

// ═══════════════════════════════════════════════════════════════════════
// Main VDL Parser
// ═══════════════════════════════════════════════════════════════════════
export function parseVDL(input: string): VDLResult {
  const raw = input.trim();
  const lower = raw.toLowerCase();

  const result: VDLResult = {
    caliber: 3,
    caliberMM: 75,
    colors: [],
    colorNames: [],
    colorTransition: 'none',
    type: 'peony',
    typeName: 'Peony',
    partType: 'shell',
    modifiers: [],
    adjustments: [],
    height: 55,
    spread: 45,
    duration: 1.8,
    prefire: 1.3,
    starCount: 100,
    breakSpeed: 16,
    safetyDistance: 70,
    cost: 10,
    raw,
    valid: false,
    trailType: 'none',
    hasReport: false,
    hasPistil: false,
    pistilColor: '#FFD700',
    twinkle: false,
    fallingLeaves: false,
    splitStars: false,
    numSplits: 0,
  };

  if (!raw) return result;

  // ── Parse caliber ──
  const calMatch = lower.match(CALIBER_REGEX);
  const calMmMatch = lower.match(CALIBER_MM_REGEX);
  if (calMatch) {
    result.caliber = parseFloat(calMatch[1]);
    result.caliberMM = Math.round(result.caliber * 25.4);
  } else if (calMmMatch) {
    result.caliberMM = parseInt(calMmMatch[1]);
    result.caliber = Math.round((result.caliberMM / 25.4) * 10) / 10;
  }

  // ── Parse color transition ("Red to Blue", "Color Changing") ──
  const transMatch = raw.match(COLOR_TRANSITION_REGEX);
  if (transMatch) {
    const c1 = VDL_COLORS[transMatch[1].toLowerCase()];
    const c2 = VDL_COLORS[transMatch[2].toLowerCase()];
    if (c1 && c2) {
      result.colorTransition = 'to';
      result.colors = [c1, c2];
      result.colorNames = [transMatch[1].toLowerCase(), transMatch[2].toLowerCase()];
    }
  }
  if (lower.includes('changing') || lower.includes('transform')) {
    result.colorTransition = 'changing';
  }
  if (lower.includes('alternating')) {
    result.colorTransition = 'alternating';
  }

  // ── Parse colors (if not already parsed by transition) ──
  if (result.colors.length === 0) {
    for (const [name, hex] of Object.entries(VDL_COLORS)) {
      if (lower.includes(name) && !['strobe', 'crackling', 'brocade', 'charcoal'].includes(name)) {
        result.colors.push(hex);
        result.colorNames.push(name);
      }
    }
    if (result.colors.length === 0) {
      result.colors = ['#FFD700'];
      result.colorNames = ['gold'];
    }
  }

  // ── Parse type ──
  let foundType = false;
  // Sort by name length descending to match longer names first (e.g., "brocade crown" before "brocade")
  const sortedTypes = Object.entries(VDL_TYPES).sort((a, b) => b[0].length - a[0].length);
  for (const [key, data] of sortedTypes) {
    if (lower.includes(key)) {
      result.type = key;
      result.typeName = data.name;
      result.spread = data.baseSpread;
      result.duration = data.baseDuration;
      result.starCount = data.baseStars;
      result.breakSpeed = data.baseBreakSpeed;
      result.trailType = data.trailDefault;
      result.partType = data.partType;
      foundType = true;
      break;
    }
  }

  // ── Parse modifiers ──
  for (const mod of VDL_MODIFIERS) {
    if (lower.includes(mod)) {
      result.modifiers.push(mod);
    }
  }

  // ── Parse adjustments ──
  for (const adj of VDL_ADJUSTMENTS) {
    if (lower.includes(adj.term)) {
      result.adjustments.push(adj.term);
    }
  }

  // ── Apply caliber-based Finale physics ──
  const calScale = result.caliber / 3;
  result.height = getFinaleBreakHeight(result.caliber);
  result.prefire = getFinalePrefire(result.caliber);
  result.safetyDistance = getFinaleSafetyDistance(result.caliber);
  
  // Scale rendering parameters by caliber
  result.spread = Math.round(result.spread * (0.8 + calScale * 0.35));
  result.duration = Math.round(result.duration * (0.85 + calScale * 0.25) * 10) / 10;
  result.starCount = Math.round(result.starCount * (0.6 + calScale * 0.6));
  result.breakSpeed = Math.round(result.breakSpeed * (0.85 + calScale * 0.2) * 10) / 10;
  result.cost = Math.round(5 * Math.pow(calScale, 1.8) * 10) / 10;

  // ── Apply adjustment scaling ──
  for (const adj of VDL_ADJUSTMENTS) {
    if (result.adjustments.includes(adj.term)) {
      switch (adj.factor) {
        case 'spread': result.spread = Math.round(result.spread * adj.value); break;
        case 'stars': result.starCount = Math.round(result.starCount * adj.value); break;
        case 'duration': result.duration = Math.round(result.duration * adj.value * 10) / 10; break;
        case 'speed': result.breakSpeed = Math.round(result.breakSpeed * adj.value * 10) / 10; break;
        case 'height': result.height = Math.round(result.height * adj.value); break;
      }
    }
  }

  // ── Apply modifier effects ──
  if (result.modifiers.includes('tail')) {
    result.trailType = 'comet';
    result.duration += 0.4;
  }
  if (result.modifiers.includes('glitter')) {
    result.trailType = 'glitter';
    result.starCount = Math.round(result.starCount * 1.6);
    result.duration += 0.5;
  }
  if (result.modifiers.includes('strobe') || result.modifiers.includes('blink')) {
    result.twinkle = true;
    result.duration += 0.8;
  }
  if (result.modifiers.includes('twinkle') || result.modifiers.includes('flicker')) {
    result.twinkle = true;
  }
  if (result.modifiers.includes('crackle') || result.modifiers.includes('crackling')) {
    result.duration += 0.6;
    result.starCount = Math.round(result.starCount * 1.3);
  }
  if (result.modifiers.includes('pistil')) {
    result.hasPistil = true;
    // Pistil color is typically contrasting or specified
    const pistilColorIdx = result.colorNames.length > 1 ? 1 : 0;
    result.pistilColor = result.colors[pistilColorIdx] || '#FFD700';
  }
  if (result.modifiers.includes('report') || result.modifiers.includes('flash')) {
    result.hasReport = true;
  }
  if (result.modifiers.includes('split')) {
    result.splitStars = true;
    result.numSplits = 4;
  }
  if (result.modifiers.includes('leaves') || result.modifiers.includes('falling')) {
    result.fallingLeaves = true;
    result.duration += 1.0;
  }
  if (result.modifiers.includes('time-rain') || result.modifiers.includes('senko')) {
    result.trailType = 'glitter';
    result.duration += 2.0;
  }

  // Crossette auto-split
  if (result.type === 'crossette') {
    result.splitStars = true;
    result.numSplits = 4;
  }

  result.valid = foundType || result.colorNames.length > 0 || calMatch !== null || calMmMatch !== null;

  return result;
}

/** Generate a VDL string from parameters */
export function toVDL(params: Partial<VDLResult>): string {
  const parts: string[] = [];
  if (params.caliber) parts.push(`${params.caliber}in`);
  if (params.colorNames?.length) {
    if (params.colorTransition === 'to' && params.colorNames.length >= 2) {
      parts.push(`${capitalize(params.colorNames[0])} To ${capitalize(params.colorNames[1])}`);
    } else {
      parts.push(...params.colorNames.map(capitalize));
    }
  }
  if (params.typeName) parts.push(params.typeName);
  if (params.modifiers?.length) parts.push(`w/ ${params.modifiers.map(capitalize).join(', ')}`);
  if (params.adjustments?.length) parts.push(`(${params.adjustments.join(', ')})`);
  return parts.join(' ');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  partType: string;
  caliber: number;
  heightMeters: number;
  prefire: number;
  pattern: string;
  safetyDistance: number;
  vdl: string;
} {
  const typeIcons: Record<string, string> = {
    peony: '🔴', chrysanthemum: '💥', dahlia: '🟣', willow: '🎆',
    palm: '🌴', coconut: '🌴', brocade: '👑', kamuro: '✨',
    comet: '☄️', crossette: '✳️', ring: '💍', horsetail: '🎇',
    strobe: '⚡', mine: '💫', fountain: '⚜️', waterfall: '🌊',
    gerb: '🔥', roman: '🎇', candle: '🕯️', cake: '🎆', shell: '💫',
    salute: '💢', flare: '🔥', fan: '🪭', tourbillion: '🌀',
    spinner: '🌀', flame: '🔥', cryo: '💨', confetti: '🎊',
  };

  const calStr = `${vdl.caliber}"`;
  const colorStr = vdl.colorNames.map(capitalize).join('/');
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
    partType: vdl.partType,
    caliber: vdl.caliber,
    heightMeters: vdl.height,
    prefire: vdl.prefire,
    pattern: vdl.type,
    safetyDistance: vdl.safetyDistance,
    vdl: vdl.raw,
  };
}
