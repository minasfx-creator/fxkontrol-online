/**
 * ─── Effect thumbnail resolver ─────────────────────────────────────
 * Maps an `Effect` (partType + pattern + category + numDevices) to one
 * of 10 raster thumbnails shipped under `src/assets/effect-thumbs/`.
 *
 * Precedence is tightest-match first (pattern → partType → category)
 * so a "Brocade Crown" reads as a CROWN (palm), not a generic shell.
 *
 * Returns `undefined` when no thumbnail is appropriate (e.g. drone,
 * laser, lighting, formations) — callers should fall back to the
 * existing color swatch.
 */

import type { Effect } from '@/data/effectLibrary';

import bengal from '@/assets/effect-thumbs/bengal.png';
import cake from '@/assets/effect-thumbs/cake.png';
import fountain from '@/assets/effect-thumbs/fountain.png';
import mine from '@/assets/effect-thumbs/mine.png';
import palm from '@/assets/effect-thumbs/palm.png';
import peony from '@/assets/effect-thumbs/peony.png';
import romanCandle from '@/assets/effect-thumbs/roman_candle.png';
import salutShell from '@/assets/effect-thumbs/salut_shell.png';
import shellOfShells from '@/assets/effect-thumbs/shell_of_shells.png';
import singleComet from '@/assets/effect-thumbs/single_comet.png';

export const EFFECT_THUMBS = {
  bengal,
  cake,
  fountain,
  mine,
  palm,
  peony,
  roman_candle: romanCandle,
  salut_shell: salutShell,
  shell_of_shells: shellOfShells,
  single_comet: singleComet,
} as const;

export type EffectThumbKey = keyof typeof EFFECT_THUMBS;

/** Resolve the best-matching thumbnail key for an Effect, or null. */
export function resolveEffectThumbKey(effect: Effect): EffectThumbKey | null {
  // Only pyro / sfx ground-effect kinds get a raster.
  if (effect.type !== 'firework' && effect.type !== 'sfx') return null;

  const pattern = (effect.pattern ?? '').toLowerCase();
  const part = effect.partType;
  const cat = effect.category;
  const multi = (effect.numDevices ?? 0) > 1;

  // 1. Pattern-driven (most specific).
  if (pattern.includes('palm') || pattern.includes('kamuro') || pattern.includes('crown') || pattern.includes('brocade')) return 'palm';
  if (pattern === 'peony' || pattern === 'chrysanthemum' || pattern === 'dahlia') return 'peony';
  if (pattern === 'crossette' || pattern === 'multibreak') return 'shell_of_shells';
  if (pattern === 'comet') return 'single_comet';
  if (pattern === 'willow') return 'palm';
  if (pattern === 'strobe') return 'bengal';

  // 2. PartType-driven.
  if (part === 'cake') return 'cake';
  if (part === 'mine') return 'mine';
  if (part === 'candle' || part === 'rocket') return 'roman_candle';
  if (part === 'comet') return 'single_comet';
  if (part === 'fountain' as Effect['partType'] || part === 'gerb' || part === 'waterfall') return 'fountain';
  if (part === 'flame' || part === 'sfx') return 'bengal';
  if (part === 'shell' || part === 'single_shot') {
    if (multi) return 'shell_of_shells';
    return 'salut_shell';
  }

  // 3. Category-driven (fallback for under-tagged entries).
  if (cat === 'cakes_batteries') return 'cake';
  if (cat === 'mines') return 'mine';
  if (cat === 'roman_candles') return 'roman_candle';
  if (cat === 'waterfalls') return 'fountain';
  if (cat === 'morteiros') return 'salut_shell';
  if (cat === 'peonias') return 'peony';
  if (cat === 'sfx') return 'bengal';

  // Drones, lasers, lighting, formations, ground-effects: no raster.
  return null;
}

/** Convenience: resolve to URL or null. */
export function resolveEffectThumb(effect: Effect): string | null {
  // Explicit per-effect override (e.g. Finale 3D preset renders).
  if (effect.thumbUrl) return effect.thumbUrl;
  const k = resolveEffectThumbKey(effect);
  return k ? EFFECT_THUMBS[k] : null;
}
