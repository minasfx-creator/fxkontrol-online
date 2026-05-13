/**
 * Canonical Finale/FWsim Pro presets — extracted from real .fwe XML payloads.
 *
 * Source files (uploaded reference, FWsim Pro 4.x):
 *   01_Peony.fwe, 02_Peony_w_Pistil.fwe, 03_Wave.fwe, 04_Chrysanthemum.fwe,
 *   05_Dahlia.fwe, 06_Palm.fwe, 07_Crown.fwe
 *
 * Numbers below mirror the XML 1:1 — do NOT round or "improve" without a new
 * FWE capture. The renderer (`ShellBurstRenderer`) consumes the resolved
 * subset via `resolveShellPresetProps()`.
 *
 * IMPORTANT — separation of concerns:
 *   - This file is pure data (no React, no Three.js).
 *   - Mine and Comet preset tables (rev2/rev3) are intentionally NOT included
 *     in this turn — only the 7 shells the user just uploaded. Those will be
 *     appended in a follow-up rev once their renderers (MineEffect/CometEffect)
 *     are wired to consume `presetId`.
 */

import type { BurstPattern } from '@/lib/pyroPhysics';

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

export type FinalePresetKind = 'shell' | 'mine' | 'comet';

export interface TailLayer {
  /** FWsim StarTails.Density — emission rate (sparks/s along the trail) */
  densityHz: number;
  width: number;
  /** FWsim StarTails.Life (seconds) */
  lifeS: number;
  lifeSigma: number;
  sizeFactor: number;
  /** Hex string, e.g. '#FFE2AE'. Honors VDL palette downstream. */
  colorHex: string;
  strobeHz?: number;
  emitStart: number;
  emitEnd: number;
  /** FWsim FadeRatios A/B/C/D as [A,B,C,D]. */
  fadeABCD: [number, number, number, number];
  crackle?: boolean;
}

export type ShellGeometry =
  | 'sphere'
  | 'ring'
  | 'palm-semi'
  | 'crown-asym'
  | 'quarter-sphere';

export type ShellStarType = 'XXSmall' | 'XSmall' | 'Normal' | 'Small' | 'Large';

export interface ShellPreset {
  /** Stable identifier — used as `presetId` prop. */
  id: string;
  /** Human label (matches the source FWE file). */
  label: string;
  /** Maps to existing `BurstPattern` in pyroPhysics for distribution math. */
  pattern: BurstPattern;
  geometry: ShellGeometry;
  /** Stars.Count — exact value from XML. */
  count: number;
  /** Stars.SphericalDistribution.Speed (m/s in FWsim units). */
  speedMS: number;
  /** Stars.SphericalDistribution.Sigma (radians). */
  sigmaRad: number;
  starType: ShellStarType;
  /** Stars.Mass (FWsim units). */
  mass: number;
  /** Stars.MinimumLifetime / MaximumLifetime (seconds). */
  lifeMin: number;
  lifeMax: number;
  /** Stars.FadeRatios as [A,B,C,D]. */
  fadeABCD: [number, number, number, number];
  /** Default body color (hex). The renderer/VDL pipeline may override. */
  colorHex: string;
  /** Optional secondary color (e.g. peony→pistil shell core). */
  secondaryColorHex?: string;
  /** Optional inner pistil sub-burst. */
  pistil?: {
    count: number;
    speedMS: number;
    colorHex: string;
  };
  /** Optional StarTails layers (Wave/Chrysanthemum/Palm/Crown). */
  tails?: TailLayer[];
}

// ────────────────────────────────────────────────────────────────────
// Canonical data — extracted from the 7 uploaded FWE files
// ────────────────────────────────────────────────────────────────────

