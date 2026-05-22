/**
 * ─── FWsim .fwe Uploaded Effects → Effect catalog ─────────────────
 * Authoritative metadata extracted from the 10 user-uploaded .fwe
 * (FWsim FireworkEffect XML) files. Each file is surfaced as an
 * `Effect` so it appears in the EffectLibrary sidebar and is
 * searchable / droppable on the timeline.
 *
 * The XML payload is NOT parsed at runtime — these are static,
 * curated entries. Source-of-truth fields (root xsi:type, dominant
 * color, advertised duration / shot count from the file name) are
 * encoded explicitly so the round-trip resolver remains pure.
 *
 * Stable ids: `fwe-<slug>` so projects survive library refactors.
 */

import type { Effect, PartType } from '@/data/effectLibrary';

/** Root <BaseEffectNode xsi:type=...> from the .fwe XML. */
export type FweRootKind = 'Cake' | 'Shell' | 'Mine';

export interface FweUploadedSpec {
  /** Source filename without extension. */
  fileName: string;
  /** Root xsi:type of the .fwe XML tree. */
  rootKind: FweRootKind;
  /** Canonical Effect category bucket. */
  category: 'morteiros' | 'mines' | 'peonias' | 'cakes_batteries';
  /** Mapped PartType for the renderer. */
  partType: PartType;
  /** Display name surfaced in the sidebar. */
  displayName: string;
  /** Dominant color as authored in the .fwe Stars/Tails Color block. */
  color: string;
  /** Optional secondary color (multi-phase shells / tipped comets). */
  secondaryColor?: string;
  /** Burst pattern hint for Show3D renderer. */
  pattern?: string;
  /** Duration in seconds (from filename or longest star lifetime). */
  duration: number;
  /** Caliber in inches (FWsim cake/shell convention). */
  caliber: number;
  /** Apex altitude in meters. */
  heightMeters: number;
  /** Pre-fire (lift charge → break) in seconds. */
  prefire: number;
  /** Cake shot count (only when rootKind='Cake'). */
  shotCount?: number;
  /** Mass-estimated cost (BoM). */
  cost: number;
  /** Emoji icon for sidebar swatch. */
  icon: string;
  /** True when StarTails imply a visible trail. */
  impliesTrail?: boolean;
}

