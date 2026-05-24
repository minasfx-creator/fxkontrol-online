/**
 * terrainCacheControl — Imperative control surface for the terrain height
 * cache, exposed to UI actions (clear, force re-validate, bump version).
 *
 * Why a separate module?
 *  The cache instance lives inside useTerrainHeightCache (closures over refs).
 *  The UI panel cannot reach into those refs directly, so the hook *registers*
 *  a thin handle here on mount and unregisters on unmount. UI actions then
 *  dispatch via this singleton without prop drilling.
 *
 *  This keeps the hot path (useFrame) untouched — control calls only happen
 *  on user click.
 */
export interface TerrainCacheController {
  /** Drop all in-memory resolved heights; next frame will re-sample. */
  clearMemory: () => void;
  /** Force a full re-validation pass on the next frame (regardless of interval). */
  forceRevalidate: () => void;
  /** Drop in-memory + local browser cache for the current scope. */
  clearLocal: () => Promise<void>;
  /** Drop cloud cache rows for the current scope (server purge). Returns deleted count. */
  clearCloud: () => Promise<number>;
  /** Convenience: clear EVERYTHING (memory + local + cloud) and trigger revalidation. */
  hardReset: () => Promise<void>;
  /** Current cache size (resolved entries). */
  getSize: () => number;
}

let _ctrl: TerrainCacheController | null = null;
const _subs = new Set<(active: boolean) => void>();

export const terrainCacheControl = {
  /** Called by useTerrainHeightCache on mount. */
  register(c: TerrainCacheController) {
    _ctrl = c;
    _subs.forEach(fn => fn(true));
  },
  /** Called by useTerrainHeightCache on unmount. */
  unregister(c: TerrainCacheController) {
    if (_ctrl === c) {
      _ctrl = null;
      _subs.forEach(fn => fn(false));
    }
  },
  /** True iff a hook instance is currently mounted (controls are wired). */
  isActive(): boolean {
    return _ctrl !== null;
  },
  /** Subscribe to active/inactive transitions (UI enable/disable buttons). */
  subscribe(fn: (active: boolean) => void): () => void {
    _subs.add(fn);
    fn(_ctrl !== null);
    return () => { _subs.delete(fn); };
  },

  // ── Action proxies (no-op when no hook is mounted) ──
  clearMemory() { _ctrl?.clearMemory(); },
  forceRevalidate() { _ctrl?.forceRevalidate(); },
  async clearLocal() { await _ctrl?.clearLocal(); },
  async clearCloud(): Promise<number> { return (await _ctrl?.clearCloud()) ?? 0; },
  async hardReset() { await _ctrl?.hardReset(); },
  getSize(): number { return _ctrl?.getSize() ?? 0; },
};
