/**
 * Finale .fwe enrichment overlay
 *
 * Applies the authoritative palette / shot-count / pattern aliases parsed from
 * the .fwe XML files (FINALE_PRESET_MAP) onto an Effect resolved from
 * EFFECT_LIBRARY at timeline-render time. Pure projection — no mutation,
 * no I/O, no side effects.
 *
 * Honesty: only fields actually present in the .fwe file overlay the library
 * defaults; missing fields fall through to the canonical EFFECT_LIBRARY value.
 */
import { FINALE_PRESET_MAP, type FinalePresetMeta } from './finalePresetMap';
import type { Effect } from './effectLibrary';

/**
 * Map of pattern names used in EFFECT_LIBRARY → canonical pattern keys
 * understood by FireworkRenderer. Only aliases for divergent spellings.
 */
const PATTERN_ALIASES: Record<string, string> = {
  multibreak: 'multi_break',
  multi_break: 'multi_break',
  dragonegg: 'dragon_egg',
  dragon_egg: 'dragon_egg',
  brocadecrown: 'brocade_crown',
  brocade_crown: 'brocade_crown',
  fallingleaves: 'falling_leaves',
  falling_leaves: 'falling_leaves',
};

export function normalizePattern(p: string | undefined | null): string | undefined {
  if (!p) return undefined;
  const key = p.toLowerCase();
  return PATTERN_ALIASES[key] ?? p;
}

export function getFinalePresetMeta(effectId: string): FinalePresetMeta | undefined {
  return FINALE_PRESET_MAP[effectId];
}

/**
 * Overlay .fwe metadata onto an Effect. Returns the original object reference
 * if no enrichment applies (zero-alloc fast path), otherwise a shallow clone
 * with overridden fields.
 */
export function enrichEffectFromFwe(effect: Effect): Effect {
  const meta = FINALE_PRESET_MAP[effect.id];
  const aliasedPattern = normalizePattern(effect.pattern);
  const patternChanged = aliasedPattern && aliasedPattern !== effect.pattern;

  if (!meta && !patternChanged) return effect;

  const next: Effect = { ...effect };

  if (patternChanged) {
    next.pattern = aliasedPattern as Effect['pattern'];
  }

  if (meta) {
    if (meta.primaryColor) next.color = meta.primaryColor;
    if (meta.secondaryColor && !effect.secondaryColor) {
      next.secondaryColor = meta.secondaryColor;
    }
    if (typeof meta.shotCount === 'number' && meta.shotCount > 0 && !effect.shotCount) {
      next.shotCount = meta.shotCount;
    }
  }

  return next;
}
