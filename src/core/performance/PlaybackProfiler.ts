/**
 * ─── PlaybackProfiler ──────────────────────────────────────────────
 * Automatic React render profiler scoped to *timeline playback* events
 * (Play / Pause / Scrub). Captures every commit reported by
 * <React.Profiler> wrappers, aggregates per component, and computes
 * a render-count + p95 actualDuration grouped by Zustand store.
 *
 * Why scoped to playback:
 *   - The Nuclear Performance plan targets re-render storms during
 *     timeline scrub and Play/Pause — measuring outside that window
 *     dilutes the signal with idle commits.
 *   - The profiler auto-arms when `timelineClock.playing` flips true
 *     and auto-stops on pause, so operators get a clean per-session
 *     report without manual bookkeeping.
 *
 * Store attribution:
 *   1. Components can opt-in via `useProfiledStoreTag('missionStore')`
 *      to declare the dominant store they consume.
 *   2. Otherwise we fall back to a name → store heuristic
 *      (Timeline*, Cue* → missionStore; Hardware*, DMX*, Telemetry*
 *      → hardwareSyncStore; Sim*, Particle*, Boid*, Laser* →
 *      simulationStore; everything else → uiWorkspaceStore).
 *
 * Design constraints:
 *   - Zero overhead when DISARMED. The Profiler `onRender` callback
 *     short-circuits on the first line.
 *   - All aggregation is lazy (computed at `getReport()` time) so the
 *     hot path only does an array push.
 *   - Capped buffer (10k samples) to keep memory bounded during long
 *     shows; oldest samples are dropped FIFO.
 */
import { timelineClock } from '@/core/timeline/TimelineClock';

export type StoreBucket =
  | 'missionStore'
  | 'hardwareSyncStore'
  | 'simulationStore'
  | 'uiWorkspaceStore'
  | 'unknown';

export interface RenderSample {
  id: string;
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
  startTime: number;
  store: StoreBucket;
}

