/**
 * finalePartToEffect — Adapter that maps a FinalePart (canonical XLSX row)
 * to the runtime Effect type used by the editor library + 3D renderer.
 *
 * Color resolution is delegated to `colorResolver`, which routes every input
 * (hex, EN name, PT-BR alias) through the canonical VDL palette
 * (`@/lib/vdlQuantizer`). This guarantees deterministic bucketing in
 * `effectFingerprint` regardless of vendor.
 */

import type { Effect, PartType } from '@/data/effectLibrary';
import type { FinalePart } from './types';
import { resolveEffectColorHex } from './colorResolver';

function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.+-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

function caliberToInches(size: string | number | undefined): number | undefined {
  if (size === null || size === undefined || size === '') return undefined;
  const s = String(size).trim();
  if (!s || s === '0' || s === '0.0') return undefined;
  // Matches '4"', '5\"', '6 in', '125mm', '30mm'
  const inchMatch = s.match(/^(\d+(?:\.\d+)?)\s*(?:"|in|inch)?\s*$/i);
  if (inchMatch) {
    const n = Number(inchMatch[1]);
    if (s.toLowerCase().includes('mm')) return Math.max(1, Math.round(n / 25.4));
    return n;
  }
  const mmMatch = s.match(/(\d+(?:\.\d+)?)\s*mm/i);
  if (mmMatch) return Math.max(1, Math.round(Number(mmMatch[1]) / 25.4));
  return undefined;
}

const PART_TYPE_MAP: Record<string, PartType> = {
  shell: 'shell', mine: 'mine', cake: 'cake', candle: 'candle',
  comet: 'comet', fan: 'fan', gerb: 'gerb', flame: 'flame',
  rocket: 'rocket', waterfall: 'waterfall', strobe: 'strobe',
  fountain: 'gerb', single_shot: 'single_shot', set_piece: 'set_piece',
  lancework: 'set_piece', laser: 'laser', drone: 'drone', sfx: 'sfx',
  light: 'light', formation: 'formation', girandola: 'girandola',
  ground: 'ground',
};

function inferPartType(p: FinalePart): PartType {
  const candidates = [p.partType, p.subtype, p.category, p.customPartField, p.description]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
  for (const c of candidates) {
    for (const key of Object.keys(PART_TYPE_MAP)) {
      if (c.includes(key)) return PART_TYPE_MAP[key];
    }
    if (c.includes('mortar')) return 'shell';
    if (c.includes('roman')) return 'candle';
    if (c.includes('battery')) return 'cake';
  }
  return 'shell';
}

const CATEGORY_BY_PART: Record<PartType, string> = {
  shell: 'morteiros', mine: 'mines', cake: 'cakes_batteries',
  candle: 'roman_candles', comet: 'morteiros', fan: 'cakes_batteries',
  gerb: 'sfx', flame: 'sfx', rocket: 'sfx', waterfall: 'waterfalls',
  strobe: 'sfx', single_shot: 'morteiros', set_piece: 'sfx',
  laser: 'lasers', drone: 'drones', sfx: 'sfx', light: 'iluminacao',
  formation: 'formacoes', girandola: 'ground_effects',
  ground: 'ground_effects',
};

const ICON_BY_PART: Record<PartType, string> = {
  shell: '💥', mine: '⛏️', cake: '🎂', candle: '🕯️', comet: '☄️',
  fan: '🪭', gerb: '⛲', flame: '🔥', rocket: '🚀', waterfall: '💧',
  strobe: '✨', single_shot: '💥', set_piece: '🎆', laser: '🟢',
  drone: '🛸', sfx: '✨', light: '💡', formation: '🔷',
  girandola: '🌀', ground: '🌋',
};

export function finalePartToEffectId(p: FinalePart): string {
  return `fl-${p.libraryId}-${p.partNumber.replace(/[^a-z0-9_-]+/gi, '_')}`;
}

export function finalePartToEffect(p: FinalePart): Effect {
  const partType = inferPartType(p);
  const caliber = caliberToInches(p.size as string | number | undefined);
  const heightVal = num(p.height);
  const durationVal = num(p.duration, 2);
  const prefireVal = num(p.internalDelay);
  const numDevices = num(p.numDevices, 1);
  const safety = num(p.safetyDistance);
  const cost = num(p.stdPrice, 0);
  const color = resolveEffectColorHex(p.color);

  return {
    id: finalePartToEffectId(p),
    name: p.description ? `${p.partNumber} — ${p.description}` : p.partNumber,
    category: CATEGORY_BY_PART[partType] ?? 'morteiros',
    type: partType === 'laser' ? 'laser'
        : partType === 'drone' ? 'drone'
        : partType === 'sfx' || partType === 'flame' ? 'sfx'
        : partType === 'light' ? 'light'
        : 'firework',
    color,
    duration: durationVal,
    cost,
    icon: ICON_BY_PART[partType] ?? '💥',
    partType,
    caliber: caliber,
    heightMeters: heightVal > 0 ? heightVal : undefined,
    prefire: prefireVal > 0 ? prefireVal : undefined,
    numDevices: numDevices > 0 ? numDevices : undefined,
    safetyDistance: safety > 0 ? safety : undefined,
    vdl: p.vdl,
  };
}
