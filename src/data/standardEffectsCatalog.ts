/**
 * Standard Effects Catalog — wraps 605 .fwe presets across 6 collections.
 *
 * Source: `public/finale-presets/standard-effects/**` extracted by
 * `scripts/parse-standard-effects.py` → `generated/standardEffects.json`.
 *
 * Provenance: `pilot` — XML facts only (palette, caliber, distribution,
 * structural flags). Numbers like `prefire`/`lift` come from FWsim defaults
 * when not present in the XML.
 */
import type { Effect, PartType } from '@/data/effectLibrary';
import bundle from './effectsLibraries/generated/standardEffects.json';

export interface StandardEffectColorPhase {
  at: number;
  hex: string;
  modifier?: 'strobe' | 'crackle' | 'glitter' | 'charcoal';
}

export interface StandardEffectPart {
  id: string;
  fileName: string;
  collection: string;
  subPath: string | null;
  displayName: string;
  rootType: string | null;
  typeReal?: string | null;
  distribution: string | null;
  palette: string[];
  primary: string | null;
  secondary: string | null;
  colorPhases?: StandardEffectColorPhase[];
  tailRef?: string | null;
  caliberIn: number | null;
  caliberSource?: 'xml' | 'inferred' | 'unknown';
  shotCount: number | null;
  cakeRows: number | null;
  starCount: number | null;
  fanAngleDeg: number | null;
  prefire: number | null;
  lift: number | null;
  hasPistil: boolean;
  hasTailsLink: boolean;
  hasCrackling: boolean;
  subShellCount: number;
  bengalDurationS: number | null;
}

interface Bundle {
  version: number;
  generatedAt: string;
  totalParts: number;
  byCollection: Record<string, number>;
  parts: StandardEffectPart[];
}

const BUNDLE = bundle as unknown as Bundle;

const ROOT_TO_PART: Record<string, PartType> = {
  Shell: 'shell', Mine: 'mine', Cake: 'cake', Bengal: 'light',
  RomanCandle: 'candle', Fountain: 'gerb', Rocket: 'rocket',
  Crossette: 'shell', Farfalle: 'shell', Whistle: 'sfx',
  Eruption: 'gerb', Tourbillon: 'sfx', Lancework: 'set_piece',
  GroundShellFlash: 'ground', Sun: 'set_piece',
  Vulcano: 'gerb', PhotoFlash: 'sfx', FlameJet: 'flame',
  Lycopodium: 'flame', Sparkler: 'sfx', Nautical: 'ground',
  FrontPiece: 'set_piece',
};

const CATEGORY: Record<PartType, string> = {
  shell: 'morteiros',
  comet: 'morteiros',
  mine: 'mines',
  cake: 'cakes_batteries',
  candle: 'roman_candles',
  fan: 'cakes_batteries',
  gerb: 'sfx',
  flame: 'sfx',
  rocket: 'sfx',
  waterfall: 'waterfalls',
  strobe: 'sfx',
  single_shot: 'morteiros',
  set_piece: 'sfx',
  laser: 'lasers',
  drone: 'drones',
  sfx: 'sfx',
  light: 'iluminacao',
  formation: 'formacoes',
  girandola: 'ground_effects',
  ground: 'ground_effects',
};

const ICON: Record<PartType, string> = {
  shell: '💥', mine: '⛏️', cake: '🎂', candle: '🕯️', comet: '☄️',
  fan: '🪭', gerb: '⛲', flame: '🔥', rocket: '🚀', waterfall: '💧',
  strobe: '✨', single_shot: '💥', set_piece: '🎆', laser: '🟢',
  drone: '🛸', sfx: '✨', light: '💡', formation: '🔷',
  girandola: '🌀', ground: '🌋',
};

