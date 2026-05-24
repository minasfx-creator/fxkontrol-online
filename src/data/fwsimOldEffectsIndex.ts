/**
 * ─── FWsim "Old Effects" Legacy Index ─────────────────────────────
 * 229 effect names from the FWsim 2021-04 community catalog.
 *
 * **Claim: marketing_hypothesis** — These entries hold ONLY the
 * effect name, the provider tag (e.g. "LT"), and an inferred
 * category. There is NO particle data, no .fwe payload, no
 * timing curves — they are searchable inspiration tags, not
 * executable presets.
 *
 * Use cases:
 *   - Search-as-you-type suggestions when authoring (autocomplete)
 *   - "Find existing effect" lookup before building a new preset
 *   - Inventory cross-reference for showrunners migrating from FWsim
 *
 * Do NOT drop these on the timeline. They cannot fire, render, or
 * be exported. Promoting one to executable status requires a real
 * `.fwe` file or a hand-authored `Effect` entry with caliber + color
 * + duration + safetyDistance.
 */
import rawIndex from '@/data/fwsimOldEffectsIndex.json';

export interface FwsimOldEffectMeta {
  id: string;
  provider: string;
  name: string;
  category: string;
}

export const FWSIM_OLD_EFFECTS_INDEX: FwsimOldEffectMeta[] =
  rawIndex as FwsimOldEffectMeta[];

export const FWSIM_OLD_EFFECTS_COUNT = FWSIM_OLD_EFFECTS_INDEX.length;

/** Case-insensitive search across name + provider. */
export function searchFwsimOldEffects(
  query: string,
  limit = 50,
): FwsimOldEffectMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return FWSIM_OLD_EFFECTS_INDEX.slice(0, limit);
  const out: FwsimOldEffectMeta[] = [];
  for (const m of FWSIM_OLD_EFFECTS_INDEX) {
    if (m.name.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q)) {
      out.push(m);
      if (out.length >= limit) break;
    }
  }
  return out;
}
