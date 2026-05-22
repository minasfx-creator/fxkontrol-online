/**
 * ─── Effect family icons ───────────────────────────────────────────
 * Custom SVG icon set per effect family (partType).
 *
 *  - `solid`    → used in family-filter chips (compact, monochrome)
 *  - `gradient` → used as fallback thumbnail in EffectLibrary cards
 *                 when no PNG render is available
 *  - `outline`  → reserved for future use (table view, tooltips)
 */

import cakeGradient from '@/assets/effect-family-icons/cake-gradient.svg';
import cakeOutline from '@/assets/effect-family-icons/cake-outline.svg';
import cakeSolid from '@/assets/effect-family-icons/cake-solid.svg';
import candleGradient from '@/assets/effect-family-icons/candle-gradient.svg';
import candleOutline from '@/assets/effect-family-icons/candle-outline.svg';
import candleSolid from '@/assets/effect-family-icons/candle-solid.svg';
import cometGradient from '@/assets/effect-family-icons/comet-gradient.svg';
import cometOutline from '@/assets/effect-family-icons/comet-outline.svg';
import cometSolid from '@/assets/effect-family-icons/comet-solid.svg';
import flameGradient from '@/assets/effect-family-icons/flame-gradient.svg';
import flameOutline from '@/assets/effect-family-icons/flame-outline.svg';
import flameSolid from '@/assets/effect-family-icons/flame-solid.svg';
import mineGradient from '@/assets/effect-family-icons/mine-gradient.svg';
import rocketSolid from '@/assets/effect-family-icons/rocket-solid.svg';
import shellGradient from '@/assets/effect-family-icons/shell-gradient.svg';
import shellOutline from '@/assets/effect-family-icons/shell-outline.svg';
import shellSolid from '@/assets/effect-family-icons/shell-solid.svg';
import shellOfShellsGradient from '@/assets/effect-family-icons/shell-of-shells-gradient.svg';
import shellOfShellsOutline from '@/assets/effect-family-icons/shell-of-shells-outline.svg';
import shellOfShellsSolid from '@/assets/effect-family-icons/shell-of-shells-solid.svg';

import type { Effect } from '@/data/effectLibrary';

export interface FamilyIconSet {
  solid: string;
  gradient: string;
  outline: string;
}

const CAKE: FamilyIconSet = { solid: cakeSolid, gradient: cakeGradient, outline: cakeOutline };
const CANDLE: FamilyIconSet = { solid: candleSolid, gradient: candleGradient, outline: candleOutline };
const COMET: FamilyIconSet = { solid: cometSolid, gradient: cometGradient, outline: cometOutline };
const FLAME: FamilyIconSet = { solid: flameSolid, gradient: flameGradient, outline: flameOutline };
const SHELL: FamilyIconSet = { solid: shellSolid, gradient: shellGradient, outline: shellOutline };
const SHELL_OF_SHELLS: FamilyIconSet = {
  solid: shellOfShellsSolid,
  gradient: shellOfShellsGradient,
  outline: shellOfShellsOutline,
};
// Mine: only gradient was provided — reuse it for solid/outline.
const MINE: FamilyIconSet = { solid: mineGradient, gradient: mineGradient, outline: mineGradient };
// Rocket: only solid was provided — reuse for gradient/outline.
const ROCKET: FamilyIconSet = { solid: rocketSolid, gradient: rocketSolid, outline: rocketSolid };

/** partType → icon set. Returns null when no custom family icon exists. */
export function familyIconsForPart(part: string | undefined | null): FamilyIconSet | null {
  switch (part) {
    case 'cake':
      return CAKE;
    case 'candle':
      return CANDLE;
    case 'rocket':
      return ROCKET;
    case 'comet':
      return COMET;
    case 'mine':
      return MINE;
    case 'shell':
    case 'single_shot':
      return SHELL;
    case 'gerb':
    case 'flame':
    case 'fountain':
    case 'waterfall':
      return FLAME;
    default:
      return null;
  }
}

/** Resolve an Effect → family icon set (using pattern, partType, then category). */
export function familyIconsForEffect(effect: Effect): FamilyIconSet | null {
  // Pattern-driven specialisation (multi-break / shell-of-shells).
  const pattern = (effect.pattern ?? '').toLowerCase();
  if (pattern === 'multibreak' || pattern === 'crossette' || pattern === 'shell_of_shells') {
    return SHELL_OF_SHELLS;
  }
  if ((effect.partType === 'shell' || effect.partType === 'single_shot') && (effect.numDevices ?? 0) > 1) {
    return SHELL_OF_SHELLS;
  }

  const direct = familyIconsForPart(effect.partType);
  if (direct) return direct;

  switch (effect.category) {
    case 'cakes_batteries':
      return CAKE;
    case 'roman_candles':
      return CANDLE;
    case 'mines':
      return MINE;
    case 'morteiros':
    case 'peonias':
      return SHELL;
    case 'waterfalls':
      return FLAME;
    default:
      return null;
  }
}