/** Curated metadata for the 10 uploaded .fwe files. */
export const FWE_UPLOADED_SPECS: FweUploadedSpec[] = [
  // ── Cakes ──────────────────────────────────────────────────
  {
    fileName: 'Cake_Fan-Shape_Coal_Gold_to_Coal_Gold_Crown_Final_21_Shots_I_3s',
    rootKind: 'Cake',
    category: 'cakes_batteries',
    partType: 'cake',
    displayName: 'Fan Cake — Coal Gold → Coal Gold Crown (21 Shots / 3s)',
    color: '#B97A2A',
    secondaryColor: '#FFD27A',
    pattern: 'kamuro',
    duration: 3,
    caliber: 2,
    heightMeters: 45,
    prefire: 0.8,
    shotCount: 21,
    cost: 38,
    icon: '🎂',
    impliesTrail: true,
  },
  {
    fileName: 'Cake_Fan-Shape_Gold_Ti_Crowns_25_Shots_I_18s',
    rootKind: 'Cake',
    category: 'cakes_batteries',
    partType: 'cake',
    displayName: 'Fan Cake — Gold Ti Crowns (25 Shots / 18s)',
    color: '#FFD27A',
    secondaryColor: '#FFFFD0',
    pattern: 'kamuro',
    duration: 18,
    caliber: 2,
    heightMeters: 50,
    prefire: 1.0,
    shotCount: 25,
    cost: 60,
    icon: '🎇',
    impliesTrail: true,
  },
  // ── Shells ─────────────────────────────────────────────────
  {
    fileName: 'Chrysanthemum_Charcoal_Gold_to_Red',
    rootKind: 'Shell',
    category: 'morteiros',
    partType: 'shell',
    displayName: 'Chrysanthemum — Charcoal Gold → Red',
    color: '#7C461D',
    secondaryColor: '#FF1A1A',
    pattern: 'chrysanthemum',
    duration: 4.5,
    caliber: 5,
    heightMeters: 100,
    prefire: 2.5,
    cost: 32,
    icon: '🌼',
    impliesTrail: true,
  },
  {
    fileName: 'Crown_Brocade_Gold',
    rootKind: 'Shell',
    category: 'morteiros',
    partType: 'shell',
    displayName: 'Crown — Brocade Gold',
    color: '#E0A030',
    pattern: 'kamuro',
    duration: 6,
    caliber: 6,
    heightMeters: 120,
    prefire: 3.0,
    cost: 45,
    icon: '👑',
    impliesTrail: true,
  },
  {
    fileName: 'Crown_Rain_Coal_Gold',
    rootKind: 'Shell',
    category: 'morteiros',
    partType: 'shell',
    displayName: 'Crown Rain — Coal Gold',
    color: '#B97A2A',
    pattern: 'kamuro',
    duration: 5.5,
    caliber: 5,
    heightMeters: 100,
    prefire: 2.5,
    cost: 38,
    icon: '🌧️',
    impliesTrail: true,
  },
  {
    fileName: 'Crown_Rain_Coal_Gold_Glitter',
    rootKind: 'Shell',
    category: 'morteiros',
    partType: 'shell',
    displayName: 'Crown Rain — Coal Gold Glitter',
    color: '#C88830',
    secondaryColor: '#FFE2AE',
    pattern: 'kamuro',
    duration: 6,
    caliber: 5,
    heightMeters: 100,
    prefire: 2.5,
    cost: 42,
    icon: '✨',
    impliesTrail: true,
  },
  // ── Mines / Comets ─────────────────────────────────────────
  {
    fileName: 'Comet_Mine_Red_Silver_Plum',
    rootKind: 'Mine',
    category: 'mines',
    partType: 'mine',
    displayName: 'Comet Mine — Red + Silver Plum',
    color: '#E11D2E',
    secondaryColor: '#D8D8D8',
    pattern: 'comet',
    duration: 2.2,
    caliber: 3,
    heightMeters: 35,
    prefire: 0.4,
    cost: 18,
    icon: '☄️',
    impliesTrail: true,
  },
  {
    fileName: 'Comet_Monochrome_Tail_Silver_Magnesium',
    rootKind: 'Mine',
    category: 'mines',
    partType: 'mine',
    displayName: 'Comet — Monochrome Tail Silver Magnesium',
    color: '#F2F2F2',
    pattern: 'comet',
    duration: 2.0,
    caliber: 3,
    heightMeters: 35,
    prefire: 0.4,
    cost: 16,
    icon: '🌠',
    impliesTrail: true,
  },
  {
    fileName: 'Comet_Silver_w_Red_Tip',
    rootKind: 'Mine',
    category: 'mines',
    partType: 'mine',
    displayName: 'Comet — Silver with Red Tip',
    color: '#E5E5E5',
    secondaryColor: '#E11D2E',
    pattern: 'comet',
    duration: 2.0,
    caliber: 3,
    heightMeters: 35,
    prefire: 0.4,
    cost: 18,
    icon: '☄️',
    impliesTrail: true,
  },
  {
    fileName: 'Comet_Ultrafast_Red',
    rootKind: 'Mine',
    category: 'mines',
    partType: 'mine',
    displayName: 'Comet — Ultrafast Red',
    color: '#FF1A1A',
    pattern: 'comet',
    duration: 0.9,
    caliber: 2,
    heightMeters: 25,
    prefire: 0.2,
    cost: 14,
    icon: '🔴',
    impliesTrail: false,
  },
];

/** Stable id derivation: `fwe-<lowercase-slug>`. */
export function fweEffectId(spec: Pick<FweUploadedSpec, 'fileName'>): string {
  return `fwe-${spec.fileName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;
}

/** Map a FweUploadedSpec → canonical Effect entry. */
export function fweSpecToEffect(spec: FweUploadedSpec): Effect {
  return {
    id: fweEffectId(spec),
    name: spec.displayName,
    category: spec.category,
    type: 'firework',
    color: spec.color,
    duration: spec.duration,
    cost: spec.cost,
    icon: spec.icon,
    partType: spec.partType,
    caliber: spec.caliber,
    heightMeters: spec.heightMeters,
    prefire: spec.prefire,
    pattern: spec.pattern,
    safetyDistance: spec.caliber * 25,
    secondaryColor: spec.secondaryColor,
    shotCount: spec.shotCount,
    impliesTrail: spec.impliesTrail,
  };
}

/** Materialised catalog — one Effect per uploaded .fwe. */
export const FWE_UPLOADED_EFFECTS: Effect[] = FWE_UPLOADED_SPECS.map(fweSpecToEffect);

/**
 * Resolve an uploaded .fwe Effect by name, filename, or stable id.
 * Tolerant to case, separators (hyphen/underscore/space), and the
 * `.fwe` extension.
 */
export function resolveFweEffect(query: string | null | undefined): Effect | undefined {
  if (!query) return undefined;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\.fwe$/i, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const q = norm(query);
  if (!q) return undefined;
  for (const spec of FWE_UPLOADED_SPECS) {
    const fx = fweSpecToEffect(spec);
    if (fx.id === q || fx.id === `fwe-${q}`) return fx;
    if (norm(spec.fileName) === q) return fx;
    if (norm(spec.displayName) === q) return fx;
  }
  return undefined;
}