export const FINALE_SHELL_PRESETS: Record<string, ShellPreset> = {
  // 01_Peony.fwe
  peony: {
    id: 'peony',
    label: 'Peony (Red)',
    pattern: 'peony',
    geometry: 'sphere',
    count: 110,
    speedMS: 0.8,
    sigmaRad: 0.017,
    starType: 'XXSmall',
    mass: 0.7,
    lifeMin: 1.2,
    lifeMax: 1.6,
    fadeABCD: [0.07736944, 0.41967872, 0.8914432, 0.99598396],
    colorHex: '#FF2A2A', // FWsim "Red"
  },

  // 02_Peony_w_Pistil.fwe
  'peony-pistil': {
    id: 'peony-pistil',
    label: 'Peony with Pistil (Orange + White core)',
    pattern: 'peony',
    geometry: 'sphere',
    count: 110,
    speedMS: 0.8,
    sigmaRad: 0.017,
    starType: 'XXSmall',
    mass: 0.7,
    lifeMin: 1.2,
    lifeMax: 1.6,
    fadeABCD: [0.07736944, 0.41967872, 0.8914432, 0.99598396],
    colorHex: '#FF7A00', // outer Orange
    pistil: {
      count: 28, // ~25% of outer (FWsim convention)
      speedMS: 0.3,
      colorHex: '#FFFFFF',
    },
  },

  // 03_Wave.fwe — ring with silver spark tail
  wave: {
    id: 'wave',
    label: 'Wave (ring + silver sparks)',
    pattern: 'ring',
    geometry: 'ring',
    count: 80,
    speedMS: 0.7,
    sigmaRad: 0.05,
    starType: 'XSmall',
    mass: 0.6,
    lifeMin: 0.8,
    lifeMax: 1.2,
    fadeABCD: [0, 0.12403101, 0.63, 1],
    colorHex: '#C8C8D0', // FWsim "Spark" (silver)
    tails: [
      {
        densityHz: 250,
        width: 0.6,
        lifeS: 0.05,
        lifeSigma: 0.1,
        sizeFactor: 0.8,
        colorHex: '#C8C8D0',
        strobeHz: 2.7017698,
        emitStart: 0.05,
        emitEnd: 1,
        fadeABCD: [0, 0.12403101, 0.63, 1],
      },
    ],
  },

  // 04_Chrysanthemum.fwe — Brocade #2 dual-tail
  chrysanthemum: {
    id: 'chrysanthemum',
    label: 'Chrysanthemum (Brocade gold)',
    pattern: 'chrysanthemum',
    geometry: 'sphere',
    count: 120,
    speedMS: 0.9,
    sigmaRad: 0.025,
    starType: 'XSmall',
    mass: 0.6,
    lifeMin: 1.5,
    lifeMax: 2.0,
    fadeABCD: [0.4649123, 0.7130351, 0.7140351, 1],
    colorHex: '#331A00', // FWsim Custom (51,26,0) brocade gold
    tails: [
      {
        densityHz: 250,
        width: 0.4,
        lifeS: 2.6,
        lifeSigma: 2.0,
        sizeFactor: 0.25,
        colorHex: '#331A00',
        emitStart: 0.05,
        emitEnd: 1,
        fadeABCD: [0.4649123, 0.7130351, 0.7140351, 1],
      },
      {
        densityHz: 40,
        width: 0.3,
        lifeS: 0.3,
        lifeSigma: 0.1,
        sizeFactor: 0.6,
        colorHex: '#FEB000', // FWsim Custom (254,176,0) amber tip
        emitStart: 0.05,
        emitEnd: 1,
        fadeABCD: [0.4649123, 0.7130351, 0.7140351, 1],
      },
    ],
  },

  // 05_Dahlia.fwe — sparse Normal stars, soft pink
  dahlia: {
    id: 'dahlia',
    label: 'Dahlia (Light Pink)',
    pattern: 'dahlia',
    geometry: 'sphere',
    count: 20,
    speedMS: 0.6,
    sigmaRad: 0.024,
    starType: 'Normal',
    mass: 0.8,
    lifeMin: 2.0,
    lifeMax: 2.5,
    fadeABCD: [0.06382979, 0.49709865, 0.8239845, 0.999],
    colorHex: '#FFB6C1', // FWsim "LightPink"
  },

  // 06_Palm.fwe — semi-hemisphere with Gold #2 trunk
  palm: {
    id: 'palm',
    label: 'Palm (Gold trunk + fronds)',
    pattern: 'palm',
    geometry: 'palm-semi',
    count: 30,
    speedMS: 1.0,
    sigmaRad: 0.05,
    starType: 'Normal',
    mass: 1.0,
    lifeMin: 1.6,
    lifeMax: 2.2,
    fadeABCD: [0.14677104, 0.852229, 0.853229, 1],
    colorHex: '#FFE2AE', // FWsim Custom (255,226,174) warm gold
    tails: [
      {
        densityHz: 400,
        width: 0.6,
        lifeS: 0.8,
        lifeSigma: 0.15,
        sizeFactor: 0.5,
        colorHex: '#FFE2AE',
        strobeHz: 2.7017698,
        emitStart: 0.15,
        emitEnd: 1,
        fadeABCD: [0.14677104, 0.852229, 0.853229, 1],
      },
      {
        densityHz: 100,
        width: 0.4,
        lifeS: 0.5,
        lifeSigma: 0.12,
        sizeFactor: 0.5,
        colorHex: '#FFE2AE',
        emitStart: 0.15,
        emitEnd: 1,
        fadeABCD: [0.14677104, 0.852229, 0.853229, 1],
      },
    ],
  },

  // 07_Crown.fwe — asymmetric crown with ferrotitanium tail
  crown: {
    id: 'crown',
    label: 'Crown (Gold Ferrotitanium)',
    pattern: 'brocade_crown',
    geometry: 'crown-asym',
    count: 40,
    speedMS: 1.1,
    sigmaRad: 0.04,
    starType: 'Small',
    mass: 0.7,
    lifeMin: 1.4,
    lifeMax: 1.8,
    fadeABCD: [0.17829457, 0.7800078, 0.78100777, 1],
    colorHex: '#78461D', // FWsim Custom (120,70,29) ferrotitanium body
    tails: [
      {
        densityHz: 400,
        width: 0.5,
        lifeS: 0.3,
        lifeSigma: 0.14,
        sizeFactor: 0.5,
        colorHex: '#78461D',
        strobeHz: 2.7017698,
        emitStart: 0.15,
        emitEnd: 0.9,
        fadeABCD: [0.17829457, 0.7800078, 0.78100777, 1],
      },
      {
        densityHz: 200,
        width: 0.1,
        lifeS: 0.3,
        lifeSigma: 0.1,
        sizeFactor: 0.4,
        colorHex: '#5A3415', // (90,…) ferrotitanium spark
        emitStart: 0.15,
        emitEnd: 1,
        fadeABCD: [0.17829457, 0.7800078, 0.78100777, 1],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // rev5 additions — Quarter-sphere + Ghost + Hybrid shells
  // Source: 34_4-4.fwe / 34a_Ghost_Shell.fwe / 35_Hybrids_Special.fwe
  // ──────────────────────────────────────────────────────────────────

  // 34_4-4.fwe — quarter-sphere ranged volley (4 layered Stars all identical
  // distribution; we capture the canonical primary).
  'quarter-4-4': {
    id: 'quarter-4-4',
    label: 'Quarter Shell 4-4 (Red)',
    pattern: 'peony',
    geometry: 'quarter-sphere',
    count: 60,
    speedMS: 0.9,
    sigmaRad: 0,
    starType: 'XXSmall',
    mass: 0.7,
    lifeMin: 1.2,
    lifeMax: 1.6,
    fadeABCD: [0.06393862, 0.32352942, 0.7811245, 0.99598396],
    colorHex: '#FF2A2A',
  },

  // 34a_Ghost_Shell.fwe — dense spherical primary + Gold Sparks dual tail.
  // (Layered "ghost" sub-shells captured as primary only; tails reproduce
  // the canonical [none] Gold Sparks insert.)
  'ghost-shell': {
    id: 'ghost-shell',
    label: 'Ghost Shell (Red + Gold ghost trail)',
    pattern: 'peony',
    geometry: 'sphere',
    count: 240,
    speedMS: 0.8,
    sigmaRad: 0,
    starType: 'Normal',
    mass: 1.0,
    lifeMin: 1.0,
    lifeMax: 1.2,
    fadeABCD: [0.07736944, 0.47557002, 0.78013027, 0.999],
    colorHex: '#FF2A2A',
    tails: [
      {
        densityHz: 200,
        width: 2,
        lifeS: 0.1,
        lifeSigma: 0.2,
        sizeFactor: 0.3,
        colorHex: '#3C1E00', // Custom (60,30,0)
        emitStart: 0.05,
        emitEnd: 1,
        fadeABCD: [0, 0.77954143, 0.86243385, 1],
      },
      {
        densityHz: 100,
        width: 0.4,
        lifeS: 0.32,
        lifeSigma: 0.1,
        sizeFactor: 0.5,
        colorHex: '#532900', // Custom (83,41,0)
        emitStart: 0.05,
        emitEnd: 0.8,
        fadeABCD: [0, 0.34917733, 0.63, 1],
      },
    ],
  },

  // 35_Hybrids_Special.fwe — orange spark cloud + multi-layer ring trails.
  // (Canonical primary; ring sub-burst not stored separately in this rev.)
  'hybrid-special': {
    id: 'hybrid-special',
    label: 'Hybrids Special (Orange + ring trails)',
    pattern: 'chrysanthemum',
    geometry: 'sphere',
    count: 150,
    speedMS: 1.0,
    sigmaRad: 0.02,
    starType: 'XSmall',
    mass: 0.5,
    lifeMin: 2.0,
    lifeMax: 3.5,
    fadeABCD: [0.25081432, 0.747557, 0.748557, 1],
    colorHex: '#FF7A00',
    tails: [
      {
        densityHz: 200,
        width: 2,
        lifeS: 0.1,
        lifeSigma: 0.2,
        sizeFactor: 0.3,
        colorHex: '#3C1E00',
        emitStart: 0.05,
        emitEnd: 1,
        fadeABCD: [0, 0.77954143, 0.86243385, 1],
      },
      {
        densityHz: 100,
        width: 0.4,
        lifeS: 0.32,
        lifeSigma: 0.1,
        sizeFactor: 0.5,
        colorHex: '#532900',
        emitStart: 0.05,
        emitEnd: 0.8,
        fadeABCD: [0, 0.34917733, 0.63, 1],
      },
    ],
  },
};

// ────────────────────────────────────────────────────────────────────
// rev5 — Mine presets (single-shot Mine node)
// Source: 40_Single_Shot_Mine.fwe / 41_Single_Shot_Comet.fwe /
//         42_Single_Shot_Comet_Mine.fwe
// ────────────────────────────────────────────────────────────────────

export interface MinePreset {
  id: string;
  label: string;
  /** MineDistribution.Speed (m/s) */
  speedMS: number;
  /** MineDistribution.Sigma (radians) */
  sigmaRad: number;
  /** Stars.Count — `1` for single comet head, larger for mine fan. */
  count: number;
  starType: ShellStarType;
  mass: number;
  lifeMin: number;
  lifeMax: number;
  fadeABCD: [number, number, number, number];
  colorHex: string;
  /** All FWsim StarTails inserts (in source order). */
  tails: TailLayer[];
}

export const FINALE_MINE_PRESETS: Record<string, MinePreset> = {
  // 40_Single_Shot_Mine.fwe — Gold Glitter #3, 25-star fan, 29.4 Hz strobe
  'single-mine-gold-glitter': {
    id: 'single-mine-gold-glitter',
    label: 'Single Mine — Gold Glitter',
    speedMS: 1.0,
    sigmaRad: 0.045,
    count: 25,
    starType: 'XSmall',
    mass: 0.5,
    lifeMin: 1.3,
    lifeMax: 2.5,
    fadeABCD: [0.19535783, 0.549323, 0.8471954, 0.999],
    colorHex: '#A8FFB0', // PastelGreen body
    tails: [
      {
        densityHz: 5,
        width: 1,
        lifeS: 1.34,
        lifeSigma: 0.89,
        sizeFactor: 0.5,
        colorHex: '#FEE0B8',
        strobeHz: 29.405308,
        emitStart: 0.15,
        emitEnd: 0.566,
        fadeABCD: [0.3360161, 0.7434668, 0.90744466, 1],
      },
      {
        densityHz: 20,
        width: 1,
        lifeS: 0.21,
        lifeSigma: 1.96,
        sizeFactor: 0.35,
        colorHex: '#FED9A7',
        strobeHz: 32.358406,
        emitStart: 0.15,
        emitEnd: 1,
        fadeABCD: [0.3863179, 0.74547887, 0.82696176, 1],
      },
    ],
  },

  // 41_Single_Shot_Comet.fwe — Silver Glitter #4, single Large head, strobe 7.92Hz
  'single-comet-silver-glitter': {
    id: 'single-comet-silver-glitter',
    label: 'Single Comet — Silver Glitter',
    speedMS: 1.05,
    sigmaRad: 0,
    count: 1,
    starType: 'Large',
    mass: 0.75,
    lifeMin: 2.0,
    lifeMax: 3.0,
    fadeABCD: [0.01934236, 0.43811074, 0.9136808, 0.999],
    colorHex: '#FFFFFF',
    tails: [
      {
        densityHz: 17,
        width: 0.5,
        lifeS: 0.76,
        lifeSigma: 0.68,
        sizeFactor: 0.5974,
        colorHex: '#FFFFFF',
        strobeHz: 7.916814,
        emitStart: 0.05,
        emitEnd: 0.7,
        fadeABCD: [0.33641404, 0.5693161, 0.63, 1],
      },
      {
        densityHz: 200,
        width: 0.5,
        lifeS: 1.2,
        lifeSigma: 0.5,
        sizeFactor: 0.5,
        colorHex: '#48230D',
        emitStart: 0.05,
        emitEnd: 1,
        fadeABCD: [0.2660754, 0.5609756, 0.63, 1],
      },
    ],
  },

  // 42_Single_Shot_Comet_Mine.fwe — deep gold (149,74,0), no strobe on primary tail
  'single-comet-mine-gold': {
    id: 'single-comet-mine-gold',
    label: 'Single Comet/Mine — Deep Gold',
    speedMS: 1.05,
    sigmaRad: 0,
    count: 1,
    starType: 'Large',
    mass: 0.75,
    lifeMin: 2.0,
    lifeMax: 3.0,
    fadeABCD: [0.01934236, 0.43811074, 0.9136808, 0.999],
    colorHex: '#A8FFB0',
    tails: [
      {
        densityHz: 9,
        width: 0.3,
        lifeS: 0.21,
        lifeSigma: 1.14,
        sizeFactor: 0.3,
        colorHex: '#954A00',
        emitStart: 0.05,
        emitEnd: 1,
        fadeABCD: [0.2987013, 0.78564197, 0.78664196, 1],
      },
      {
        densityHz: 9,
        width: 0.3,
        lifeS: 0.21,
        lifeSigma: 0.78,
        sizeFactor: 0.6,
        colorHex: '#954A00',
        emitStart: 0.05,
        emitEnd: 1,
        fadeABCD: [0.29313543, 0.77079964, 0.7717996, 1],
      },
    ],
  },
};

// ────────────────────────────────────────────────────────────────────
// rev5 — Cake-shot presets (Cake > Shell single-shot wrappers)
// Source: 43_Single_Shot_Shell.fwe / 44_Single_Shot_Mine_Shell.fwe /
//         45_Single_Shot_Hybrids_Special.fwe
//
// All three captured wrap a Shell (not a Mine). The inner Stars are
// recorded canonically; full body of the cake (delays, count of shots,
// tube layout) is left for the Cake-renderer rev to consume.
// ────────────────────────────────────────────────────────────────────

export interface CakeShotPreset {
  id: string;
  label: string;
  /** What the Cake encloses. Both observed = 'shell' so far. */
  wrappedKind: 'shell' | 'mine';
  /** Inner Shell parameters (1:1 with FWsim XML). */
  inner: {
    count: number;
    speedMS: number;
    sigmaRad: number;
    starType: ShellStarType;
    mass: number;
    lifeMin: number;
    lifeMax: number;
    fadeABCD: [number, number, number, number];
    colorHex: string;
  };
  /** Optional tail summary (first canonical insert). */
  tail?: TailLayer;
}

export const FINALE_CAKE_SHOT_PRESETS: Record<string, CakeShotPreset> = {
  // 43_Single_Shot_Shell.fwe — Silver Titanium, sparse Small/Red shell
  'cake-shell-silver-titanium': {
    id: 'cake-shell-silver-titanium',
    label: 'Cake Shot — Silver Titanium Shell',
    wrappedKind: 'shell',
    inner: {
      count: 3,
      speedMS: 1,
      sigmaRad: 0.14,
      starType: 'Small',
      mass: 0.8,
      lifeMin: 1.0,
      lifeMax: 2.1,
      fadeABCD: [0.09, 0.22, 0.488, 0.756],
      colorHex: '#FF2A2A',
    },
    tail: {
      densityHz: 250,
      width: 0.8,
      lifeS: 0.7,
      lifeSigma: 0.2,
      sizeFactor: 0.5,
      colorHex: '#C8C8D0', // Spark
      emitStart: 0.05,
      emitEnd: 1,
      fadeABCD: [0, 0, 0.44726562, 1],
    },
  },

  // 44_Single_Shot_Mine_Shell.fwe — Gold Sparks #3 wrapper, dense XSmall body
  'cake-mine-shell-gold': {
    id: 'cake-mine-shell-gold',
    label: 'Cake Shot — Mine→Shell Gold',
    wrappedKind: 'shell',
    inner: {
      count: 69,
      speedMS: 0.8,
      sigmaRad: 0.14,
      starType: 'XSmall',
      mass: 0.5,
      lifeMin: 0.5,
      lifeMax: 1.0,
      fadeABCD: [0.20696326, 0.5377176, 0.8115942, 0.999],
      colorHex: '#A8FFB0',
    },
    tail: {
      densityHz: 9,
      width: 0.3,
      lifeS: 0.21,
      lifeSigma: 1.14,
      sizeFactor: 0.3,
      colorHex: '#954A00',
      emitStart: 0.05,
      emitEnd: 1,
      fadeABCD: [0.2987013, 0.78564197, 0.78664196, 1],
    },
  },

  // 45_Single_Shot_Hybrids_Special.fwe — Coal Gold #2, XXSmall sparse Red
  'cake-hybrid-coal-gold': {
    id: 'cake-hybrid-coal-gold',
    label: 'Cake Shot — Hybrid Coal Gold',
    wrappedKind: 'shell',
    inner: {
      count: 40,
      speedMS: 0.8,
      sigmaRad: 0.14,
      starType: 'XXSmall',
      mass: 0.8,
      lifeMin: 1.0,
      lifeMax: 1.8,
      fadeABCD: [0.176, 0.508, 0.944, 1],
      colorHex: '#FF2A2A',
    },
    tail: {
      densityHz: 300,
      width: 0.3,
      lifeS: 0.6,
      lifeSigma: 0.7,
      sizeFactor: 0.3,
      colorHex: '#371C00', // Custom (55,28,0)
      emitStart: 0.05,
      emitEnd: 1,
      fadeABCD: [0, 0.5001338, 0.5011338, 1],
    },
  },
};
// ────────────────────────────────────────────────────────────────────

/**
 * Map a free-text VDL/effect name to a canonical shell preset id.
 * Returns `undefined` when no match is found — caller should fall back
 * to its existing heuristic (zero regression for un-catalogued effects).
 */
export function resolveShellPresetId(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase().trim();

  // Order matters: more specific keys first.
  if (/(peony).*(pistil|pist[ií]lo|core)|pistil.*(peony)/.test(s)) return 'peony-pistil';
  if (/\bpeony\b/.test(s)) return 'peony';
  if (/\b(wave|ring)\b/.test(s)) return 'wave';
  if (/(chrysanthemum|brocade|kamuro)/.test(s)) return 'chrysanthemum';
  if (/\bdahlia\b/.test(s)) return 'dahlia';
  if (/\bpalm\b/.test(s)) return 'palm';
  if (/\b(crown|ferrotitanium)\b/.test(s)) return 'crown';
  if (/\bghost\b/.test(s)) return 'ghost-shell';
  if (/\bhybrid(s)?\b/.test(s)) return 'hybrid-special';
  if (/\b(quarter|quarter[-_ ]?shell|4[-_ ]?4)\b/.test(s)) return 'quarter-4-4';

  return undefined;
}

/**
 * Map a free-text name → canonical Mine preset id.
 */
export function resolveMinePresetId(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase().trim();
  if (/(comet).*(silver|white)|silver.*comet/.test(s)) return 'single-comet-silver-glitter';
  if (/(comet).*(gold|deep)|comet.?mine|comet[-_/ ]mine/.test(s)) return 'single-comet-mine-gold';
  if (/(mine).*(gold|glitter)|gold.*(glitter|mine)|\bglitter\b/.test(s)) return 'single-mine-gold-glitter';
  return undefined;
}

/**
 * Map a free-text name → canonical Cake-shot preset id.
 */
export function resolveCakeShotPresetId(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase().trim();
  if (/cake.*(silver|titanium)|silver.*titanium/.test(s)) return 'cake-shell-silver-titanium';
  if (/cake.*(mine.*shell|mine[-_ ]shell)/.test(s)) return 'cake-mine-shell-gold';
  if (/cake.*(hybrid|coal)/.test(s)) return 'cake-hybrid-coal-gold';
  return undefined;
}

// ────────────────────────────────────────────────────────────────────
// Adapter: ShellPreset → ShellBurstRenderer props subset
// ────────────────────────────────────────────────────────────────────

export interface ResolvedShellProps {
  pattern: BurstPattern;
  color: string;
  secondaryColor?: string;
  hasPistil: boolean;
  pistilColor?: string;
  /** Maps `pistil.colorHex` (kept separate so caller can override). */
  trailType: 'none' | 'comet' | 'glitter' | 'brocade' | 'charcoal' | 'smoke';
  /** Caller should compute caliber separately; we suggest a baseline. */
  caliberHint: number;
}

const TRAIL_HINT: Record<string, ResolvedShellProps['trailType']> = {
  peony: 'none',
  'peony-pistil': 'none',
  wave: 'glitter',
  chrysanthemum: 'brocade',
  dahlia: 'none',
  palm: 'charcoal',
  crown: 'charcoal',
};

const CALIBER_HINT: Record<string, number> = {
  peony: 4,
  'peony-pistil': 4,
  wave: 5,
  chrysanthemum: 6,
  dahlia: 4,
  palm: 8,
  crown: 8,
};

export function resolveShellPresetProps(presetId: string): ResolvedShellProps | undefined {
  const p = FINALE_SHELL_PRESETS[presetId];
  if (!p) return undefined;
  return {
    pattern: p.pattern,
    color: p.colorHex,
    secondaryColor: p.secondaryColorHex,
    hasPistil: !!p.pistil,
    pistilColor: p.pistil?.colorHex,
    trailType: TRAIL_HINT[presetId] ?? 'none',
    caliberHint: CALIBER_HINT[presetId] ?? 4,
  };
}

export function listShellPresetIds(): string[] {
  return Object.keys(FINALE_SHELL_PRESETS);
}

// ────────────────────────────────────────────────────────────────────
// rev5 — Mine / Cake-shot adapters + unified listing
// ────────────────────────────────────────────────────────────────────

export interface ResolvedMineProps {
  /** Body color (HEX). */
  color: string;
  /** Trail color of the canonical primary tail. */
  trailColor: string;
  /** Strobe rate of the primary tail (Hz), 0 = no strobe. */
  strobeHz: number;
  /** Speed (m/s) inherited from MineDistribution. */
  speedMS: number;
  /** Sigma (rad). */
  sigmaRad: number;
  /** True when this preset is a single-head comet (count=1, Large). */
  isSingleHead: boolean;
}

export function resolveMinePresetProps(presetId: string): ResolvedMineProps | undefined {
  const p = FINALE_MINE_PRESETS[presetId];
  if (!p) return undefined;
  const t0 = p.tails[0];
  return {
    color: p.colorHex,
    trailColor: t0?.colorHex ?? p.colorHex,
    strobeHz: t0?.strobeHz ?? 0,
    speedMS: p.speedMS,
    sigmaRad: p.sigmaRad,
    isSingleHead: p.count === 1 && p.starType === 'Large',
  };
}

export interface ResolvedCakeShotProps {
  wrappedKind: 'shell' | 'mine';
  innerColor: string;
  innerCount: number;
  innerSpeedMS: number;
  trailColor?: string;
  trailDensityHz?: number;
}

export function resolveCakeShotPresetProps(
  presetId: string
): ResolvedCakeShotProps | undefined {
  const p = FINALE_CAKE_SHOT_PRESETS[presetId];
  if (!p) return undefined;
  return {
    wrappedKind: p.wrappedKind,
    innerColor: p.inner.colorHex,
    innerCount: p.inner.count,
    innerSpeedMS: p.inner.speedMS,
    trailColor: p.tail?.colorHex,
    trailDensityHz: p.tail?.densityHz,
  };
}

export function listMinePresetIds(): string[] {
  return Object.keys(FINALE_MINE_PRESETS);
}

export function listCakeShotPresetIds(): string[] {
  return Object.keys(FINALE_CAKE_SHOT_PRESETS);
}

export function listAllPresetIds(): {
  shells: string[];
  mines: string[];
  cakes: string[];
} {
  return {
    shells: listShellPresetIds(),
    mines: listMinePresetIds(),
    cakes: listCakeShotPresetIds(),
  };
}
