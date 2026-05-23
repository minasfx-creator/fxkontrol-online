/**
 * ─── Finale Shell Preset → Effect adapter ───────────────────────────
 * Surfaces the canonical FWsim Pro shell presets (rev1..rev6) as
 * `Effect` entries so they appear in the EffectLibrary sidebar and
 * are searchable / selectable.
 *
 * The label of each Effect is the preset's canonical label, which is
 * what `resolveShellPresetId` matches on — so dropping one of these
 * onto the timeline produces the LED-accurate burst in the renderer
 * without any extra wiring.
 *
 * Stable ids: `finale-shell-<presetId>` (so projects referencing
 * these effects survive library refactors).
 */

import type { Effect } from '@/data/effectLibrary';
import { FINALE_SHELL_PRESETS, type ShellPreset } from '@/data/finalePresets';

/** Sensible caliber default per geometry — only used for UI hints. */
function defaultCaliber(p: ShellPreset): number {
  switch (p.geometry) {
    case 'custom-shape':
    case 'heart':
      return 5;
    case 'inverted-hemisphere':
    case 'hemisphere':
      return 4;
    case 'ring':
      return p.id === 'saturn-ring' ? 6 : 4;
    default:
      return 5;
  }
}

/** Map the burst pattern to a representative emoji. */
function iconFor(p: ShellPreset): string {
  switch (p.id) {
    case 'ring':
    case 'double-ring':
      return '⭕';
    case 'saturn-ring':
      return '🪐';
    case 'heart':
      return '❤️';
    case 'smiley':
      return '🙂';
    case 'bow-tie':
      return '🎀';
    case 'cluster-diadem':
      return '👑';
    case 'jellyfish':
      return '🪼';
    case 'half-half':
      return '◐';
    default:
      return '💥';
  }
}

/** Build a stable Effect from a ShellPreset. */
export function finaleShellPresetToEffect(p: ShellPreset): Effect {
  const caliber = defaultCaliber(p);
  // Duration ≈ longest star lifetime + small tail/decay margin.
  const duration = Math.max(1.0, p.lifeMax + 0.5);
  return {
    id: `finale-shell-${p.id}`,
    name: p.label,
    category: 'morteiros',
    type: 'firework',
    color: p.colorHex === '#000000' ? '#FFE2AE' /* visible swatch for invisible body */ : p.colorHex,
    duration,
    cost: 18 + caliber * 4,
    icon: iconFor(p),
    partType: 'shell',
    caliber,
    heightMeters: 60 + caliber * 15,
    prefire: Math.max(1.0, caliber * 0.5),
    pattern: p.pattern,
    safetyDistance: caliber * 25,
    secondaryColor: p.secondaryColorHex,
  };
}

/** Static array of every Finale shell preset as an Effect, in registry order. */
export const FINALE_SHELL_PRESET_EFFECTS: Effect[] = Object.values(FINALE_SHELL_PRESETS).map(
  finaleShellPresetToEffect,
);

/** Subset: rev6 pattern shells only (ring family, heart, smiley, bow-tie, …). */
export const FINALE_REV6_SHELL_PRESET_IDS = [
  'ring',
  'double-ring',
  'saturn-ring',
  'heart',
  'smiley',
  'bow-tie',
  'cluster-diadem',
  'jellyfish',
  'half-half',
] as const;

export const FINALE_REV6_SHELL_EFFECTS: Effect[] = FINALE_REV6_SHELL_PRESET_IDS
  .map((id) => FINALE_SHELL_PRESETS[id])
  .filter((p): p is ShellPreset => Boolean(p))
  .map(finaleShellPresetToEffect);
