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
import bundleJson from './generated/finaleLibrariesParts.json';
import type { FinaleLibrariesBundle, FinalePart, FinaleLibraryId } from './types';
import { finalePartToEffect, finalePartToEffectId } from './finalePartToEffect';

const BUNDLE = bundleJson as unknown as FinaleLibrariesBundle;

let _effectsCache: Effect[] | null = null;
let _byEffectId: Map<string, FinalePart> | null = null;

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

export const FINALE_LIBRARIES_META = {
  version: BUNDLE.version,
  generatedAt: BUNDLE.generatedAt,
  total: BUNDLE.parts.length,
  summary: BUNDLE.summary,
} as const;