function inferPattern(p: StandardEffectPart, part: PartType): string | undefined {
  if (part === 'mine') {
    if (p.hasTailsLink && /comet/i.test(p.displayName)) return 'mine_comet';
    if (p.secondary && /\bto\b/i.test(p.displayName)) return 'mine_color_shift';
    return 'mine';
  }
  if (part === 'shell') {
    const n = p.displayName.toLowerCase();
    if (n.includes('crown') || n.includes('kamuro')) return 'kamuro';
    if (n.includes('willow') || n.includes('horsetail')) return 'willow';
    if (n.includes('palm')) return 'palm';
    if (n.includes('ring')) return 'ring';
    if (n.includes('heart')) return 'heart';
    if (n.includes('crossette') || n.includes('spider')) return 'crossette';
    if (n.includes('chrys')) return 'chrysanthemum';
    if (n.includes('dahlia') || n.includes('peony')) return 'peony';
    return 'peony';
  }
  if (part === 'cake') {
    const n = p.displayName.toLowerCase();
    if (n.includes('fan')) return 'fan';
    if (n.includes('z-shape')) return 'z_shape';
    if (n.includes('v-shape')) return 'v_shape';
    return undefined;
  }
  return undefined;
}

function defaultDuration(part: PartType, p: StandardEffectPart): number {
  if (part === 'light' && p.bengalDurationS) return p.bengalDurationS;
  if (part === 'cake') return Math.max(8, (p.shotCount ?? 12) * 0.3);
  if (part === 'mine') return 2.4;
  if (part === 'candle') return 12;
  if (part === 'rocket') return 4;
  if (part === 'shell') {
    const c = p.caliberIn ?? 4;
    return 2 + c * 0.5;
  }
  return 3;
}

function defaultPrefire(part: PartType, p: StandardEffectPart): number {
  if (p.prefire != null) return p.prefire;
  if (p.lift != null) return p.lift;
  if (part === 'mine' || part === 'light' || part === 'candle' || part === 'cake') return 0.4;
  if (part === 'rocket') return 0.6;
  const c = p.caliberIn ?? 4;
  return Math.max(1, c * 0.5);
}

/** Build a fetch-safe URL: percent-encode each path segment (spaces, brackets, &). */
function buildStandardEffectUrl(p: StandardEffectPart): string {
  const segs = ['finale-presets', 'standard-effects', p.collection];
  if (p.subPath) for (const s of p.subPath.split('/').filter(Boolean)) segs.push(s);
  segs.push(p.fileName);
  return '/' + segs.map(encodeURIComponent).join('/');
}

/** Convert a single StandardEffectPart → Effect. */
export function standardEffectPartToEffect(p: StandardEffectPart): Effect {
  const part: PartType = ROOT_TO_PART[p.rootType ?? ''] ?? 'shell';
  const color = p.primary ?? '#FFD27A';
  const caliber = p.caliberIn ?? undefined;
  const duration = defaultDuration(part, p);
  const prefire = defaultPrefire(part, p);
  const pattern = inferPattern(p, part);
  return {
    id: p.id,
    name: p.displayName,
    category: CATEGORY[part],
    type: part === 'light' ? 'light' : part === 'drone' ? 'drone' : part === 'laser' ? 'laser' : 'firework',
    color,
    secondaryColor: p.secondary ?? undefined,
    duration,
    cost: Math.max(8, Math.round(duration * 3 + (caliber ?? 3) * 4)),
    icon: ICON[part],
    partType: part,
    caliber,
    heightMeters: caliber ? Math.round(caliber * 22) : undefined,
    prefire,
    pattern,
    safetyDistance: caliber ? caliber * 25 : 30,
    shotCount: p.shotCount ?? p.starCount ?? undefined,
    hasPistil: p.hasPistil || undefined,
    impliesTrail: p.hasTailsLink || undefined,
    colorTransition: p.secondary ? `${color}→${p.secondary}` : undefined,
    finalePresetUrl: buildStandardEffectUrl(p),
    tailRef: p.tailRef ?? undefined,
    colorPhases: p.colorPhases && p.colorPhases.length > 0 ? p.colorPhases : undefined,
    caliberSource: p.caliberSource,
}

let _cache: Effect[] | null = null;

export function getStandardEffects(): Effect[] {
  if (_cache) return _cache;
  _cache = BUNDLE.parts.map(standardEffectPartToEffect);
  return _cache;
}

export const STANDARD_EFFECTS_META = {
  version: BUNDLE.version,
  generatedAt: BUNDLE.generatedAt,
  total: BUNDLE.totalParts,
  byCollection: BUNDLE.byCollection,
} as const;
