/**
 * ─── Finale Part → Effect adapter ──────────────────────────────────
 * Bridges the canonical 35-column Finale 3D part schema to the runtime
 * `Effect` shape consumed by the 3D engine, timeline, and exports.
 *
 * Color path: VDL/description hint → palette → renderHex (LED-accurate).
 * Caliber path: parses "3"" / "30mm" / "1.2"" into millimetres → inches.
 * Pattern path: VDL/description sniff (chrysanthemum/willow/strobe/...).
 */

import type { Effect, PartType } from '@/data/effectLibrary';
import type { FinalePart } from '@/data/effectsLibraries/finalePart';
import { quantizeRgbToVdl, hexToRenderHex } from '@/lib/vdlColorPipeline';

const COLOR_HINTS: Array<[RegExp, [number, number, number]]> = [
  // English
  [/\bred\b/i,        [255,  10,  10]],
  [/\bgreen\b/i,      [ 30, 255,  60]],
  [/\bblue\b/i,       [ 30,  60, 255]],
  [/\bgold\b/i,       [255, 200,  40]],
  [/\bsilver\b/i,     [220, 220, 235]],
  [/\bwhite\b/i,      [255, 255, 255]],
  [/\byellow\b/i,     [255, 220,  60]],
  [/\bpurple\b/i,     [170,  60, 220]],
  [/\bmagenta\b|\bpink\b/i, [255,  60, 180]],
  [/\borange\b/i,     [255, 130,  20]],
  [/\bcyan\b|\baqua\b/i,  [ 40, 230, 255]],
  [/\blemon\b/i,      [240, 255,  80]],
  // Portuguese
  [/vermelho/i,       [255,  10,  10]],
  [/verde/i,          [ 30, 255,  60]],
  [/azul/i,           [ 30,  60, 255]],
  [/amarelo/i,        [255, 220,  60]],
  [/dourad|ouro/i,    [255, 200,  40]],
  [/prata/i,          [220, 220, 235]],
  [/branco/i,         [255, 255, 255]],
  [/roxo|violeta/i,   [170,  60, 220]],
  [/laranja/i,        [255, 130,  20]],
  [/rosa/i,           [255,  60, 180]],
  // Generic effect hints (low priority — placed last)
  [/crackling|strob/i, [255, 245, 220]],
];

export function pickRgbFromHints(hints: string): [number, number, number] {
  for (const [re, rgb] of COLOR_HINTS) if (re.test(hints)) return rgb;
  return [255, 200, 80]; // default warm pyro tint
}

const PATTERN_HINTS: Array<[RegExp, string]> = [
  [/chrysanth/i, 'chrysanthemum'],
  [/willow/i, 'willow'],
  [/peony/i, 'peony'],
  [/dahlia/i, 'dahlia'],
  [/palm/i, 'palm'],
  [/crossette/i, 'crossette'],
  [/comet/i, 'comet'],
  [/waterfall|cascade/i, 'waterfall'],
  [/strobe|strobing/i, 'strobe'],
  [/crackle|crackling/i, 'crackle'],
  [/glitter/i, 'glitter'],
  [/brocade/i, 'brocade'],
  [/ring|saturn/i, 'ring'],
  [/heart/i, 'heart'],
  [/\bmine\b/i, 'mine'],
  [/\bfan\b/i, 'fan'],
  [/cake|shot/i, 'cake'],
];

export function pickPattern(text: string): string | undefined {
  for (const [re, name] of PATTERN_HINTS) if (re.test(text)) return name;
  return undefined;
}

/** Parse "3"" / "30mm" / "1.2"" → caliber in inches (best effort). */
export function parseCaliberInches(size?: string): number | undefined {
  if (!size) return undefined;
  const s = String(size).trim();
  const inch = s.match(/([0-9]*\.?[0-9]+)\s*"/);
  if (inch) return parseFloat(inch[1]);
  const mm = s.match(/([0-9]*\.?[0-9]+)\s*mm/i);
  if (mm) return parseFloat(mm[1]) / 25.4;
  const num = s.match(/^([0-9]*\.?[0-9]+)$/);
  if (num) return parseFloat(num[1]);
  return undefined;
}

const TYPE_BY_PART: Record<string, Effect['type']> = {
  flame: 'sfx', sfx: 'sfx', laser: 'laser', light: 'light',
  drone: 'drone', formation: 'drone',
};

const PART_CATEGORY: Record<string, string> = {
  shell: 'morteiros', comet: 'morteiros', cake: 'cakes_batteries',
  cake_chained: 'cakes_batteries', mine: 'mines', candle: 'roman_candles',
  fan: 'cakes_batteries', gerb: 'ground_effects', flame: 'sfx',
  waterfall: 'waterfalls', strobe: 'ground_effects', set_piece: 'ground_effects',
  girandola: 'ground_effects', single_shot: 'mines', sfx: 'sfx',
  laser: 'lasers', light: 'iluminacao', drone: 'drones', formation: 'formacoes',
  ground: 'ground_effects', rocket: 'morteiros',
};

export interface AdaptOptions {
  /** Slug of the source library — used to namespace `id`. */
  librarySlug: string;
}

export function finalePartToEffect(p: FinalePart, opts: AdaptOptions): Effect {
  const hints = `${p.color ?? ''} ${p.vdl ?? ''} ${p.description ?? ''}`;
  const [r, g, b] = pickRgbFromHints(hints);
  const vdl = quantizeRgbToVdl(r, g, b, /*noTrail*/ false);

  const partType = String(p.partType ?? 'shell').toLowerCase() as PartType;
  const type: Effect['type'] = TYPE_BY_PART[partType] ?? 'firework';
  const caliber = parseCaliberInches(p.size);
  const pattern = pickPattern(`${p.vdl ?? ''} ${p.description ?? ''}`);

  return {
    id: `${opts.librarySlug}:${p.partNumber}`,
    name: p.description?.trim() || p.partNumber,
    category: PART_CATEGORY[partType] ?? p.category ?? opts.librarySlug,
    type,
    color: vdl.renderHex,
    duration: p.duration ?? 1.5,
    cost: typeof p.stdPrice === 'number' ? p.stdPrice : (p.stdCost ?? 0),
    icon: type === 'sfx' ? '🔥' : type === 'laser' ? '🔵' : type === 'drone' ? '🛸' : '💥',
    partType,
    caliber,
    heightMeters: p.height,
    prefire: p.internalDelay,
    fuseDelay: p.fuseDelay,
    numDevices: p.numDevices,
    safetyDistance: p.safetyDistance,
    vdl: p.vdl,
    pattern,
    impliesTrail: vdl.impliesTrail,
    lockoutDefault: p.lockoutDefault != null ? String(p.lockoutDefault) : undefined,
  };
}

/** Re-tint an existing hex via the VDL pipeline (LED-accurate). */
export function ledAccurateHex(hex: string): string {
  return hexToRenderHex(hex);
}
