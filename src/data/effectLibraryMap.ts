/**
 * Indexed Map for O(1) effect lookups by ID.
 * Fast-path indexes curated EFFECT_LIBRARY; on miss, falls back to the
 * unified resolver (FWsim, FWE Mine, Standard Effects, Finale parts incl.
 * Amazon/Lidu/Magic/Winda/Showven). This lets the renderer find every
 * imported part by id — the VDL-derivation block in FireworkRenderer then
 * fills caliber/height/pattern/color from `effect.vdl`.
 */
import { EFFECT_LIBRARY, type Effect } from './effectLibrary';
import { findEffectById, __resetResolveEffectCache } from './effectsLibraries/resolveEffect';

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
  if (result) return result;
  // Fallback: unified resolver covers FWsim + FWE Mine + Standard Effects +
  // Finale parts (Amazon, Lidu, Magic, Winda, Showven). Imported parts carry
  // a `.vdl` string that the renderer parses to fill render params.
  return findEffectById(id);
}

/** Get the full indexed map (lazy-built, cached). */
export function getEffectLibraryMap(): ReadonlyMap<string, Effect> {
  return rebuildIfNeeded();
}

/** Force cache invalidation (call after mutations). */
export function invalidateEffectCache(): void {
  _map = null;
  _lastLength = 0;
  __resetResolveEffectCache();
}
