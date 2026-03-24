/**
 * ─── Execution Bridge ───────────────────────────────────────────────
 * Timeline → real-world command dispatcher.
 * Iterates cues, applies pre-fire compensation, dispatches to
 * PyroExecutor / DroneExecutor / DMX subsystems.
 * Every command is logged to BlackBox.
 */

import { blackbox } from '@/core/reliability/blackBoxRecorder';
import { latencyCompensator } from '@/core/sync/latencyCompensator';
import { pyroExecutor, type PyroCue } from './pyroExecutor';
import { droneExecutor, type DroneWaypoint } from './droneExecutor';
import { fieldBus } from '@/core/network/fieldBus';

export interface TimelineCue {
  id: string;
  type: 'pyro' | 'drone' | 'dmx';
  time: number;          // seconds
  data: PyroCue | DroneWaypoint | DmxCommand;
  fired?: boolean;
}

export interface DmxCommand {
  universe: number;
  channel: number;
  value: number;
}

export interface BridgeStats {
  totalCues: number;
  firedCues: number;
  pendingCues: number;
  lastTickTime: number;
}

class ExecutionBridge {
  private _cues: TimelineCue[] = [];
  private _armed = false;
  private _activeSiteId: string | null = null;
  private _stats: BridgeStats = { totalCues: 0, firedCues: 0, pendingCues: 0, lastTickTime: 0 };

  /** Load timeline cues for execution. Resets fired state. */
  loadTimeline(cues: TimelineCue[]): void {
    this._cues = cues.map(c => ({ ...c, fired: false }));
    this._stats.totalCues = cues.length;
    this._stats.firedCues = 0;
    this._stats.pendingCues = cues.length;
    blackbox.record('state', `ExecutionBridge: loaded ${cues.length} cues`);
  }

  /** ARM the bridge for live execution. */
  arm(): void {
    this._armed = true;
    blackbox.record('state', 'ExecutionBridge: ARMED');
  }

  /** SAFE — disarm, no commands will be sent. */
  disarm(): void {
    this._armed = false;
    blackbox.record('state', 'ExecutionBridge: DISARMED');
  }

  isArmed(): boolean { return this._armed; }

  /** Set the active site ID for latency compensation. */
  setSiteId(siteId: string | null): void {
    this._activeSiteId = siteId;
    blackbox.record('state', `ExecutionBridge: site=${siteId ?? 'none'}`);
  }

  getSiteId(): string | null { return this._activeSiteId; }

  /**
   * Tick the bridge at current simulation time.
   * Dispatches any cues whose adjusted time has been reached.
   */
  tick(simTime: number): void {
    if (!this._armed) return;
    this._stats.lastTickTime = simTime;

    for (let i = 0; i < this._cues.length; i++) {
      const cue = this._cues[i];
      if (cue.fired) continue;

      switch (cue.type) {
        case 'pyro': {
          const pyroCue = cue.data as PyroCue;
          if (pyroExecutor.shouldFire(pyroCue, simTime)) {
            pyroExecutor.fire(pyroCue, fieldBus);
            cue.fired = true;
            this._stats.firedCues++;
            this._stats.pendingCues--;
            blackbox.record('fire', `PYRO ${cue.id} @ ${simTime.toFixed(3)}s`, { cueId: cue.id });
          }
          break;
        }
        case 'drone': {
          const wp = cue.data as DroneWaypoint;
          if (simTime >= wp.time) {
            droneExecutor.sendWaypoint(wp, fieldBus);
            cue.fired = true;
            this._stats.firedCues++;
            this._stats.pendingCues--;
            blackbox.record('drone', `DRONE WP ${cue.id} @ ${simTime.toFixed(3)}s`, { cueId: cue.id });
          }
          break;
        }
        case 'dmx': {
          if (simTime >= cue.time) {
            const cmd = cue.data as DmxCommand;
            fieldBus.send({ type: 'dmx', payload: cmd });
            cue.fired = true;
            this._stats.firedCues++;
            this._stats.pendingCues--;
            blackbox.record('cmd', `DMX U${cmd.universe} CH${cmd.channel}=${cmd.value}`, { cueId: cue.id });
          }
          break;
        }
      }
    }
  }

  /** Reset all cues to unfired. */
  reset(): void {
    for (const c of this._cues) c.fired = false;
    this._stats.firedCues = 0;
    this._stats.pendingCues = this._stats.totalCues;
    blackbox.record('state', 'ExecutionBridge: RESET');
  }

  getStats(): Readonly<BridgeStats> { return this._stats; }
}

export const executionBridge = new ExecutionBridge();
