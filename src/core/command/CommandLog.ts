/**
 * ─── Command Log ────────────────────────────────────────────────────
 * Records every command with its tick number for deterministic replay.
 * Ring buffer with configurable max size to bound memory.
 */

import type { Command } from './CommandBus';

export interface LogEntry {
  tick: number;
  cmd: Command;
  ts: number; // wall-clock ms for diagnostics
}

const MAX_LOG = 60_000; // ~16 min at 60Hz

class CommandLog {
  private _log: LogEntry[] = [];
  private _enabled = true;

  /** Record a command at a given tick. */
  record(tick: number, cmd: Command): void {
    if (!this._enabled) return;
    this._log.push({ tick, cmd, ts: performance.now() });
    // Trim oldest if over limit
    if (this._log.length > MAX_LOG) {
      this._log.splice(0, this._log.length - MAX_LOG);
    }
  }

  /** Record multiple commands for the same tick. */
  recordAll(tick: number, cmds: Command[]): void {
    for (let i = 0; i < cmds.length; i++) {
      this.record(tick, cmds[i]);
    }
  }

  /** Get all entries. */
  getLog(): readonly LogEntry[] {
    return this._log;
  }

  /** Get entries in [fromTick, toTick] inclusive. */
  slice(fromTick: number, toTick: number): LogEntry[] {
    return this._log.filter(e => e.tick >= fromTick && e.tick <= toTick);
  }

  /** Get commands grouped by tick for a range. */
  groupedSlice(fromTick: number, toTick: number): Map<number, Command[]> {
    const map = new Map<number, Command[]>();
    for (const entry of this._log) {
      if (entry.tick < fromTick) continue;
      if (entry.tick > toTick) break;
      let arr = map.get(entry.tick);
      if (!arr) {
        arr = [];
        map.set(entry.tick, arr);
      }
      arr.push(entry.cmd);
    }
    return map;
  }

  /** Total entry count. */
  get length(): number {
    return this._log.length;
  }

  /** Latest tick recorded, or -1. */
  get lastTick(): number {
    return this._log.length > 0 ? this._log[this._log.length - 1].tick : -1;
  }

  /** Discard entries after a tick (for rollback). */
  truncateAfter(tick: number): number {
    const before = this._log.length;
    // Binary-ish search from end since log is ordered
    let i = this._log.length - 1;
    while (i >= 0 && this._log[i].tick > tick) i--;
    this._log.length = i + 1;
    return before - this._log.length;
  }

  clear(): void {
    this._log.length = 0;
  }

  setEnabled(on: boolean): void {
    this._enabled = on;
  }

  /** Export as JSON string. */
  exportJSON(): string {
    return JSON.stringify(this._log);
  }

  /** Import from JSON string. Replaces current log. */
  importJSON(json: string): void {
    this._log = JSON.parse(json);
  }
}

export const commandLog = new CommandLog();
