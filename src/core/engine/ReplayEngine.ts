/**
 * ─── Replay Engine ──────────────────────────────────────────────────
 * Deterministic replay: restore nearest snapshot, then re-apply
 * CommandLog entries tick-by-tick to reach target state.
 */

import { commandLog } from '@/core/command/CommandLog';
import { snapshotManager } from '@/core/state/SnapshotManager';
import { commandBus, type Command } from '@/core/command/CommandBus';

export type ReplayState = 'idle' | 'replaying' | 'done';

class ReplayEngine {
  private _state: ReplayState = 'idle';
  private _replayCommands: Map<number, Command[]> = new Map();
  private _currentTick = 0;
  private _targetTick = 0;

  /**
   * Rollback to a specific tick:
   * 1. Find nearest snapshot ≤ targetTick
   * 2. Restore snapshot state
   * 3. Re-apply commands from snapshot tick to targetTick
   * 4. Truncate log & snapshots after targetTick
   */
  rollback(targetTick: number): boolean {
    const snap = snapshotManager.nearest(targetTick);
    if (!snap) {
      console.warn('[ReplayEngine] No snapshot found for tick', targetTick);
      return false;
    }

    // 1. Restore snapshot
    snapshotManager.restore(snap);

    // 2. Re-apply commands between snapshot and target
    if (snap.tick < targetTick) {
      const cmds = commandLog.groupedSlice(snap.tick + 1, targetTick);
      // Disable logging during replay to avoid double-recording
      commandLog.setEnabled(false);
      for (let tick = snap.tick + 1; tick <= targetTick; tick++) {
        const tickCmds = cmds.get(tick);
        if (tickCmds) {
          commandBus.applyAll(tickCmds);
        }
      }
      commandLog.setEnabled(true);
    }

    // 3. Truncate future
    commandLog.truncateAfter(targetTick);
    snapshotManager.truncateAfter(targetTick);

    this._state = 'done';
    return true;
  }

  /**
   * Start a slow-motion replay (for visualization).
   * Call tick() each frame to advance one replay tick.
   */
  startReplay(fromTick: number, toTick: number): boolean {
    const snap = snapshotManager.nearest(fromTick);
    if (!snap) return false;

    snapshotManager.restore(snap);
    this._replayCommands = commandLog.groupedSlice(snap.tick + 1, toTick);
    this._currentTick = snap.tick;
    this._targetTick = toTick;
    this._state = 'replaying';
    return true;
  }

  /** Advance one tick of the replay. Returns false when done. */
  tick(): boolean {
    if (this._state !== 'replaying') return false;
    this._currentTick++;
    const cmds = this._replayCommands.get(this._currentTick);
    if (cmds) {
      commandLog.setEnabled(false);
      commandBus.applyAll(cmds);
      commandLog.setEnabled(true);
    }
    if (this._currentTick >= this._targetTick) {
      this._state = 'done';
      return false;
    }
    return true;
  }

  stop(): void {
    this._state = 'idle';
    this._replayCommands.clear();
  }

  getState(): ReplayState {
    return this._state;
  }

  getCurrentTick(): number {
    return this._currentTick;
  }

  getTargetTick(): number {
    return this._targetTick;
  }

  getProgress(): number {
    if (this._targetTick <= 0) return 0;
    return Math.min(1, this._currentTick / this._targetTick);
  }
}

export const replayEngine = new ReplayEngine();
