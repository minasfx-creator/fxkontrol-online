/**
 * ═══════════════════════════════════════════════════════════════════════
 * Visual Descriptive Language (VDL) Parser — Full Finale 3D Spec
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Converts VDL text descriptions into structured rendering parameters.
 * Full compliance with Finale 3D VDL specification.
 * 
 * Features:
 *   - Finale-exact RGB color table with impliesTrail flag
 *   - Complete adjustment terms (Size, Brightness, Density, etc.)
 *   - Timing terms: PFT, LFT, DLY, DUR, CDS
 *   - Angle terms: R15-R180, L15-L180
 *   - Conjunctions: + (cake/chain shots), & (multi-color), w/ (combine)
 *   - "No Trail" modifier
 *   - Cake descriptions with firing patterns
 *   - Chain descriptions with CDS delays
 */

export interface VDLResult {
  caliber: number;
  caliberMM: number;
  colors: string[];
  colorNames: string[];
  colorTransition: 'none' | 'to' | 'changing' | 'alternating';
  type: string;
  typeName: string;
  partType: string;
  modifiers: string[];
  adjustments: string[];
  height: number;
  spread: number;
  duration: number;
  prefire: number;
  starCount: number;
  breakSpeed: number;
  safetyDistance: number;
  cost: number;
  raw: string;
  valid: boolean;
  trailType: 'none' | 'comet' | 'glitter' | 'brocade' | 'charcoal' | 'smoke';
  hasReport: boolean;
  hasPistil: boolean;
  pistilColor: string;
  twinkle: boolean;
  fallingLeaves: boolean;
  splitStars: boolean;
  numSplits: number;
  // ── Finale Full Spec additions ──
  angleOffset: number;       // R45, L30 etc. in degrees (+ = right, - = left)
  liftTime: number;          // LFT override (-1 = not set)
  delayBefore: number;       // DLY
  durOverride: number;       // DUR for shots in cakes/chains (-1 = not set)
  noTrail: boolean;          // "No Trail" modifier
  isChain: boolean;          // Chain keyword detected
  chainCount: number;        // Chain Of N
  chainEffects: string[];    // individual VDL per shell (split by +)
  chainDelays: number[];     // CDS values per gap
  shotCount: number;         // N Shot (cakes)
  cakeDuration: number;      // total cake time (-1 = not set)
  cakeRows: number;          // N Rows
  firingPattern: string;     // Z-Shape, Fan, X-Shape, W-Shape, etc.
  isAerial: boolean;         // "Shell" or "Aerial" keyword
  multiColors: string[][];   // & separated multi-color groups
  impliesTrail: boolean;     // color implies trail of sparks
  // ── SuperVDL: Niagara fusion ──
  niagaraPreset?: string;           // matched Niagara preset ID
  niagaraProfile?: {
    starCount: number;
    lifetime: number;
    velocity: number;
    drag: number;
    gravityScale: number;
    sparkleRate: number;
    glowIntensity: number;
    fadeProfile: 'linear' | 'exponential' | 'ember';
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Finale-exact VDL Color Dictionary (Table 1 from spec)
// ═══════════════════════════════════════════════════════════════════════
interface VDLColorEntry {
  hex: string;
  r: number; g: number; b: number;
  impliesTrail: boolean;
  tipHex?: string; // for trail-implying colors, the non-trail variant
}

const VDL_COLORS_TABLE: Record<string, VDLColorEntry> = {
  aqua:          { hex: '#337fcc', r: 0.20, g: 0.50, b: 0.80, impliesTrail: false },
  blue:          { hex: '#4c66ff', r: 0.30, g: 0.40, b: 1.15, impliesTrail: false },
  charcoal:      { hex: '#5a280a', r: 0.90, g: 0.40, b: 0.10, impliesTrail: true, tipHex: '#5a280a' },
  'charcoal tip':{ hex: '#5a280a', r: 0.90, g: 0.40, b: 0.10, impliesTrail: false },
  cyan:          { hex: '#51a3cc', r: 0.32, g: 0.64, b: 0.80, impliesTrail: false },
  dark:          { hex: '#000000', r: 0.00, g: 0.00, b: 0.00, impliesTrail: false },
  'fresh yellow':{ hex: '#b29959', r: 0.70, g: 0.60, b: 0.35, impliesTrail: false },
  fuchsia:       { hex: '#d859e5', r: 0.85, g: 0.35, b: 0.90, impliesTrail: false },
  gamboge:       { hex: '#ff9959', r: 1.00, g: 0.35, b: 0.05, impliesTrail: true, tipHex: '#ff9959' },
  'gamboge tip': { hex: '#ff9959', r: 1.00, g: 0.35, b: 0.05, impliesTrail: false },
  gold:          { hex: '#504605', r: 0.80, g: 0.70, b: 0.05, impliesTrail: true, tipHex: '#504605' },
  'gold tip':    { hex: '#504605', r: 0.80, g: 0.70, b: 0.05, impliesTrail: false },
  'grass green': { hex: '#3fb20c', r: 0.25, g: 0.70, b: 0.05, impliesTrail: false },
  green:         { hex: '#26b21c', r: 0.15, g: 0.70, b: 0.11, impliesTrail: false },
  indigo:        { hex: '#7f3fff', r: 0.50, g: 0.25, b: 1.15, impliesTrail: false },
  lavender:      { hex: '#a03fff', r: 0.63, g: 0.25, b: 1.15, impliesTrail: false },
  lemon:         { hex: '#bf990c', r: 0.75, g: 0.60, b: 0.05, impliesTrail: false },
  lime:          { hex: '#59b21c', r: 0.35, g: 0.70, b: 0.11, impliesTrail: false },
  magenta:       { hex: '#cc19ff', r: 0.80, g: 0.10, b: 1.00, impliesTrail: false },
  orange:        { hex: '#e56619', r: 0.90, g: 0.40, b: 0.10, impliesTrail: false },
  peach:         { hex: '#cc7f19', r: 0.80, g: 0.50, b: 0.10, impliesTrail: false },
  pink:          { hex: '#d859bf', r: 0.85, g: 0.35, b: 0.75, impliesTrail: false },
  plum:          { hex: '#b2197f', r: 0.70, g: 0.10, b: 0.50, impliesTrail: false },
  purple:        { hex: '#bf3fff', r: 0.75, g: 0.25, b: 1.15, impliesTrail: false },
  red:           { hex: '#f21919', r: 0.95, g: 0.10, b: 0.10, impliesTrail: false },
  ruby:          { hex: '#f2194c', r: 0.95, g: 0.10, b: 0.30, impliesTrail: false },
  'sea blue':    { hex: '#3f7fff', r: 0.25, g: 0.50, b: 1.15, impliesTrail: false },
  silver:        { hex: '#4b4b55', r: 0.75, g: 0.75, b: 0.85, impliesTrail: true, tipHex: '#4b4b55' },
  'silver tip':  { hex: '#4b4b55', r: 0.75, g: 0.75, b: 0.85, impliesTrail: false },
  'sky blue':    { hex: '#337fcc', r: 0.20, g: 0.50, b: 0.80, impliesTrail: false },
  turquoise:     { hex: '#28a3cc', r: 0.16, g: 0.64, b: 0.80, impliesTrail: false },
  violet:        { hex: '#cc66ff', r: 0.80, g: 0.40, b: 1.00, impliesTrail: false },
  white:         { hex: '#bfbfd8', r: 0.75, g: 0.75, b: 0.85, impliesTrail: false },
  yellow:        { hex: '#ccb20c', r: 0.80, g: 0.70, b: 0.05, impliesTrail: false },
  // ── Extended (non-Finale-canonical but commonly used) ──
  titanium:      { hex: '#e8e8e8', r: 0.91, g: 0.91, b: 0.91, impliesTrail: true },
  copper:        { hex: '#b87333', r: 0.72, g: 0.45, b: 0.20, impliesTrail: false },
  bronze:        { hex: '#cd7f32', r: 0.80, g: 0.50, b: 0.20, impliesTrail: false },
  scarlet:       { hex: '#ff2400', r: 1.00, g: 0.14, b: 0.00, impliesTrail: false },
  crimson:       { hex: '#dc143c', r: 0.86, g: 0.08, b: 0.24, impliesTrail: false },
  emerald:       { hex: '#50c878', r: 0.31, g: 0.78, b: 0.47, impliesTrail: false },
  amber:         { hex: '#ffbf00', r: 1.00, g: 0.75, b: 0.00, impliesTrail: false },
  rose:          { hex: '#ff007f', r: 1.00, g: 0.00, b: 0.50, impliesTrail: false },
  teal:          { hex: '#008080', r: 0.00, g: 0.50, b: 0.50, impliesTrail: false },
  chartreuse:    { hex: '#7fff00', r: 0.50, g: 1.00, b: 0.00, impliesTrail: false },
  nishiki:       { hex: '#ffd700', r: 1.00, g: 0.84, b: 0.00, impliesTrail: true },
  brocade:       { hex: '#ffe4b5', r: 1.00, g: 0.89, b: 0.71, impliesTrail: true },
  crackling:     { hex: '#ffa500', r: 1.00, g: 0.65, b: 0.00, impliesTrail: false },
  strobe:        { hex: '#ffffff', r: 1.00, g: 1.00, b: 1.00, impliesTrail: false },
};

// Legacy flat map for backward compatibility
const VDL_COLORS: Record<string, string> = {};
for (const [name, entry] of Object.entries(VDL_COLORS_TABLE)) {
  VDL_COLORS[name] = entry.hex;
}

// ═══════════════════════════════════════════════════════════════════════
// VDL Effect Type Database
// ═══════════════════════════════════════════════════════════════════════
interface VDLTypeSpec {
  name: string;
  baseSpread: number;
  baseDuration: number;
  baseStars: number;
  baseBreakSpeed: number;
  trailDefault: VDLResult['trailType'];
  partType: string;
  forcesTrail?: boolean; // Chrysanthemum, Willow etc. force trails regardless of color
}

const VDL_TYPES: Record<string, VDLTypeSpec> = {
  peony:         { name: 'Peony', baseSpread: 45, baseDuration: 1.6, baseStars: 150, baseBreakSpeed: 28, trailDefault: 'none', partType: 'shell' },
  chrysanthemum: { name: 'Chrysanthemum', baseSpread: 52, baseDuration: 2.2, baseStars: 200, baseBreakSpeed: 30, trailDefault: 'comet', partType: 'shell', forcesTrail: true },
  dahlia:        { name: 'Dahlia', baseSpread: 38, baseDuration: 1.2, baseStars: 80,  baseBreakSpeed: 35, trailDefault: 'none', partType: 'shell' },
  willow:        { name: 'Willow', baseSpread: 55, baseDuration: 4.0, baseStars: 180, baseBreakSpeed: 20, trailDefault: 'charcoal', partType: 'shell', forcesTrail: true },
  palm:          { name: 'Palm', baseSpread: 60, baseDuration: 3.5, baseStars: 60,  baseBreakSpeed: 24, trailDefault: 'comet', partType: 'shell', forcesTrail: true },
  coconut:       { name: 'Coconut Palm', baseSpread: 65, baseDuration: 4.5, baseStars: 40,  baseBreakSpeed: 22, trailDefault: 'comet', partType: 'shell', forcesTrail: true },
  brocade:       { name: 'Brocade Crown', baseSpread: 50, baseDuration: 3.2, baseStars: 250, baseBreakSpeed: 25, trailDefault: 'brocade', partType: 'shell', forcesTrail: true },
  kamuro:        { name: 'Kamuro', baseSpread: 55, baseDuration: 5.0, baseStars: 300, baseBreakSpeed: 18, trailDefault: 'glitter', partType: 'shell', forcesTrail: true },
  horsetail:     { name: 'Horsetail', baseSpread: 30, baseDuration: 4.5, baseStars: 100, baseBreakSpeed: 18, trailDefault: 'charcoal', partType: 'shell', forcesTrail: true },
  crossette:     { name: 'Crossette', baseSpread: 35, baseDuration: 2.0, baseStars: 36,  baseBreakSpeed: 32, trailDefault: 'comet', partType: 'shell', forcesTrail: true },
  ring:          { name: 'Ring', baseSpread: 40, baseDuration: 1.8, baseStars: 80,  baseBreakSpeed: 28, trailDefault: 'none', partType: 'shell' },
  salute:        { name: 'Salute', baseSpread: 60, baseDuration: 0.3, baseStars: 0,   baseBreakSpeed: 40, trailDefault: 'none', partType: 'shell' },
  flare:         { name: 'Flare', baseSpread: 5,  baseDuration: 5.0, baseStars: 1,   baseBreakSpeed: 2,  trailDefault: 'smoke', partType: 'single_shot' },
  tourbillion:   { name: 'Tourbillion', baseSpread: 20, baseDuration: 3.5, baseStars: 18,  baseBreakSpeed: 14, trailDefault: 'comet', partType: 'shell' },
  spinner:       { name: 'Spinner', baseSpread: 360, baseDuration: 4.0, baseStars: 30,  baseBreakSpeed: 8,  trailDefault: 'comet', partType: 'ground' },
  mine:          { name: 'Mine', baseSpread: 70, baseDuration: 1.2, baseStars: 60,  baseBreakSpeed: 28, trailDefault: 'comet', partType: 'mine' },
  comet:         { name: 'Comet', baseSpread: 8,  baseDuration: 1.5, baseStars: 1,   baseBreakSpeed: 45, trailDefault: 'comet', partType: 'comet' },
  fountain:      { name: 'Fountain', baseSpread: 12, baseDuration: 8.0, baseStars: 350, baseBreakSpeed: 12, trailDefault: 'none', partType: 'gerb' },
  gerb:          { name: 'Gerb', baseSpread: 10, baseDuration: 5.0, baseStars: 250, baseBreakSpeed: 14, trailDefault: 'none', partType: 'gerb' },
  waterfall:     { name: 'Waterfall', baseSpread: 18, baseDuration: 15.0, baseStars: 500, baseBreakSpeed: 3,  trailDefault: 'charcoal', partType: 'waterfall' },
  cake:          { name: 'Cake', baseSpread: 30, baseDuration: 15.0, baseStars: 80,  baseBreakSpeed: 24, trailDefault: 'none', partType: 'cake' },
  roman:         { name: 'Roman Candle', baseSpread: 5,  baseDuration: 10.0, baseStars: 10,  baseBreakSpeed: 28, trailDefault: 'comet', partType: 'candle' },
  candle:        { name: 'Roman Candle', baseSpread: 5,  baseDuration: 10.0, baseStars: 10,  baseBreakSpeed: 28, trailDefault: 'comet', partType: 'candle' },
  fan:           { name: 'Fan', baseSpread: 90, baseDuration: 2.5, baseStars: 60,  baseBreakSpeed: 28, trailDefault: 'none', partType: 'fan' },
  flame:         { name: 'Flame', baseSpread: 15, baseDuration: 3.0, baseStars: 0,   baseBreakSpeed: 0,  trailDefault: 'none', partType: 'flame' },
  cryo:          { name: 'Cryo Jet', baseSpread: 20, baseDuration: 3.0, baseStars: 0,   baseBreakSpeed: 0,  trailDefault: 'none', partType: 'sfx' },
  confetti:      { name: 'Confetti', baseSpread: 60, baseDuration: 3.0, baseStars: 0,   baseBreakSpeed: 0,  trailDefault: 'none', partType: 'sfx' },
  streamer:      { name: 'Streamer', baseSpread: 45, baseDuration: 4.0, baseStars: 0,   baseBreakSpeed: 0,  trailDefault: 'none', partType: 'sfx' },
  shell:         { name: 'Shell', baseSpread: 45, baseDuration: 1.6, baseStars: 150, baseBreakSpeed: 28, trailDefault: 'none', partType: 'shell' },
  // ── Additional Finale types ──
  ghost:         { name: 'Ghost Shell', baseSpread: 50, baseDuration: 2.5, baseStars: 120, baseBreakSpeed: 26, trailDefault: 'smoke', partType: 'shell' },
  bombette:      { name: 'Bombette', baseSpread: 25, baseDuration: 1.4, baseStars: 40, baseBreakSpeed: 20, trailDefault: 'none', partType: 'shell' },
};

// ═══════════════════════════════════════════════════════════════════════
// VDL Modifiers
// ═══════════════════════════════════════════════════════════════════════
const VDL_MODIFIERS = [
  'tail', 'glitter', 'strobe', 'blink', 'crackle', 'crackling',
  'pistil', 'rising', 'falling', 'flying', 'hummer', 'whistle',
  'report', 'flash', 'smoke', 'parachute', 'go-getter', 'serpent',
  'split', 'twinkle', 'flicker', 'wave', 'time-rain', 'ghost',
  'transform', 'core', 'leaves', 'senko', 'hanabi', 'bouquet',
];

// ═══════════════════════════════════════════════════════════════════════
// Finale Full Adjustment Matrix
// ═══════════════════════════════════════════════════════════════════════
type AdjFactor = 'spread' | 'stars' | 'brightness' | 'trailBrightness' | 'tipBrightness' | 'duration' | 'speed' | 'height' | 'trailThickness' | 'trailLength' | 'droopy' | 'ragged' | 'uniform';

interface AdjEntry {
  term: string;
  factor: AdjFactor;
  value: number;
}

const VDL_ADJUSTMENTS: AdjEntry[] = [
  // Size (spread)
  { term: 'very big', factor: 'spread', value: 1.5 },
  { term: 'big', factor: 'spread', value: 1.25 },
  { term: 'slightly big', factor: 'spread', value: 1.1 },
  { term: 'slightly small', factor: 'spread', value: 0.9 },
  { term: 'small', factor: 'spread', value: 0.75 },
  { term: 'very small', factor: 'spread', value: 0.6 },
  // Legacy aliases
  { term: 'very large', factor: 'spread', value: 1.5 },
  { term: 'large', factor: 'spread', value: 1.25 },
  { term: 'slightly large', factor: 'spread', value: 1.1 },
  // Brightness (star)
  { term: 'very bright', factor: 'brightness', value: 1.5 },
  { term: 'bright', factor: 'brightness', value: 1.25 },
  { term: 'slightly bright', factor: 'brightness', value: 1.1 },
  { term: 'slightly dim', factor: 'brightness', value: 0.9 },
  { term: 'dim', factor: 'brightness', value: 0.7 },
  { term: 'very dim', factor: 'brightness', value: 0.5 },
  // Trail brightness
  { term: 'very bright trail', factor: 'trailBrightness', value: 1.5 },
  { term: 'bright trail', factor: 'trailBrightness', value: 1.25 },
  { term: 'slightly bright trail', factor: 'trailBrightness', value: 1.1 },
  { term: 'slightly dim trail', factor: 'trailBrightness', value: 0.9 },
  { term: 'dim trail', factor: 'trailBrightness', value: 0.7 },
  { term: 'very dim trail', factor: 'trailBrightness', value: 0.5 },
  // Tip brightness
  { term: 'very bright tip', factor: 'tipBrightness', value: 1.5 },
  { term: 'bright tip', factor: 'tipBrightness', value: 1.25 },
  { term: 'slightly bright tip', factor: 'tipBrightness', value: 1.1 },
  { term: 'slightly dim tip', factor: 'tipBrightness', value: 0.9 },
  { term: 'dim tip', factor: 'tipBrightness', value: 0.7 },
  { term: 'very dim tip', factor: 'tipBrightness', value: 0.5 },
  // Density (star count)
  { term: 'very dense', factor: 'stars', value: 2.0 },
  { term: 'dense', factor: 'stars', value: 1.5 },
  { term: 'slightly dense', factor: 'stars', value: 1.2 },
  { term: 'slightly sparse', factor: 'stars', value: 0.8 },
  { term: 'sparse', factor: 'stars', value: 0.6 },
  { term: 'very sparse', factor: 'stars', value: 0.4 },
  // Trail thickness
  { term: 'very thick', factor: 'trailThickness', value: 2.0 },
  { term: 'thick', factor: 'trailThickness', value: 1.5 },
  { term: 'slightly thick', factor: 'trailThickness', value: 1.2 },
  { term: 'slightly thin', factor: 'trailThickness', value: 0.8 },
  { term: 'thin', factor: 'trailThickness', value: 0.6 },
  { term: 'very thin', factor: 'trailThickness', value: 0.4 },
  // Trail length
  { term: 'very long trail', factor: 'trailLength', value: 2.0 },
  { term: 'long trail', factor: 'trailLength', value: 1.5 },
  { term: 'slightly long trail', factor: 'trailLength', value: 1.2 },
  { term: 'slightly short trail', factor: 'trailLength', value: 0.8 },
  { term: 'short trail', factor: 'trailLength', value: 0.6 },
  { term: 'very short trail', factor: 'trailLength', value: 0.4 },
  // Duration
  { term: 'very long', factor: 'duration', value: 1.5 },
  { term: 'long', factor: 'duration', value: 1.25 },
  { term: 'slightly long', factor: 'duration', value: 1.1 },
  { term: 'slightly short', factor: 'duration', value: 0.9 },
  { term: 'short', factor: 'duration', value: 0.75 },
  { term: 'very short', factor: 'duration', value: 0.6 },
  // Speed
  { term: 'slow', factor: 'speed', value: 0.7 },
  { term: 'fast', factor: 'speed', value: 1.4 },
  // Height
  { term: 'high', factor: 'height', value: 1.3 },
  { term: 'low', factor: 'height', value: 0.7 },
  // Droopy (gerb/fountain spark hang time)
  { term: 'very droopy', factor: 'droopy', value: 1.5 },
  { term: 'droopy', factor: 'droopy', value: 1.25 },
  { term: 'slightly droopy', factor: 'droopy', value: 1.1 },
  // Ragged / Uniform (break pattern regularity)
  { term: 'very ragged', factor: 'ragged', value: 1.5 },
  { term: 'ragged', factor: 'ragged', value: 1.25 },
  { term: 'slightly ragged', factor: 'ragged', value: 1.1 },
  { term: 'very uniform', factor: 'uniform', value: 1.5 },
  { term: 'uniform', factor: 'uniform', value: 1.25 },
  { term: 'slightly uniform', factor: 'uniform', value: 1.1 },
];

// Sort adjustments by term length descending so longer terms match first
const SORTED_ADJUSTMENTS = [...VDL_ADJUSTMENTS].sort((a, b) => b.term.length - a.term.length);

const CALIBER_REGEX = /(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es)?)?|"|''|pol)/i;
const CALIBER_MM_REGEX = /(\d+)\s*mm/i;
const COLOR_TRANSITION_REGEX = /(\w+)\s+(?:to|a)\s+(\w+)/i;

// ── Timing term regexes ──
const PFT_REGEX = /(\d+\.?\d*)\s*(?:s\s+)?PFT/i;
const LFT_REGEX = /(\d+\.?\d*)\s*LFT/i;
const DLY_REGEX = /(\d+\.?\d*)\s*DLY/i;
const DUR_REGEX = /(\d+\.?\d*)\s*DUR/i;
const CDS_REGEX = /(\d+\.?\d*)\s*CDS/gi;

// ── Angle regexes ──
const ANGLE_RIGHT_REGEX = /\bR(\d+)\b/g;
const ANGLE_LEFT_REGEX = /\bL(\d+)\b/g;

// ── Chain/Cake regexes ──
const CHAIN_COUNT_REGEX = /Chain\s+(?:Of\s+)?(\d+)/i;
const SHOT_COUNT_REGEX = /(\d+)\s+Shot/i;
const DURATION_REGEX = /(\d+\.?\d*)\s*s(?:econds?)?(?=\s)/i;
const HEIGHT_REGEX = /(\d+\.?\d*)\s*m(?=\s|$)/i;
const ROW_COUNT_REGEX = /(\d+)\s+Rows?/i;

// ── Firing patterns (body keywords → internal key) ──
const BODY_FIRING_PATTERNS: Record<string, string> = {
  'x-shape': 'x-shape', 'c-shape': 'c-shape', 'v-shape': 'v-shape',
  'zipper': 'z-shape', 'z-shape': 'z-shape', 'bookend': 'bookend',
  'wipe': 'wipe', 'w-shape': 'w-shape', 'r-shape': 'x-shape',
  'peacock': 'x-shape', 'angle': 'angle', 'fan': 'fan',
};

// ── Row firing pattern keywords (3-letter codes) ──
const ROW_PATTERNS = [
  'STR', 'STL', 'STT', 'ALR', 'ALL', 'ALT', 'ARR', 'ARL', 'ART',
  'FNR', 'FNL', 'FNT', 'BLR', 'BLL', 'BLT', 'BRR', 'BRL', 'BRT',
  'CTO', 'OTC', 'TRI', 'TRX', 'TRS', 'VST', 'VSS',
  // aliases
  'STW', 'AGW', 'AGT', 'FNW', 'ATF', 'BKW', 'BKT', 'CRN',
];

// ═══════════════════════════════════════════════════════════════════════
// Calibration-aware lookups
// ═══════════════════════════════════════════════════════════════════════
import { interpolateCaliberData, MANUFACTURER_PROFILES, type ManufacturerProfile } from './manufacturerCalibration';

let _activeProfile: ManufacturerProfile = MANUFACTURER_PROFILES[0];

export function setVDLManufacturerProfile(profile: ManufacturerProfile) {
  _activeProfile = profile;
}

export function getVDLManufacturerProfile(): ManufacturerProfile {
  return _activeProfile;
}

function getFinaleBreakHeight(caliberInches: number): number {
  return interpolateCaliberData(_activeProfile, caliberInches).heightM;
}

function getFinalePrefire(caliberInches: number): number {
  return interpolateCaliberData(_activeProfile, caliberInches).prefireSec;
}

function getFinaleSafetyDistance(caliberInches: number): number {
  return interpolateCaliberData(_activeProfile, caliberInches).safetyM;
}

// ═══════════════════════════════════════════════════════════════════════
// Main VDL Parser
// ═══════════════════════════════════════════════════════════════════════
export function parseVDL(input: string): VDLResult {
  const raw = input.trim();
  const lower = raw.toLowerCase();

  const result: VDLResult = {
    caliber: 3, caliberMM: 75,
    colors: [], colorNames: [],
    colorTransition: 'none',
    type: 'peony', typeName: 'Peony',
    partType: 'shell',
    modifiers: [], adjustments: [],
    height: 55, spread: 45, duration: 1.8, prefire: 1.3,
    starCount: 100, breakSpeed: 16, safetyDistance: 70, cost: 10,
    raw, valid: false,
    trailType: 'none', hasReport: false,
    hasPistil: false, pistilColor: '#FFD700',
    twinkle: false, fallingLeaves: false,
    splitStars: false, numSplits: 0,
    // New Finale fields
    angleOffset: 0, liftTime: -1, delayBefore: 0, durOverride: -1,
    noTrail: false, isChain: false, chainCount: 0,
    chainEffects: [], chainDelays: [],
    shotCount: 0, cakeDuration: -1, cakeRows: 0,
    firingPattern: '', isAerial: false,
    multiColors: [], impliesTrail: false,
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

  // ── Parse timing terms ──
  const pftMatch = raw.match(PFT_REGEX);
  if (pftMatch) {
    const pft = parseFloat(pftMatch[1]);
    if (pft < 0.5) {
      result.delayBefore = pft;
    } else {
      result.prefire = pft;
      result.liftTime = pft;
    }
  }
  const lftMatch = raw.match(LFT_REGEX);
  if (lftMatch) result.liftTime = parseFloat(lftMatch[1]);
  const dlyMatch = raw.match(DLY_REGEX);
  if (dlyMatch) result.delayBefore = parseFloat(dlyMatch[1]);
  const durMatch = raw.match(DUR_REGEX);
  if (durMatch) result.durOverride = parseFloat(durMatch[1]);

  // ── Parse angle offset (R45, L30, etc.) ──
  let angleMatch: RegExpExecArray | null;
  ANGLE_RIGHT_REGEX.lastIndex = 0;
  ANGLE_LEFT_REGEX.lastIndex = 0;
  while ((angleMatch = ANGLE_RIGHT_REGEX.exec(raw)) !== null) {
    result.angleOffset = parseInt(angleMatch[1]);
  }
  while ((angleMatch = ANGLE_LEFT_REGEX.exec(raw)) !== null) {
    result.angleOffset = -parseInt(angleMatch[1]);
  }

  // ── Parse "No Trail" ──
  if (/\bno\s+trail\b/i.test(raw)) {
    result.noTrail = true;
  }

  // ── Parse "Aerial" or "Shell" keyword for cakes ──
  if (/\baerial\b/i.test(raw) || /\bshell\b/i.test(lower) && /\bcake\b/i.test(lower)) {
    result.isAerial = true;
  }

  // ── Parse Chain ──
  if (/\bchain\b/i.test(raw)) {
    result.isChain = true;
    const chainCountMatch = raw.match(CHAIN_COUNT_REGEX);
    // Count plus signs for chain effects
    const plusParts = raw.split(/\s*\+\s*/);
    if (chainCountMatch) {
      result.chainCount = parseInt(chainCountMatch[1]);
    } else if (plusParts.length > 1) {
      result.chainCount = plusParts.length;
    } else {
      result.chainCount = 10; // default
    }
    if (plusParts.length > 1) {
      result.chainEffects = plusParts.map(p => p.replace(/\bchain\b.*$/i, '').trim()).filter(Boolean);
    }
    // Parse CDS delays
    CDS_REGEX.lastIndex = 0;
    let cdsMatch: RegExpExecArray | null;
    while ((cdsMatch = CDS_REGEX.exec(raw)) !== null) {
      result.chainDelays.push(parseFloat(cdsMatch[1]));
    }
  }

  // ── Parse Cake ──
  if (/\bcake\b/i.test(raw) && !result.isChain) {
    result.type = 'cake';
    result.typeName = 'Cake';
    result.partType = 'cake';
    const shotMatch = raw.match(SHOT_COUNT_REGEX);
    if (shotMatch) result.shotCount = parseInt(shotMatch[1]);
    const rowMatch = raw.match(ROW_COUNT_REGEX);
    if (rowMatch) result.cakeRows = parseInt(rowMatch[1]);
    const durMatchCake = raw.match(DURATION_REGEX);
    if (durMatchCake) result.cakeDuration = parseFloat(durMatchCake[1]);
    // Parse firing pattern from body
    for (const [keyword, pattern] of Object.entries(BODY_FIRING_PATTERNS)) {
      if (lower.includes(keyword)) {
        result.firingPattern = pattern;
        break;
      }
    }
    // Parse row firing patterns (3-letter codes)
    for (const pat of ROW_PATTERNS) {
      if (raw.includes(pat)) {
        if (!result.firingPattern) result.firingPattern = pat.toLowerCase();
        break;
      }
    }
  }

  // ── Parse duration from "Ns" format ──
  if (!result.isChain && result.type !== 'cake') {
    const simpleDur = raw.match(DURATION_REGEX);
    if (simpleDur) result.duration = parseFloat(simpleDur[1]);
  }

  // ── Parse height from "Nm" format ──
  const htMatch = raw.match(HEIGHT_REGEX);
  if (htMatch) result.height = parseFloat(htMatch[1]);

  // ── Parse & multi-color groups ──
  const ampParts = raw.split(/\s*&\s*/);
  if (ampParts.length > 1) {
    result.multiColors = ampParts.map(part => {
      const colors: string[] = [];
      for (const [name, entry] of Object.entries(VDL_COLORS_TABLE)) {
        if (name.includes(' ')) continue; // skip multi-word
        if (part.toLowerCase().includes(name)) colors.push(entry.hex);
      }
      return colors;
    }).filter(g => g.length > 0);
  }

  // ── Parse color transition ("Red to Blue") ──
  const transMatch = raw.match(COLOR_TRANSITION_REGEX);
  if (transMatch) {
    const c1 = VDL_COLORS_TABLE[transMatch[1].toLowerCase()];
    const c2 = VDL_COLORS_TABLE[transMatch[2].toLowerCase()];
    if (c1 && c2) {
      result.colorTransition = 'to';
      result.colors = [c1.hex, c2.hex];
      result.colorNames = [transMatch[1].toLowerCase(), transMatch[2].toLowerCase()];
      result.impliesTrail = c1.impliesTrail || c2.impliesTrail;
    }
  }
  if (lower.includes('changing') || lower.includes('transform')) {
    result.colorTransition = 'changing';
  }
  if (lower.includes('alternating')) {
    result.colorTransition = 'alternating';
  }

  // ── Parse colors (if not already from transition) ──
  if (result.colors.length === 0) {
    // Sort color names by length descending for greedy matching
    const sortedColorNames = Object.keys(VDL_COLORS_TABLE).sort((a, b) => b.length - a.length);
    const skipColors = new Set(['strobe', 'crackling', 'brocade', 'charcoal']);
    for (const name of sortedColorNames) {
      if (name.includes(' ') && !lower.includes(name)) continue;
      if (!name.includes(' ') && !lower.includes(name)) continue;
      if (skipColors.has(name)) continue;
      const entry = VDL_COLORS_TABLE[name];
      if (!result.colors.includes(entry.hex)) {
        result.colors.push(entry.hex);
        result.colorNames.push(name);
        if (entry.impliesTrail) result.impliesTrail = true;
      }
    }
    if (result.colors.length === 0) {
      result.colors = [VDL_COLORS_TABLE.gold.hex];
      result.colorNames = ['gold'];
      result.impliesTrail = true; // gold implies trail
    }
  }

  // ── Parse w/ pistil color ──
  const withMatch = raw.match(/w\/\s*(\w+)\s+pistil/i) || raw.match(/with\s+(\w+)\s+pistil/i);
  if (withMatch) {
    const pColor = VDL_COLORS_TABLE[withMatch[1].toLowerCase()];
    if (pColor) {
      result.hasPistil = true;
      result.pistilColor = pColor.hex;
    }
  }

  // ── Parse type ──
  let foundType = false;
  if (result.type !== 'cake') { // cake already parsed above
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
        // Force trail from type
        if (data.forcesTrail && !result.noTrail) {
          result.impliesTrail = true;
          if (result.trailType === 'none') result.trailType = 'comet';
        }
        break;
      }
    }
  }

