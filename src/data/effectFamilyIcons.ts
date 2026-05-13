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
import cometGradient from '@/assets/effect-family-icons/comet-gradient.svg';
import cometOutline from '@/assets/effect-family-icons/comet-outline.svg';
import cometSolid from '@/assets/effect-family-icons/comet-solid.svg';
import flameGradient from '@/assets/effect-family-icons/flame-gradient.svg';
import flameOutline from '@/assets/effect-family-icons/flame-outline.svg';
import flameSolid from '@/assets/effect-family-icons/flame-solid.svg';
import mineGradient from '@/assets/effect-family-icons/mine-gradient.svg';

import type { Effect } from '@/data/effectLibrary';

export interface FamilyIconSet {
  solid: string;
  gradient: string;
  outline: string;
}

const CAKE: FamilyIconSet = { solid: cakeSolid, gradient: cakeGradient, outline: cakeOutline };
const COMET: FamilyIconSet = { solid: cometSolid, gradient: cometGradient, outline: cometOutline };
const FLAME: FamilyIconSet = { solid: flameSolid, gradient: flameGradient, outline: flameOutline };
// Mine: only gradient was provided — reuse it for solid/outline.
const MINE: FamilyIconSet = { solid: mineGradient, gradient: mineGradient, outline: mineGradient };

/** partType → icon set. Returns null when no custom family icon exists. */
export function familyIconsForPart(part: string | undefined | null): FamilyIconSet | null {
  switch (part) {
    case 'cake':
      return CAKE;
    case 'comet':
      return COMET;
    case 'mine':
      return MINE;
    case 'gerb':
    case 'flame':
    case 'fountain':
    case 'waterfall':
      return FLAME;
    default:
      return null;
  }
}

/** Resolve an Effect → family icon set (using partType, falling back to category). */
export function familyIconsForEffect(effect: Effect): FamilyIconSet | null {
  const direct = familyIconsForPart(effect.partType);
  if (direct) return direct;
  switch (effect.category) {
    case 'cakes_batteries':
      return CAKE;
    case 'mines':
      return MINE;
    case 'waterfalls':
      return FLAME;
    default:
      return null;
  }
}
