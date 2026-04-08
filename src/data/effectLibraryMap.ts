/**
 * Indexed Map for O(1) effect lookups by ID.
 * Single source of truth — replaces duplicated logic in sharedState.tsx.
 */
import { EFFECT_LIBRARY, type Effect } from './effectLibrary';

let _map: Map<string, Effect> | null = null;
let _lastLength = 0;

function rebuildIfNeeded(): Map<string, Effect> {
  if (!_map || _lastLength !== EFFECT_LIBRARY.length) {
    _map = new Map(EFFECT_LIBRARY.map(e => [e.id, e]));
    _lastLength = EFFECT_LIBRARY.length;
  }
  return _map;
}

export function getEffectById(id: string): Effect | undefined {
  const map = rebuildIfNeeded();
  const result = map.get(id);
  // If lookup misses but library has items, force rebuild (handles same-length mutations)
  if (!result && EFFECT_LIBRARY.length > 0) {
    _map = new Map(EFFECT_LIBRARY.map(e => [e.id, e]));
    _lastLength = EFFECT_LIBRARY.length;
    return _map.get(id);
  }
  return result;
}

/** Get the full indexed map (lazy-built, cached). */
export function getEffectLibraryMap(): ReadonlyMap<string, Effect> {
  return rebuildIfNeeded();
}

/** Force cache invalidation (call after mutations). */
export function invalidateEffectCache(): void {
  _map = null;
  _lastLength = 0;
}
