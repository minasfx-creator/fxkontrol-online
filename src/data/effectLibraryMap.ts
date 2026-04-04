/**
 * Indexed Map for O(1) effect lookups by ID.
 * Single source of truth — replaces duplicated logic in sharedState.tsx.
 */
import { EFFECT_LIBRARY, type Effect } from './effectLibrary';

let _map: Map<string, Effect> | null = null;

export function getEffectById(id: string): Effect | undefined {
  if (!_map || _map.size !== EFFECT_LIBRARY.length) {
    _map = new Map(EFFECT_LIBRARY.map(e => [e.id, e]));
  }
  return _map.get(id);
}

/** Get the full indexed map (lazy-built, cached). */
export function getEffectLibraryMap(): ReadonlyMap<string, Effect> {
  if (!_map || _map.size !== EFFECT_LIBRARY.length) {
    _map = new Map(EFFECT_LIBRARY.map(e => [e.id, e]));
  }
  return _map;
}
