/**
 * ─── FWsim Built-in Preset Catalog ────────────────────────────────
 * 44+ FWsim Pro `.fwe` presets bundled at build time.
 *
 * Pipeline:
 *   1. .fwe XML files live in `public/finale-presets/*.fwe`
 *   2. `scripts/parse-fwe-presets.py` extracts metadata to
 *      `src/data/fwsimBuiltinPresets.json`
 *   3. This module adapts each entry into a canonical `Effect`
 *      so it joins `EFFECT_LIBRARY` in `EffectLibrary.tsx`.
 *
 * Provenance: claim 'pilot' — colors/palette/caliber/starCount/shotCount
 * are extracted from the FWsim XML; pattern/heightMeters/prefire/cost
 * are heuristics (filename → pattern, per-rootType defaults).
 *
 * Thumbnails: `public/finale-presets/thumbs/NN.png` (where NN is the
 * `01..44` leading number from the filename), surfaced via
 * `Effect.thumbUrl` and `resolveEffectThumb`.
 */

import type { Effect, PartType } from '@/data/effectLibrary';
import rawPresets from '@/data/fwsimBuiltinPresets.json';

interface BuiltinPresetMeta {
  id: string;
  file: string;
  leadingNumber: string | null;
  name: string | null;
  author: string | null;
  rootType: string | null;
  caliberM: number | null;
  caliberIn: number | null;
  starCount: number | null;
  shotCount: number | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  palette: string[];
  thumbUrl: string | null;
}

const ROOT_TO_PART_TYPE: Record<string, PartType> = {
  Cake: 'cake',
  Shell: 'shell',
  Mine: 'mine',
  RomanCandle: 'candle',
  Fountain: 'gerb',
  Lancework: 'set_piece',
};

const ROOT_TO_CATEGORY: Record<string, Effect['category']> = {
  Cake: 'cakes_batteries',
  Shell: 'morteiros',
  Mine: 'mines',
  RomanCandle: 'roman_candles',
  Fountain: 'sfx',
  Lancework: 'ground_effects',
};

const ROOT_TO_ICON: Record<string, string> = {
  Cake: '🎂',
  Shell: '💥',
  Mine: '☄️',
  RomanCandle: '🕯️',
  Fountain: '🌋',
  Lancework: '🔥',
};

/** Filename keyword → pattern hint (matches FireworkRenderer dispatcher). */
function patternFromName(name: string): string | undefined {
  const n = name.toLowerCase().replace(/[_\-.]+/g, ' ');
  if (/\bcrown\b|\bbrocade\b|\bkamuro\b/.test(n)) return 'kamuro';
  if (/\bchrysanthemum\b/.test(n)) return 'chrysanthemum';
  if (/\bpeony\b/.test(n)) return 'peony';
  if (/\bdahlia\b/.test(n)) return 'dahlia';
  if (/\bpalm\b/.test(n)) return 'palm';
  if (/\bwillow\b|\bhorsetail\b|\bwaterfall\b/.test(n)) return 'willow';
  if (/\bring\b/.test(n)) return 'ring';
  if (/\bheart\b/.test(n)) return 'heart';
  if (/\bcomet\b/.test(n)) return 'comet';
  if (/\bcrossette\b|\bmultibreak\b/.test(n)) return 'crossette';
  if (/\bstrobe\b|\btitanium\b|\bsalut\b/.test(n)) return 'strobe';
  if (/\bfarfalle\b|\bbutterfly\b/.test(n)) return 'farfalle';
  return undefined;
}

function displayName(meta: BuiltinPresetMeta): string {
  const stem = meta.file.replace(/\.fwe$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  // The XML <Name> often holds the inner-component name (e.g. "Gold (short, thin)") —
  // prefer the filename, which is the human-named preset.
  return stem;
}

function metaToEffect(meta: BuiltinPresetMeta): Effect | null {
  const root = meta.rootType ?? 'Shell';
  const partType = ROOT_TO_PART_TYPE[root] ?? 'shell';
  const category = ROOT_TO_CATEGORY[root] ?? 'morteiros';
  const icon = ROOT_TO_ICON[root] ?? '✨';
  const color = meta.primaryColor ?? '#FFE2AE';
  const caliber = Math.max(2, Math.min(12, Math.round(meta.caliberIn ?? 5)));
  const heightMeters =
    root === 'Mine' ? 35 :
    root === 'Cake' ? 50 :
    root === 'Fountain' ? 12 :
    root === 'Lancework' ? 8 :
    100;
  const prefire =
    root === 'Mine' ? 0.4 :
    root === 'Cake' ? 1.0 :
    root === 'Lancework' ? 0 :
    2.5;
  // Duration heuristic — Lanceworks burn long, cakes by shot count, shells short.
  const duration =
    root === 'Cake' ? Math.max(8, (meta.shotCount ?? 12) * 0.8) :
    root === 'Lancework' ? 30 :
    root === 'Mine' ? 2.4 :
    root === 'Fountain' ? 12 :
    4.5;
  const pattern = patternFromName(meta.file);
  const cost = Math.max(15, Math.round(duration * 4 + caliber * 5));

  return {
    id: meta.id,
    name: displayName(meta),
    category,
    type: 'firework',
    color,
    duration,
    cost,
    icon,
    partType,
    caliber,
    heightMeters,
    prefire,
    pattern,
    safetyDistance: caliber * 25,
    secondaryColor: meta.secondaryColor ?? undefined,
    shotCount: meta.shotCount ?? undefined,
    impliesTrail: /tail|brocade|kamuro|crown|willow|horsetail/i.test(meta.file),
    thumbUrl: meta.thumbUrl ?? undefined,
  };
}

/** Materialised catalog — one Effect per FWsim Pro built-in preset. */
export const FWSIM_BUILTIN_EFFECTS: Effect[] = (rawPresets as BuiltinPresetMeta[])
  .map(metaToEffect)
  .filter((e): e is Effect => !!e);

export const FWSIM_BUILTIN_COUNT = FWSIM_BUILTIN_EFFECTS.length;
