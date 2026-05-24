/**
 * ─── FWsim Mine Catalog (9 uploaded .fwe) ────────────────────────
 * Refines `EFFECT_LIBRARY` mines using real Stars/Color/Count data
 * extracted from `public/finale-presets/mines/*.fwe` plus filename
 * semantic flags (color shift, silver tail, comet head).
 *
 * Provenance: `pilot` — primary/secondary colors and color-shift flag
 * come straight from the XML (`<Color>` / `<Color2>` on inner Stars);
 * caliber/height/prefire/duration are FWsim Mine defaults shared with
 * `fwsimBuiltinPresets.ts`.
 *
 * Stable ids: `fwe-mine-<slug>` so projects survive library refactors.
 */

import type { Effect } from '@/data/effectLibrary';

export interface FweMineCatalogEntry {
  id: string;
  fileName: string;
  displayName: string;
  primary: string;
  secondary?: string;
  /** colorShift: morph primary→secondary over particle lifetime. */
  colorShift: boolean;
  /** comet head: 1 dense central jet with elongated white spark tail. */
  cometHead: boolean;
  /** silver tail link: emphasise CustomTailsLink in renderer. */
  silverTail: boolean;
  /** Inner Stars count (largest phase) — drives particle density. */
  innerStarCount: number;
  /** FWsim Mine defaults (matches `fwsimBuiltinPresets.ts` heuristic). */
  caliberIn: number;
  heightMeters: number;
  prefire: number;
  duration: number;
}

/**
 * 9 catalog entries. Numbers below are EXTRACTED, not invented:
 *   - primary/secondary/innerStarCount: from XML
 *   - colorShift: filename "_to_" (XML ColorChanging is always false in these files)
 *   - cometHead / silverTail: filename
 *   - caliber/height/prefire/duration: FWsim Mine defaults
 */
export const FWE_MINE_CATALOG: FweMineCatalogEntry[] = [
  {
    id: 'fwe-mine-purple-comet-white-w-silver-tail',
    fileName: 'Mine_Purple_Comet_White_w_Silver_Tail.fwe',
    displayName: 'Mine — Purple Comet, White w/ Silver Tail',
    primary: '#A24BFF',
    secondary: '#FFFFFF',
    colorShift: false,
    cometHead: true,
    silverTail: true,
    innerStarCount: 60,
    caliberIn: 3,
    heightMeters: 38,
    prefire: 0.4,
    duration: 2.6,
  },
  {
    id: 'fwe-mine-purple-to-orange',
    fileName: 'Mine_Purple_to_Orange.fwe',
    displayName: 'Mine — Purple to Orange',
    primary: '#A24BFF',
    secondary: '#FF8A00',
    colorShift: true,
    cometHead: false,
    silverTail: false,
    innerStarCount: 50,
    caliberIn: 3,
    heightMeters: 35,
    prefire: 0.4,
    duration: 2.4,
  },
  {
    id: 'fwe-mine-red-to-green',
    fileName: 'Mine_Red_to_Green.fwe',
    displayName: 'Mine — Red to Green',
    primary: '#FF1A1A',
    secondary: '#00E676',
    colorShift: true,
    cometHead: false,
    silverTail: false,
    innerStarCount: 50,
    caliberIn: 3,
    heightMeters: 35,
    prefire: 0.4,
    duration: 2.4,
  },
  {
    id: 'fwe-mine-red-w-silver-tail-bright-thinned',
    fileName: 'Mine_Red_w_Silver_Tail_bright_thinned.fwe',
    displayName: 'Mine — Red w/ Silver Tail (bright, thinned)',
    primary: '#FF1A1A',
    colorShift: false,
    cometHead: false,
    silverTail: true,
    innerStarCount: 10,
    caliberIn: 3,
    heightMeters: 35,
    prefire: 0.4,
    duration: 2.4,
  },
  {
    id: 'fwe-mine-red-2',
    fileName: 'Mine_Red-2.fwe',
    displayName: 'Mine — Red (v2)',
    primary: '#FF1A1A',
    colorShift: false,
    cometHead: false,
    silverTail: false,
    innerStarCount: 50,
    caliberIn: 3,
    heightMeters: 35,
    prefire: 0.4,
    duration: 2.4,
  },
  {
    id: 'fwe-mine-silver',
    fileName: 'Mine_Silver.fwe',
    displayName: 'Mine — Silver',
    primary: '#E5E5E5',
    colorShift: false,
    cometHead: false,
    silverTail: false,
    innerStarCount: 25,
    caliberIn: 3,
    heightMeters: 35,
    prefire: 0.4,
    duration: 2.4,
  },
  {
    id: 'fwe-mine-white-w-silver-tail',
    fileName: 'Mine_White_w_Silver_Tail.fwe',
    displayName: 'Mine — White w/ Silver Tail',
    primary: '#FFFFFF',
    colorShift: false,
    cometHead: false,
    silverTail: true,
    innerStarCount: 20,
    caliberIn: 3,
    heightMeters: 35,
    prefire: 0.4,
    duration: 2.4,
  },
  {
    id: 'fwe-mine-yellow-to-purple',
    fileName: 'Mine_Yellow_to_Purple.fwe',
    displayName: 'Mine — Yellow to Purple',
    primary: '#FFD600',
    secondary: '#A24BFF',
    colorShift: true,
    cometHead: false,
    silverTail: false,
    innerStarCount: 50,
    caliberIn: 3,
    heightMeters: 35,
    prefire: 0.4,
    duration: 2.4,
  },
  {
    id: 'fwe-mine-yellow',
    fileName: 'Mine_Yellow.fwe',
    displayName: 'Mine — Yellow',
    primary: '#FFD600',
    colorShift: false,
    cometHead: false,
    silverTail: false,
    innerStarCount: 50,
    caliberIn: 3,
    heightMeters: 35,
    prefire: 0.4,
    duration: 2.4,
  },
];

/** Map a catalog entry → canonical `Effect`. */
export function fweMineToEffect(entry: FweMineCatalogEntry): Effect {
  const pattern = entry.cometHead
    ? 'mine_comet'
    : entry.colorShift
      ? 'mine_color_shift'
      : 'mine';
  return {
    id: entry.id,
    name: entry.displayName,
    category: 'mines',
    type: 'firework',
    color: entry.primary,
    secondaryColor: entry.secondary,
    duration: entry.duration,
    cost: Math.max(14, Math.round(entry.duration * 4 + entry.caliberIn * 5)),
    icon: entry.cometHead ? '☄️' : entry.silverTail ? '✨' : '🔥',
    partType: 'mine',
    caliber: entry.caliberIn,
    heightMeters: entry.heightMeters,
    prefire: entry.prefire,
    pattern,
    safetyDistance: entry.caliberIn * 25,
    shotCount: entry.innerStarCount,
    impliesTrail: entry.silverTail || entry.cometHead,
    colorTransition: entry.colorShift ? `${entry.primary}→${entry.secondary ?? ''}` : undefined,
    finalePresetUrl: `/finale-presets/mines/${entry.fileName}`,
  };
}

/** Materialised Effect catalog (9 mines). */
export const FWE_MINE_EFFECTS: Effect[] = FWE_MINE_CATALOG.map(fweMineToEffect);
