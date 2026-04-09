/**
 * ─── Command Bus ────────────────────────────────────────────────────
 * Single entry point for ALL mutations in the system.
 * Zero-GC hot path: reuses internal array via swap-drain.
 *
 * Usage:
 *   commandBus.dispatch({ type: 'FIRE', payload: { positionId: 'A1' } });
 *   const cmds = commandBus.drain(); // called by LockstepEngine each tick
 */

export type Command =
  | { type: 'OPEN_PANEL'; panel: string }
  | { type: 'CLOSE_PANEL' }
  | { type: 'FIRE'; payload?: any }
  | { type: 'ARM_SYSTEM' }
  | { type: 'DISARM_SYSTEM' }
  | { type: 'E_STOP' }
  | { type: 'ROLLBACK'; targetTick: number }
  | { type: 'SITE_JOIN'; siteId: string; name: string; role: 'master' | 'slave' }
  | { type: 'SITE_LEAVE'; siteId: string }
  | { type: 'REPLAY_START'; fromTick: number; toTick: number }
  | { type: 'REPLAY_STOP' }
  | { type: 'REPLAY_SPEED'; speed: number }
  | { type: 'EXPORT_LOG'; format: 'json' }
  | { type: 'IMPORT_LOG'; json: string }
  | { type: 'LOCK_STATE' }
  | { type: 'UNLOCK_STATE' }
  | { type: 'RESET_SAFETY' };

export type CommandHandler = (cmd: Command) => void;

class CommandBus {
  // Double-buffer: write to _queue, drain swaps to _drain
  private _queue: Command[] = [];
  private _drain: Command[] = [];
  private _handlers = new Map<Command['type'], CommandHandler[]>();

  /** Enqueue a command. Processed on next lockstep tick. */
  dispatch(cmd: Command): void {
    this._queue.push(cmd);
  }

  /**
   * Drain all queued commands (swap-buffer, zero-alloc steady state).
   * Called once per tick by LockstepEngine.
   */
  drain(): Command[] {
    if (this._queue.length === 0) return this._drain; // empty — reuse last drain ref
    // Swap buffers
    const tmp = this._drain;
    this._drain = this._queue;
    this._queue = tmp;
    this._queue.length = 0;
    return this._drain;
  }

  /** Register a handler for a specific command type. Returns unsubscribe fn. */
  on(type: Command['type'], handler: CommandHandler): () => void {
    let list = this._handlers.get(type);
    if (!list) {
      list = [];
      this._handlers.set(type, list);
    }
    list.push(handler);
    return () => {
      const arr = this._handlers.get(type);
      if (arr) {
        const idx = arr.indexOf(handler);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  }

  /** Apply a single command to all registered handlers. */
  apply(cmd: Command): void {
    const list = this._handlers.get(cmd.type);
    if (list) {
      for (let i = 0; i < list.length; i++) {
        list[i](cmd);
      }
    }
  }

  /** Apply all drained commands. Convenience for tick loop. */
  applyAll(cmds: Command[]): void {
    for (let i = 0; i < cmds.length; i++) {
      this.apply(cmds[i]);
    }
  }
}

export const commandBus = new CommandBus();