  // ── Apply impliesTrail from color ──
  if (result.impliesTrail && !result.noTrail && result.trailType === 'none') {
    result.trailType = 'comet';
  }
  // ── "No Trail" override ──
  if (result.noTrail) {
    result.trailType = 'none';
    result.impliesTrail = false;
  }

  // ── Parse modifiers ──
  for (const mod of VDL_MODIFIERS) {
    if (lower.includes(mod)) {
      result.modifiers.push(mod);
    }
  }

  // ── Parse adjustments (match longest first, support compound stacking) ──
  let lowerForAdj = lower;
  for (const adj of SORTED_ADJUSTMENTS) {
    let count = 0;
    while (lowerForAdj.includes(adj.term)) {
      count++;
      result.adjustments.push(adj.term);
      lowerForAdj = lowerForAdj.replace(adj.term, '');
    }
  }

  // ── Apply caliber-based manufacturer-calibrated physics ──
  const calData = interpolateCaliberData(_activeProfile, result.caliber);
  if (!htMatch) result.height = calData.heightM; // only if not explicitly set
  if (!pftMatch && !lftMatch) result.prefire = calData.prefireSec;
  result.safetyDistance = calData.safetyM;
  
  const refData = interpolateCaliberData(_activeProfile, 3);
  const calRatio = {
    spread: calData.spreadDeg / refData.spreadDeg,
    stars: calData.starCount / refData.starCount,
    speed: calData.breakSpeed / refData.breakSpeed,
  };
  result.spread = Math.round(result.spread * calRatio.spread);
  result.duration = Math.round(result.duration * (0.85 + (result.caliber / 3) * 0.25) * 10) / 10;
  result.starCount = Math.round(result.starCount * calRatio.stars);
  result.breakSpeed = Math.round(result.breakSpeed * calRatio.speed * 10) / 10;
  result.cost = Math.round(calData.costFactor * 10) / 10;

