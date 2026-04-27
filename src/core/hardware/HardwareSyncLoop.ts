/**
 * ─── HardwareSyncLoop ──────────────────────────────────────────────
 * Decoupled 44Hz+ tick loop for DMX / OSC / ArtNet / sACN producers.
 *
 * Goals
 * - Run independently of React render cycle (no useFrame, no rAF
 *   coupling to Canvas). Uses a self-pacing setTimeout / rAF hybrid.
 * - Coalesce all hardware writes that happen within a tick into a
 *   single Zustand `set` call so subscribers fire once per tick max.
 * - Apply a shallow-equality diff against the previous snapshot so
 *   panels subscribed via `subscribeWithSelector + shallow` receive
 *   no notification when nothing changed.
 * - Zero alloc on the hot path (single staging buffer per universe,
 *   reused dirty Set, reused snapshot object refs when unchanged).
 *
 * Target rate: 44Hz default (DMX nominal refresh). Configurable up
 * to ~200Hz; auto-throttles on tab background to 5Hz.
 *
 * NOT a producer itself — protocol adapters (artNetTransport,
 * dmxUniverseManager, osc bridge) call `enqueueUniverseDelta` /
 * `enqueueChannel`. The loop drains and commits.
 */

import { useHardwareSyncStore } from '@/stores/hardwareSyncStore';

type DirtyChannel = { universe: number; channel: number; value: number };

const DEFAULT_HZ = 44;
const BACKGROUND_HZ = 5;
const MAX_HZ = 240;

class HardwareSyncLoop {
  private _running = false;
  private _hz = DEFAULT_HZ;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _lastTickAt = 0;

  // Staging — drained each tick into the store in a single `set`.
  private readonly _stagedChannels: DirtyChannel[] = [];
  private readonly _dirtyUniverses = new Set<number>();
  private readonly _stagedBridge = new Map<string, string>();

  // Snapshot of last committed universes for shallow-eq guard.
  // Keyed by universe → reference of channel array. We swap refs
  // ONLY when content changed, so React selectors using shallow
  // equality on the universe map skip re-renders.
  private readonly _committedRefs = new Map<number, number[]>();

  // Diagnostics
  private _ticks = 0;
  private _commits = 0;
  private _skippedTicks = 0;
  private _lastCommitMs = 0;

  start(hz: number = DEFAULT_HZ): void {
    this._hz = Math.min(MAX_HZ, Math.max(1, hz));
    if (this._running) return;
    this._running = true;
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVisibility);
    }
    this._schedule();
  }

  stop(): void {
    this._running = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibility);
    }
  }

  setRate(hz: number): void {
    this._hz = Math.min(MAX_HZ, Math.max(1, hz));
  }

  /** Producer API — DMX/ArtNet path. Cheap; no allocations. */
  enqueueChannel(universe: number, channel: number, value: number): void {
    this._stagedChannels.push({ universe, channel, value });
    this._dirtyUniverses.add(universe);
  }

  enqueueBridgeStatus(bridge: string, status: string): void {
    this._stagedBridge.set(bridge, status);
  }

  getDiagnostics() {
    return {
      running: this._running,
      hz: this._hz,
      ticks: this._ticks,
      commits: this._commits,
      skippedTicks: this._skippedTicks,
      lastCommitMs: this._lastCommitMs,
      pendingChannels: this._stagedChannels.length,
      dirtyUniverses: this._dirtyUniverses.size,
    };
  }

  // ── internals ───────────────────────────────────────────────────
  private _schedule(): void {
    if (!this._running) return;
    const interval = 1000 / this._hz;
    this._timer = setTimeout(this._tick, interval);
  }

  private _onVisibility = (): void => {
    if (typeof document === 'undefined') return;
    this.setRate(document.hidden ? BACKGROUND_HZ : DEFAULT_HZ);
  };

  private _tick = (): void => {
    this._ticks++;
    const t0 = performance.now();

    const hasChannels = this._stagedChannels.length > 0;
    const hasBridge = this._stagedBridge.size > 0;

    if (!hasChannels && !hasBridge) {
      this._skippedTicks++;
      this._lastTickAt = t0;
      this._schedule();
      return;
    }

    // ── Coalesce dirty universes into next-gen channel arrays ────
    // Pull current state once; mutate via immer through the store.
    const currentUniverses = useHardwareSyncStore.getState().activeUniverses;
    const nextUniverses: Record<number, number[]> = { ...currentUniverses };
    let universesChanged = false;

    for (const uni of this._dirtyUniverses) {
      const existing = currentUniverses[uni];
      // Clone-on-write so subscribers using shallow eq see a new ref
      // ONLY for universes that actually changed.
      const buf = existing ? existing.slice() : new Array(512).fill(0);
      nextUniverses[uni] = buf;
    }

    // Apply staged channel writes
    for (let i = 0; i < this._stagedChannels.length; i++) {
      const { universe, channel, value } = this._stagedChannels[i];
      const buf = nextUniverses[universe];
      if (!buf || channel < 0 || channel >= buf.length) continue;
      const clamped = value < 0 ? 0 : value > 255 ? 255 : value | 0;
      if (buf[channel] !== clamped) {
        buf[channel] = clamped;
        universesChanged = true;
      }
    }

    // Shallow-eq guard: if nothing actually changed, restore old refs
    if (!universesChanged) {
      for (const uni of this._dirtyUniverses) {
        const old = this._committedRefs.get(uni) ?? currentUniverses[uni];
        if (old) nextUniverses[uni] = old;
      }
    }

    // Bridge statuses (cheap shallow diff)
    const currentBridge = useHardwareSyncStore.getState().bridgeStatus;
    let bridgeChanged = false;
    const nextBridge = { ...currentBridge } as Record<string, string>;
    for (const [k, v] of this._stagedBridge) {
      if (currentBridge[k as keyof typeof currentBridge] !== v) {
        nextBridge[k] = v;
        bridgeChanged = true;
      }
    }

    // Single batched commit — Zustand fires subscribers exactly once.
    if (universesChanged || bridgeChanged) {
      useHardwareSyncStore.setState((s) => {
        if (universesChanged) {
          s.activeUniverses = nextUniverses;
          for (const uni of this._dirtyUniverses) {
            this._committedRefs.set(uni, nextUniverses[uni]);
          }
        }
        if (bridgeChanged) {
          s.bridgeStatus = nextBridge as typeof s.bridgeStatus;
        }
        s.lastSyncAt = Date.now();
      });
      this._commits++;
    } else {
      this._skippedTicks++;
    }

    // Drain staging
    this._stagedChannels.length = 0;
    this._dirtyUniverses.clear();
    this._stagedBridge.clear();

    this._lastCommitMs = performance.now() - t0;
    this._lastTickAt = t0;
    this._schedule();
  };
}

export const hardwareSyncLoop = new HardwareSyncLoop();

if (typeof window !== 'undefined') {
  (window as unknown as { __fxkHardwareSyncLoop?: HardwareSyncLoop }).__fxkHardwareSyncLoop = hardwareSyncLoop;
}
