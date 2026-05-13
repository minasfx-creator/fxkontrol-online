/**
 * ─── FWsim Effect Category Icon ───────────────────────────────────
 * Resolves an `Effect.partType` (or category fallback) to one of the
 * 27 SVG icons from the FWsim Pro vector pack.
 *
 * Each family ships in 3 detail tiers (`_01` largest / detailed,
 * `_02` medium, `_03` small / glyph). Pick the tier with `tier`
 * prop based on the surface where it renders:
 *   - card thumbs   → 'large'   (_01)
 *   - timeline cue  → 'medium'  (_02)
 *   - dense rows    → 'small'   (_03)
 *
 * Returns `null` for partTypes without a dedicated FWsim glyph
 * (drone, laser, light, formation) — callers fall back to lucide
 * icons or color swatch.
 */
import type { Effect, PartType } from '@/data/effectLibrary';

import Cake01 from '@/assets/fwsim-effect-icons/Cake_01.svg';
import Cake02 from '@/assets/fwsim-effect-icons/Cake_02.svg';
import Cake03 from '@/assets/fwsim-effect-icons/Cake_03.svg';
import Comet01 from '@/assets/fwsim-effect-icons/Comet_01.svg';
import Comet02 from '@/assets/fwsim-effect-icons/Comet_02.svg';
import Comet03 from '@/assets/fwsim-effect-icons/Comet_03.svg';
import Mine01 from '@/assets/fwsim-effect-icons/Mine_01.svg';
import Mine02 from '@/assets/fwsim-effect-icons/Mine_02.svg';
import Mine03 from '@/assets/fwsim-effect-icons/Mine_03.svg';
import Other01 from '@/assets/fwsim-effect-icons/Other_01.svg';
import Other02 from '@/assets/fwsim-effect-icons/Other_02.svg';
import Other03 from '@/assets/fwsim-effect-icons/Other_03.svg';
import Rocket01 from '@/assets/fwsim-effect-icons/Rocket_01.svg';
import Rocket02 from '@/assets/fwsim-effect-icons/Rocket_02.svg';
import Rocket03 from '@/assets/fwsim-effect-icons/Rocket_03.svg';
import RC01 from '@/assets/fwsim-effect-icons/RomanCandle_01.svg';
import RC02 from '@/assets/fwsim-effect-icons/RomanCandle_02.svg';
import RC03 from '@/assets/fwsim-effect-icons/RomanCandle_03.svg';
import FP01 from '@/assets/fwsim-effect-icons/FeuerProjektor_01.svg';
import FP02 from '@/assets/fwsim-effect-icons/FeuerProjektor_02.svg';
import FP03 from '@/assets/fwsim-effect-icons/FeuerProjektor_03.svg';

type Family = 'cake' | 'comet' | 'mine' | 'rocket' | 'roman_candle' | 'flame' | 'other';
type Tier = 'small' | 'medium' | 'large';

const ICONS: Record<Family, Record<Tier, string>> = {
  cake: { large: Cake01, medium: Cake02, small: Cake03 },
  comet: { large: Comet01, medium: Comet02, small: Comet03 },
  mine: { large: Mine01, medium: Mine02, small: Mine03 },
  rocket: { large: Rocket01, medium: Rocket02, small: Rocket03 },
  roman_candle: { large: RC01, medium: RC02, small: RC03 },
  flame: { large: FP01, medium: FP02, small: FP03 },
  other: { large: Other01, medium: Other02, small: Other03 },
};

function familyFromEffect(e: Effect): Family | null {
  const part: PartType | undefined = e.partType;
  if (part === 'cake') return 'cake';
  if (part === 'mine') return 'mine';
  if (part === 'comet') return 'comet';
  if (part === 'rocket') return 'rocket';
  if (part === 'candle') return 'roman_candle';
  if (part === 'gerb' || part === 'fountain' || part === 'flame' || part === 'waterfall') return 'flame';
  if (e.category === 'cakes_batteries') return 'cake';
  if (e.category === 'mines') return 'mine';
  if (e.category === 'roman_candles') return 'roman_candle';
  if (e.category === 'sfx' || e.category === 'waterfalls') return 'flame';
  if (e.category === 'morteiros' || e.category === 'peonias') return 'other';
  return null;
}

export interface EffectCategoryIconProps {
  effect: Effect;
  tier?: Tier;
  className?: string;
  alt?: string;
}

export function EffectCategoryIcon({
  effect,
  tier = 'medium',
  className,
  alt,
}: EffectCategoryIconProps) {
  const fam = familyFromEffect(effect);
  if (!fam) return null;
  const src = ICONS[fam][tier];
  return (
    <img
      src={src}
      alt={alt ?? `${fam} icon`}
      className={className}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}

/** Programmatic accessor for non-React surfaces (canvas overlays etc.). */
export function effectCategoryIconUrl(effect: Effect, tier: Tier = 'medium'): string | null {
  const fam = familyFromEffect(effect);
  return fam ? ICONS[fam][tier] : null;
}
