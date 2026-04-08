/**
 * ─── Snapshot Manager ───────────────────────────────────────────────
 * Periodic state snapshots for rollback / replay.
 * Ring buffer of max N snapshots, captured every M ticks.
 */

import { useProjectStore } from '@/store/useProjectStore';

export interface Snapshot {
  tick: number;
  ts: number;
  positionCount: number;
  timelineItemCount: number;
  state: {
    positions: unknown[];
    timelineItems: unknown[];
    trajectories: unknown[];
    cameraKeyframes: unknown[];
  };
}

const MAX_SNAPSHOTS = 20;
const DEFAULT_INTERVAL = 300; // ~5s at 60Hz

class SnapshotManager {
  private _snapshots: Snapshot[] = [];
  private _interval = DEFAULT_INTERVAL;
  private _lastCaptureTick = -Infinity;
  private _enabled = true;

  /** Capture current ProjectStore state at given tick. */
  capture(tick: number): Snapshot {
    const store = useProjectStore.getState();
    const snap: Snapshot = {
      tick,
      ts: Date.now(),
      positionCount: store.positions.length,
      timelineItemCount: store.timelineItems.length,
      state: {
        positions: structuredClone(store.positions),
        timelineItems: structuredClone(store.timelineItems),
        trajectories: structuredClone(store.trajectories),
        cameraKeyframes: structuredClone(store.cameraKeyframes),
      },
    };
    this._snapshots.push(snap);
    if (this._snapshots.length > MAX_SNAPSHOTS) {
      this._snapshots.shift();
    }
    this._lastCaptureTick = tick;
    return snap;
  }

  /** Called each tick — captures if interval elapsed. */
  maybeCapture(tick: number): Snapshot | null {
    if (!this._enabled) return null;
    if (tick - this._lastCaptureTick >= this._interval) {
      return this.capture(tick);
    }
    return null;
  }

  /** Find nearest snapshot at or before target tick. */
  nearest(tick: number): Snapshot | null {
    let best: Snapshot | null = null;
    for (const s of this._snapshots) {
      if (s.tick <= tick) best = s;
      else break;
    }
    return best;
  }

  /** Get all snapshots (newest last). */
  getAll(): readonly Snapshot[] {
    return this._snapshots;
  }

  /** Remove snapshots after a tick (for rollback). */
  truncateAfter(tick: number): void {
    this._snapshots = this._snapshots.filter(s => s.tick <= tick);
  }

  /** Apply a snapshot to ProjectStore. */
  restore(snap: Snapshot): void {
    const store = useProjectStore.getState();
    store.setPositions(structuredClone(snap.state.positions) as any);
    store.setTimelineItems(structuredClone(snap.state.timelineItems) as any);
    // trajectories and keyframes if setters exist
    if ('setTrajectories' in store) {
      (store as any).setTrajectories(structuredClone(snap.state.trajectories));
    }
    if ('setCameraKeyframes' in store) {
      (store as any).setCameraKeyframes(structuredClone(snap.state.cameraKeyframes));
    }
  }

  get count(): number {
    return this._snapshots.length;
  }

  setInterval(ticks: number): void {
    this._interval = ticks;
  }

  setEnabled(on: boolean): void {
    this._enabled = on;
  }

  clear(): void {
    this._snapshots.length = 0;
    this._lastCaptureTick = -Infinity;
  }
}

export const snapshotManager = new SnapshotManager();
