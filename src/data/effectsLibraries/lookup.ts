/**
 * Unified effect lookup — bridges static EFFECT_LIBRARY (curated/FWsim built-ins)
 * with dynamic buildImportedEffects() (Finale parts: Showven/Lidu/Magic/Winda/Amazon).
 *
 * Use this everywhere a TimelineItem.effectId is resolved (drop handlers,
 * renderers, audio duration calc, exporters). Replacing raw
 * `EFFECT_LIBRARY.find(e => e.id === id)` with `getEffectById(id)` ensures
 * imported effects don't silently disappear from the pipeline.
 */
import { EFFECT_LIBRARY, type Effect } from '@/data/effectLibrary';
import { buildImportedEffects } from '@/data/effectsLibraries/registry';

let _importedIndex: Map<string, Effect> | null = null;
let _curatedIndex: Map<string, Effect> | null = null;

function curatedIndex(): Map<string, Effect> {
  if (!_curatedIndex) {
    _curatedIndex = new Map();
    for (const e of EFFECT_LIBRARY) _curatedIndex.set(e.id, e);
  }
  return _curatedIndex;
}

function importedIndex(): Map<string, Effect> {
  if (!_importedIndex) {
    _importedIndex = new Map();
    try {
      for (const e of buildImportedEffects()) _importedIndex.set(e.id, e);
    } catch {
      // Imported bundle unavailable — fall back silently to curated only.
    }
  }
  return _importedIndex;
}

/** Returns the Effect for an id, looking in curated + imported (Finale) libraries. */
export function getEffectById(id: string | null | undefined): Effect | undefined {
  if (!id) return undefined;
  return curatedIndex().get(id) ?? importedIndex().get(id);
}

/** Test helper: clears memoized indices. */
export function _resetEffectLookupCache(): void {
  _curatedIndex = null;
  _importedIndex = null;
}
