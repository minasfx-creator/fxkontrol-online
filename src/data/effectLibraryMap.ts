/**
 * Indexed Map for O(1) effect lookups by ID.
 * Single source of truth — now covers BOTH curated EFFECT_LIBRARY
 * and runtime-imported Finale parts (via buildImportedEffects).
 */
import { EFFECT_LIBRARY, type Effect } from './effectLibrary';
import { buildImportedEffects } from './effectsLibraries/registry';

let _map: Map<string, Effect> | null = null;
let _lastCuratedLength = 0;
let _lastImportedLength = 0;

function importedSafe(): Effect[] {
  try { return buildImportedEffects(); } catch { return []; }
}

function rebuildIfNeeded(): Map<string, Effect> {
  const imported = importedSafe();
  if (!_map || _lastCuratedLength !== EFFECT_LIBRARY.length || _lastImportedLength !== imported.length) {
    _map = new Map();
    for (const e of EFFECT_LIBRARY) _map.set(e.id, e);
    // Imported effects do NOT override curated on id collision (curated wins).
    for (const e of imported) if (!_map.has(e.id)) _map.set(e.id, e);
    _lastCuratedLength = EFFECT_LIBRARY.length;
    _lastImportedLength = imported.length;
  }
  return _map;
}

export function getEffectById(id: string): Effect | undefined {
  const map = rebuildIfNeeded();
  return map.get(id);
}

/** Get the full indexed map (lazy-built, cached). */
export function getEffectLibraryMap(): ReadonlyMap<string, Effect> {
  return rebuildIfNeeded();
}

/** Force cache invalidation (call after mutations). */
export function invalidateEffectCache(): void {
  _map = null;
  _lastCuratedLength = 0;
  _lastImportedLength = 0;
}