export interface ComponentReportEntry {
  id: string;
  store: StoreBucket;
  renders: number;
  totalMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

export interface StoreReportEntry {
  store: StoreBucket;
  renders: number;
  components: number;
  totalMs: number;
  avgMs: number;
  p95Ms: number;
}

export interface PlaybackProfilerReport {
  startedAt: number;
  endedAt: number;
  durationMs: number;
  totalRenders: number;
  uniqueComponents: number;
  byComponent: ComponentReportEntry[];
  byStore: StoreReportEntry[];
  truncated: boolean;
}

const MAX_SAMPLES = 10_000;

// ── Store attribution ────────────────────────────────────────
const explicitTags = new Map<string, StoreBucket>();

export function tagComponentStore(id: string, store: StoreBucket): void {
  explicitTags.set(id, store);
}
export function untagComponentStore(id: string): void {
  explicitTags.delete(id);
}

function inferStore(id: string): StoreBucket {
  const tagged = explicitTags.get(id);
  if (tagged) return tagged;
  const n = id.toLowerCase();
  if (/(^|[^a-z])(timeline|cue|showplan|mission|track|keyframe)/.test(n)) return 'missionStore';
  if (/(^|[^a-z])(hardware|dmx|artnet|osc|telemetry|fleet|continuity|fireone|pbus)/.test(n))
    return 'hardwareSyncStore';
  if (/(^|[^a-z])(sim|particle|boid|laser|swarm|webgpu|gpgpu|render)/.test(n))
    return 'simulationStore';
  if (/(^|[^a-z])(panel|workspace|sidebar|toolbar|hud|menu|dialog|modal|toast|settings)/.test(n))
    return 'uiWorkspaceStore';
  return 'unknown';
}

// ── Profiler state ───────────────────────────────────────────
let armed = false;
let startedAt = 0;
let endedAt = 0;
let truncated = false;
const samples: RenderSample[] = [];
const subscribers = new Set<(armed: boolean) => void>();
let unsubAuto: (() => void) | null = null;

export function isProfilerArmed(): boolean {
  return armed;
}

export function subscribeProfilerArmed(cb: (armed: boolean) => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

function notify() {
  subscribers.forEach((cb) => cb(armed));
}

export function startPlaybackProfiler(): void {
  if (armed) return;
  samples.length = 0;
  truncated = false;
  startedAt = performance.now();
  endedAt = 0;
  armed = true;
  notify();
}

export function stopPlaybackProfiler(): PlaybackProfilerReport {
  if (armed) {
    armed = false;
    endedAt = performance.now();
    notify();
  }
  return getReport();
}

/** Profiler `onRender` callback — install via <React.Profiler onRender={recordRender}>. */
export function recordRender(
  id: string,
  phase: 'mount' | 'update' | 'nested-update',
  actualDuration: number,
  _baseDuration: number,
  startTime: number,
): void {
  if (!armed) return;
  if (samples.length >= MAX_SAMPLES) {
    samples.shift();
    truncated = true;
  }
  samples.push({ id, phase, actualDuration, startTime, store: inferStore(id) });
}

// ── Report aggregation ───────────────────────────────────────
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(Math.floor(p * sorted.length), sorted.length - 1);
  return sorted[idx];
}

export function getReport(): PlaybackProfilerReport {
  const end = endedAt || performance.now();
  const byId = new Map<string, { store: StoreBucket; durations: number[] }>();
  for (const s of samples) {
    let bucket = byId.get(s.id);
    if (!bucket) {
      bucket = { store: s.store, durations: [] };
      byId.set(s.id, bucket);
    }
    bucket.durations.push(s.actualDuration);
  }

  const byComponent: ComponentReportEntry[] = [];
  for (const [id, { store, durations }] of byId) {
    const sorted = [...durations].sort((a, b) => a - b);
    const total = sorted.reduce((acc, v) => acc + v, 0);
    byComponent.push({
      id,
      store,
      renders: sorted.length,
      totalMs: total,
      avgMs: total / sorted.length,
      p50Ms: percentile(sorted, 0.5),
      p95Ms: percentile(sorted, 0.95),
      p99Ms: percentile(sorted, 0.99),
      maxMs: sorted[sorted.length - 1],
    });
  }
  byComponent.sort((a, b) => b.renders - a.renders);

  const storeAgg = new Map<StoreBucket, { renders: number; durations: number[]; comps: Set<string> }>();
  for (const c of byComponent) {
    let agg = storeAgg.get(c.store);
    if (!agg) {
      agg = { renders: 0, durations: [], comps: new Set() };
      storeAgg.set(c.store, agg);
    }
    agg.renders += c.renders;
    agg.comps.add(c.id);
  }
  for (const s of samples) {
    storeAgg.get(s.store)?.durations.push(s.actualDuration);
  }

  const byStore: StoreReportEntry[] = [];
  for (const [store, { renders, durations, comps }] of storeAgg) {
    const sorted = durations.sort((a, b) => a - b);
    const total = sorted.reduce((acc, v) => acc + v, 0);
    byStore.push({
      store,
      renders,
      components: comps.size,
      totalMs: total,
      avgMs: sorted.length ? total / sorted.length : 0,
      p95Ms: percentile(sorted, 0.95),
    });
  }
  byStore.sort((a, b) => b.renders - a.renders);

  return {
    startedAt,
    endedAt: end,
    durationMs: end - startedAt,
    totalRenders: samples.length,
    uniqueComponents: byId.size,
    byComponent,
    byStore,
    truncated,
  };
}

export function clearProfilerSamples(): void {
  samples.length = 0;
  truncated = false;
  startedAt = performance.now();
  endedAt = 0;
}

// ── Auto-arm on timeline play/pause ──────────────────────────
/**
 * Subscribe to TimelineClock and arm the profiler whenever playback
 * is active or a scrub (seek) lands. Idempotent.
 */
export function installPlaybackAutoArm(): void {
  if (unsubAuto) return;
  let wasPlaying = false;
  let lastSeekArm = 0;
  unsubAuto = timelineClock.onChange((state) => {
    // Play → Pause edges
    if (state.playing && !wasPlaying) startPlaybackProfiler();
    else if (!state.playing && wasPlaying) stopPlaybackProfiler();
    wasPlaying = state.playing;

    // Scrub: arm for a 1.5s window so we capture the render burst
    if (state.lastPositionChange === 'seek' && !armed) {
      lastSeekArm = performance.now();
      startPlaybackProfiler();
      setTimeout(() => {
        if (armed && performance.now() - lastSeekArm >= 1450) stopPlaybackProfiler();
      }, 1500);
    }
  });
}

export function uninstallPlaybackAutoArm(): void {
  if (unsubAuto) {
    unsubAuto();
    unsubAuto = null;
  }
}

// ── Window debug surface ─────────────────────────────────────
declare global {
  interface Window {
    __fxkPlaybackProfiler?: {
      start: typeof startPlaybackProfiler;
      stop: typeof stopPlaybackProfiler;
      report: typeof getReport;
      clear: typeof clearProfilerSamples;
      armed: typeof isProfilerArmed;
    };
  }
}

export function exposePlaybackProfilerOnWindow(): void {
  if (typeof window === 'undefined') return;
  window.__fxkPlaybackProfiler = {
    start: startPlaybackProfiler,
    stop: stopPlaybackProfiler,
    report: getReport,
    clear: clearProfilerSamples,
    armed: isProfilerArmed,
  };
}
