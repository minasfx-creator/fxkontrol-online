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
};

// ────────────────────────────────────────────────────────────────────
// VDL / effect-name → presetId resolver
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
