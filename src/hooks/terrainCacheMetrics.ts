/**
 * terrainCacheMetrics — Lightweight singleton telemetry for useTerrainHeightCache.
 *
 * The hook publishes counters (hits, misses, revalidations, drift events) and
 * a rolling per-frame execution time. UI panels subscribe to a snapshot stream.
 * Zero-GC in the hot path: counters are mutated on a frozen object reference
 * and re-emitted as a shallow clone only when subscribers exist.
 */
export interface TerrainCacheMetrics {
  /** Total getHeight() calls that returned a resolved cache entry. */
  hits: number;
  /** getHeight() calls that returned 0 (no entry yet). */
  misses: number;
  /** Raycast samples for positions that had no resolved entry. */
  unresolvedSamples: number;
  /** Re-validation raycasts on already-resolved positions. */
  revalidations: number;
  /** Cache writes triggered by drift > threshold (height changed). */
  driftEvents: number;
  /** One-shot synchronous raycasts triggered by getHeight() on a cache miss. */
  oneShotResolves: number;
  /** LOD changes detected (tile mesh count delta). */
  lodChanges: number;
  /** Cache size (resolved entries). */
  cacheSize: number;
  /** Tracked positions count. */
  trackedPositions: number;
  /** Whether the tiles group was found this frame. */
  tilesGroupFound: boolean;
  /** Last frame's hook execution time, ms. */
  lastFrameMs: number;
  /** Rolling avg of last 60 frames, ms. */
  avgFrameMs: number;
  /** Peak frame time over last 60 frames, ms. */
  peakFrameMs: number;
  /** Frame counter for diagnostics. */
  frame: number;
}

const _state: TerrainCacheMetrics = {
  hits: 0,
  misses: 0,
  unresolvedSamples: 0,
  revalidations: 0,
  driftEvents: 0,
  oneShotResolves: 0,
  lodChanges: 0,
  cacheSize: 0,
  trackedPositions: 0,
  tilesGroupFound: false,
  lastFrameMs: 0,
  avgFrameMs: 0,
  peakFrameMs: 0,
  frame: 0,
};

const _frameTimes: number[] = [];
const FRAME_WINDOW = 60;
const _subs = new Set<(s: TerrainCacheMetrics) => void>();

function notify() {
  if (_subs.size === 0) return;
  const snap = { ..._state };
  _subs.forEach(fn => fn(snap));
}

export const terrainMetrics = {
  /** Increment hit/miss counters from getHeight(). */
  recordGet(hit: boolean) {
    if (hit) _state.hits++; else _state.misses++;
  },
  recordUnresolvedSample() { _state.unresolvedSamples++; },
  recordRevalidation() { _state.revalidations++; },
  recordDrift() { _state.driftEvents++; },
  recordOneShotResolve() { _state.oneShotResolves++; },
  recordLodChange() { _state.lodChanges++; },
  setCacheSize(n: number) { _state.cacheSize = n; },
  setTrackedPositions(n: number) { _state.trackedPositions = n; },
  setTilesGroupFound(found: boolean) { _state.tilesGroupFound = found; },

  /** Push a frame execution time (ms) and recompute rolling stats. */
  recordFrame(ms: number) {
    _state.frame++;
    _state.lastFrameMs = ms;
    _frameTimes.push(ms);
    if (_frameTimes.length > FRAME_WINDOW) _frameTimes.shift();
    let sum = 0, peak = 0;
    for (let i = 0; i < _frameTimes.length; i++) {
      sum += _frameTimes[i];
      if (_frameTimes[i] > peak) peak = _frameTimes[i];
    }
    _state.avgFrameMs = sum / _frameTimes.length;
    _state.peakFrameMs = peak;
    notify();
  },

  /** Reset all counters (keeps subscribers). */
  reset() {
    _state.hits = 0; _state.misses = 0;
    _state.unresolvedSamples = 0; _state.revalidations = 0;
    _state.driftEvents = 0; _state.lodChanges = 0;
    _state.oneShotResolves = 0;
    _state.lastFrameMs = 0; _state.avgFrameMs = 0; _state.peakFrameMs = 0;
    _state.frame = 0;
    _frameTimes.length = 0;
    notify();
  },

  /** Snapshot current metrics (cloned). */
  snapshot(): TerrainCacheMetrics {
    return { ..._state };
  },

  /** Subscribe to metric updates; returns unsubscribe fn. */
  subscribe(fn: (s: TerrainCacheMetrics) => void): () => void {
    _subs.add(fn);
    fn({ ..._state });
    return () => { _subs.delete(fn); };
  },
};
