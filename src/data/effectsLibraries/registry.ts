/**
 * registry — lazy single-source-of-truth for the imported Finale parts.
 *
 * The 527-part bundle (~280 KB JSON) is statically imported via Vite, so it
 * lives in its own chunk and is only fetched when this module is touched.
 *
 * Public API:
 *   - getFinaleParts():        FinalePart[]   (raw rows)
 *   - getFinaleEffects():      Effect[]       (Effect-shaped, memoised)
 *   - getFinaleSummary():      counts per library
 *   - findFinalePart(id):      reverse lookup by Effect.id
 */

import type { Effect } from '@/data/effectLibrary';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import { FWSIM_BUILTIN_EFFECTS } from '@/data/fwsimBuiltinPresets';
import { FWE_MINE_EFFECTS } from '@/data/fweMineCatalog';
import { getStandardEffects } from '@/data/standardEffectsCatalog';
import bundleJson from './generated/finaleLibrariesParts.json';
import type { FinaleLibrariesBundle, FinalePart, FinaleLibraryId } from './types';
import type { FinaleLibrary as LegacyFinaleLibrary, FinalePart as LegacyFinalePart } from './finalePart';
import { finalePartToEffect, finalePartToEffectId } from './finalePartToEffect';
import { effectFingerprint } from './effectFingerprint';

export type EffectManufacturer =
  | 'Curated'
  | 'FWsim'
  | 'Showven'
  | 'Lidu'
  | 'Magic'
  | 'Winda'
  | 'Amazon Fireworks'
  | 'Other';

export interface MergedEffectEntry {
  effect: Effect;
  manufacturer: EffectManufacturer;
  /** Provenance claim — see src/lib/claims.ts when available. */
  claim: 'validated' | 'pilot' | 'marketing_hypothesis';
  /** Effect ids that collapsed into this entry under the same fingerprint. */
  aliases: string[];
  fingerprint: string;
}

export interface MergedEffectsCatalog {
  entries: MergedEffectEntry[];
  totalRaw: number;
  byManufacturer: Record<EffectManufacturer, number>;
}

const BUNDLE = bundleJson as unknown as FinaleLibrariesBundle;

const LIBRARY_MANUFACTURERS: Record<FinaleLibraryId, string> = {
  showven: 'Showven',
  lidu: 'Lidu',
  magic: 'Magic Fireworks',
  winda: 'Winda',
  amazon: 'Amazon Fireworks',
};

let _effectsCache: Effect[] | null = null;
let _byEffectId: Map<string, FinalePart> | null = null;
let _legacyLibrariesCache: LegacyFinaleLibrary[] | null = null;

export function getFinaleParts(): FinalePart[] {
  return BUNDLE.parts;
}

export function getFinaleSummary(): Record<FinaleLibraryId, number> {
  return BUNDLE.summary;
}

export function getFinaleEffects(): Effect[] {
  if (_effectsCache) return _effectsCache;
  _effectsCache = BUNDLE.parts.map(finalePartToEffect);
  return _effectsCache;
}

export function buildImportedEffects(): Effect[] {
  return getFinaleEffects();
}

export function findFinalePartByEffectId(id: string): FinalePart | undefined {
  if (!_byEffectId) {
    _byEffectId = new Map();
    for (const p of BUNDLE.parts) _byEffectId.set(finalePartToEffectId(p), p);
  }
  return _byEffectId.get(id);
}

function legacyLibraries(): LegacyFinaleLibrary[] {
  if (_legacyLibrariesCache) return _legacyLibrariesCache;

  const grouped = new Map<FinaleLibraryId, FinalePart[]>();
  for (const part of BUNDLE.parts) {
    const current = grouped.get(part.libraryId) ?? [];
    current.push(part);
    grouped.set(part.libraryId, current);
  }

  _legacyLibrariesCache = (Object.keys(LIBRARY_MANUFACTURERS) as FinaleLibraryId[]).map((slug) => {
    const parts = grouped.get(slug) ?? [];
    return {
      manufacturer: LIBRARY_MANUFACTURERS[slug],
      slug,
      count: parts.length,
      parts: parts as unknown as LegacyFinalePart[],
    };
  });
  return _legacyLibrariesCache;
}

export function listFinaleLibraries(): LegacyFinaleLibrary[] {
  return legacyLibraries();
}

export function getFinaleLibrary(slug: string): LegacyFinaleLibrary | undefined {
  return legacyLibraries().find((library) => library.slug === slug);
}

export function getFinalePart(id: string): LegacyFinalePart | undefined {
  for (const library of legacyLibraries()) {
    const part = library.parts.find((candidate) => `${library.slug}:${candidate.partNumber}` === id);
    if (part) return part;
  }
  return undefined;
}

export interface SearchOpts {
  query?: string;
  manufacturers?: string[];
  partTypes?: string[];
  minCaliberIn?: number;
  maxCaliberIn?: number;
  limit?: number;
}

function partCaliberIn(part: LegacyFinalePart): number | undefined {
  const raw = part.size == null ? '' : String(part.size).trim();
  if (!raw) return undefined;
  const value = Number.parseFloat(raw.replace(',', '.'));
  if (!Number.isFinite(value)) return undefined;
  return /mm/i.test(raw) ? value / 25.4 : value;
}