  // ── Apply DUR override ──
  if (result.durOverride >= 0) {
    result.duration = result.durOverride;
  }

  // ── Apply adjustment scaling (compound stacking) ──
  const adjFactors: Partial<Record<AdjFactor, number>> = {};
  for (const adjName of result.adjustments) {
    const entry = VDL_ADJUSTMENTS.find(a => a.term === adjName);
    if (entry) {
      adjFactors[entry.factor] = (adjFactors[entry.factor] ?? 1) * entry.value;
    }
  }
  if (adjFactors.spread) result.spread = Math.round(result.spread * adjFactors.spread);
  if (adjFactors.stars) result.starCount = Math.round(result.starCount * adjFactors.stars);
  if (adjFactors.duration) result.duration = Math.round(result.duration * adjFactors.duration * 10) / 10;
  if (adjFactors.speed) result.breakSpeed = Math.round(result.breakSpeed * adjFactors.speed * 10) / 10;
  if (adjFactors.height) result.height = Math.round(result.height * adjFactors.height);

  // ── Apply modifier effects ──
  if (result.modifiers.includes('tail') && !result.noTrail) {
    if (result.trailType === 'none') result.trailType = 'comet';
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
  if (result.modifiers.includes('pistil') && !result.hasPistil) {
    result.hasPistil = true;
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

  result.valid = foundType || result.isChain || result.type === 'cake' || result.colorNames.length > 0 || calMatch !== null || calMmMatch !== null;

  return result;
}

// ═══════════════════════════════════════════════════════════════════════
// VDL String Generator
// ═══════════════════════════════════════════════════════════════════════
export function toVDL(params: Partial<VDLResult>): string {
  const parts: string[] = [];
  if (params.caliber) parts.push(`${params.caliber}in`);
  if (params.colorNames?.length) {
    if (params.colorTransition === 'to' && params.colorNames.length >= 2) {
      parts.push(`${capitalize(params.colorNames[0])} To ${capitalize(params.colorNames[1])}`);
    } else if (params.multiColors && params.multiColors.length > 0) {
      parts.push(params.colorNames.map(capitalize).join(' & '));
    } else {
      parts.push(...params.colorNames.map(capitalize));
    }
  }
  if (params.typeName) parts.push(params.typeName);
  if (params.noTrail) parts.push('No Trail');
  if (params.modifiers?.length) parts.push(`w/ ${params.modifiers.map(capitalize).join(', ')}`);
  if (params.adjustments?.length) parts.push(`(${params.adjustments.join(', ')})`);
  if (params.angleOffset && params.angleOffset !== 0) {
    parts.push(params.angleOffset > 0 ? `R${params.angleOffset}` : `L${Math.abs(params.angleOffset)}`);
  }
  if (params.isChain) parts.push(`Chain Of ${params.chainCount || 10}`);
  return parts.join(' ');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Get all available VDL color names (Finale-exact) */
export function getVDLColors() {
  return Object.entries(VDL_COLORS_TABLE)
    .filter(([name]) => !name.includes(' ')) // skip multi-word variants for UI
    .map(([name, entry]) => ({ name, hex: entry.hex, impliesTrail: entry.impliesTrail }));
}

/** Get all available VDL effect types */
export function getVDLTypes() {
  return Object.entries(VDL_TYPES).map(([key, data]) => ({ key, ...data }));
}

/** Get all Finale firing pattern keywords */
export function getVDLFiringPatterns() {
  return ROW_PATTERNS.slice(0, 25); // exclude aliases
}

/** Get body firing pattern keywords */
export function getVDLBodyPatterns() {
  return Object.keys(BODY_FIRING_PATTERNS);
}

/** Convert VDL result to an Effect-compatible object for timeline */
export function vdlToEffect(vdl: VDLResult) {
  const typeIcons: Record<string, string> = {
    peony: '🔴', chrysanthemum: '💥', dahlia: '🟣', willow: '🎆',
    palm: '🌴', coconut: '🌴', brocade: '👑', kamuro: '✨',
    comet: '☄️', crossette: '✳️', ring: '💍', horsetail: '🎇',
    strobe: '⚡', mine: '💫', fountain: '⚜️', waterfall: '🌊',
    gerb: '🔥', roman: '🎇', candle: '🕯️', cake: '🎆', shell: '💫',
    salute: '💢', flare: '🔥', fan: '🪭', tourbillion: '🌀',
    spinner: '🌀', flame: '🔥', cryo: '💨', confetti: '🎊',
    ghost: '👻', bombette: '💣',
  };

  const calStr = `${vdl.caliber}"`;
  const colorStr = vdl.colorNames.map(capitalize).join('/');
  const name = `${calStr} ${colorStr} ${vdl.typeName}`.trim();

  // Determine trail type from VDL color and flower type
  const trailColors = ['silver', 'gold', 'charcoal', 'gamboge'];
  const trailTypes = ['chrysanthemum', 'willow', 'palm', 'brocade', 'kamuro', 'horsetail'];
  const hasTrailFromColor = vdl.colorNames.some(c => trailColors.includes(c.toLowerCase()));
  const hasTrailFromType = trailTypes.includes(vdl.type);
  const impliesTrail = hasTrailFromColor || hasTrailFromType;

  // Determine trail type string
  let trailType: string | undefined;
  if (vdl.noTrail) {
    trailType = 'none';
  } else if (hasTrailFromColor) {
    const tc = vdl.colorNames.find(c => trailColors.includes(c.toLowerCase()));
    trailType = tc?.toLowerCase() === 'silver' ? 'glitter' :
                tc?.toLowerCase() === 'gold' ? 'brocade' :
                tc?.toLowerCase() === 'charcoal' ? 'charcoal' :
                tc?.toLowerCase() === 'gamboge' ? 'comet' : 'comet';
  } else if (hasTrailFromType) {
    trailType = 'comet';
  }

  // Secondary color from multiColors or color list
  const secondaryColor = vdl.colors.length > 1 ? vdl.colors[1] : undefined;

  // Determine color transition
  let colorTransition: string | undefined;
  if (vdl.multiColors && vdl.multiColors.length > 1) {
    colorTransition = 'alternating';
  }

  return {
    id: `vdl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    category: (vdl.caliber >= 4 ? 'morteiros' : 'peonias') as 'morteiros' | 'peonias',
    type: 'firework' as const,
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
    shotCount: vdl.shotCount > 0 ? vdl.shotCount : undefined,
    firingPattern: vdl.firingPattern || undefined,
    // ── VDL rendering metadata ──
    angleOffset: vdl.angleOffset !== 0 ? vdl.angleOffset : undefined,
    trailType,
    noTrail: vdl.noTrail || undefined,
    hasPistil: vdl.hasPistil || undefined,
    pistilColor: vdl.pistilColor || undefined,
    colorTransition,
    secondaryColor,
    impliesTrail: impliesTrail || undefined,
  };
}