export function searchFinaleParts(opts: SearchOpts = {}): Array<{ part: LegacyFinalePart; lib: LegacyFinaleLibrary }> {
  const query = opts.query?.trim().toLowerCase();
  const manufacturers = opts.manufacturers?.length
    ? new Set(opts.manufacturers.map((manufacturer) => manufacturer.toLowerCase()))
    : null;
  const partTypes = opts.partTypes?.length
    ? new Set(opts.partTypes.map((partType) => partType.toLowerCase()))
    : null;
  const limit = opts.limit ?? 1000;
  const results: Array<{ part: LegacyFinalePart; lib: LegacyFinaleLibrary }> = [];

  for (const lib of legacyLibraries()) {
    if (manufacturers && !manufacturers.has(lib.manufacturer.toLowerCase())) continue;
    for (const part of lib.parts) {
      if (partTypes && !partTypes.has(String(part.partType ?? '').toLowerCase())) continue;
      const caliber = partCaliberIn(part);
      if (opts.minCaliberIn != null && (caliber == null || caliber < opts.minCaliberIn)) continue;
      if (opts.maxCaliberIn != null && (caliber == null || caliber > opts.maxCaliberIn)) continue;
      if (query) {
        const haystack = [
          part.partNumber,
          part.description,
          part.vdl,
          part.manufacturer,
          lib.manufacturer,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(query)) continue;
      }
      results.push({ part, lib });
      if (results.length >= limit) return results;
    }
  }

  return results;
}

export interface RegistrySummary {
  totalLibraries: number;
  totalParts: number;
  byManufacturer: Array<{ manufacturer: string; slug: string; count: number }>;
}

export function getRegistrySummary(): RegistrySummary {
  const libraries = legacyLibraries();
  return {
    totalLibraries: libraries.length,
    totalParts: libraries.reduce((total, library) => total + library.parts.length, 0),
    byManufacturer: libraries.map((library) => ({
      manufacturer: library.manufacturer,
      slug: library.slug,
      count: library.parts.length,
    })),
  };
}

// ── Manufacturer detection ───────────────────────────────────────────
const MANUFACTURER_PRIORITY: EffectManufacturer[] = [
  'Curated', 'FWsim', 'Showven', 'Lidu', 'Magic', 'Winda', 'Amazon Fireworks', 'Other',
];

function manufacturerOf(e: Effect, source: 'curated' | 'fwsim' | 'finale' | 'standard-effects'): EffectManufacturer {
  if (source === 'curated') return 'Curated';
  if (source === 'fwsim') return 'FWsim';
  if (source === 'standard-effects') return 'FWsim';
  // finale parts: id is "fl-<libId>-..."
  if (e.id.startsWith('fl-showven-')) return 'Showven';
  if (e.id.startsWith('fl-lidu-')) return 'Lidu';
  if (e.id.startsWith('fl-magic-')) return 'Magic';
  if (e.id.startsWith('fl-winda-')) return 'Winda';
  if (e.id.startsWith('fl-amazon-')) return 'Amazon Fireworks';
  return 'Other';
}

function claimFor(m: EffectManufacturer): 'validated' | 'pilot' | 'marketing_hypothesis' {
  // Curated catalog is hand-validated; vendor imports are pilot until field-tested.
  return m === 'Curated' ? 'validated' : 'pilot';
}

let _mergedCache: MergedEffectsCatalog | null = null;

/**
 * Returns the deduplicated, manufacturer-tagged effects catalog. Curated
 * EFFECT_LIBRARY wins on fingerprint collision; FWsim and Finale parts that
 * map to the same fingerprint are recorded as `aliases` of the winner.
 */
export function getMergedEffectsCatalog(): MergedEffectsCatalog {
  if (_mergedCache) return _mergedCache;

  const sources: ReadonlyArray<{ src: 'curated' | 'fwsim' | 'finale' | 'standard-effects'; list: Effect[] }> = [
    { src: 'curated', list: EFFECT_LIBRARY },
    { src: 'fwsim', list: FWSIM_BUILTIN_EFFECTS },
    { src: 'fwsim', list: FWE_MINE_EFFECTS },
    { src: 'standard-effects', list: getStandardEffects() },
    { src: 'finale', list: getFinaleEffects() },
  ];

  let totalRaw = 0;
  const byFp = new Map<string, MergedEffectEntry>();
  const byManufacturer: Record<EffectManufacturer, number> = {
    Curated: 0, FWsim: 0, Showven: 0, Lidu: 0, Magic: 0, Winda: 0,
    'Amazon Fireworks': 0, Other: 0,
  };

  for (const { src, list } of sources) {
    for (const effect of list) {
      totalRaw++;
      const fp = effectFingerprint(effect);
      const existing = byFp.get(fp);
      if (existing) {
        if (!existing.aliases.includes(effect.id)) existing.aliases.push(effect.id);
        continue;
      }
      const manufacturer = manufacturerOf(effect, src);
      byManufacturer[manufacturer]++;
      byFp.set(fp, {
        effect, manufacturer, claim: claimFor(manufacturer),
        aliases: [], fingerprint: fp,
      });
    }
  }

  _mergedCache = {
    entries: Array.from(byFp.values()),
    totalRaw,
    byManufacturer,
  };
  return _mergedCache;
}

void MANUFACTURER_PRIORITY;

export const FINALE_LIBRARIES_META = {
  version: BUNDLE.version,
  generatedAt: BUNDLE.generatedAt,
  total: BUNDLE.parts.length,
  summary: BUNDLE.summary,
} as const;
