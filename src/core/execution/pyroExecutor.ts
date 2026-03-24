/**
 * ─── Pyro Executor ──────────────────────────────────────────────────
 * Deterministic pyro fire engine with pre-fire delay compensation.
 * Stateless dispatcher: given cue + simTime → fire or not.
 * Offline fallback: buffers commands if fieldBus is down.
 */

import { blackbox } from '@/core/reliability';
import { type FieldBus, type TransportMessage, fieldBus as defaultBus } from '@/core/network/fieldBus';

export interface PyroCue {
  id: string;
  moduleAddress: number;
  channel: number;
  fireTime: number;       // seconds — scheduled time from timeline
  preFireDelay: number;   // seconds — compensation for igniter latency
  duration: number;       // seconds — firing pulse duration
  effectId: string;
}

const LOCAL_BUFFER_MAX = 256;

class PyroExecutor {
  private _localBuffer: PyroCue[] = [];

  /**
   * Check if a cue should fire at the given simulation time.
   * Accounts for pre-fire delay compensation.
   */
  shouldFire(cue: PyroCue, simTime: number): boolean {
    const adjustedTime = cue.fireTime - cue.preFireDelay;
    return simTime >= adjustedTime;
  }

  /** Fire a pyro cue through the field bus. */
  fire(cue: PyroCue, bus: FieldBus): boolean {
    const msg: TransportMessage = {
      type: 'pyro',
      payload: {
        module: cue.moduleAddress,
        channel: cue.channel,
        duration: cue.duration,
        effectId: cue.effectId,
      },
    };

    if (bus.isAlive()) {
      const sent = bus.send(msg);
      if (sent) {
        blackbox.record('fire', `PYRO FIRE mod=${cue.moduleAddress} ch=${cue.channel}`, {
          cueId: cue.id,
          preFireCompensation: cue.preFireDelay,
        });
        return true;
      }
    }

    // Offline fallback: buffer locally
    if (this._localBuffer.length < LOCAL_BUFFER_MAX) {
      this._localBuffer.push(cue);
      blackbox.record('fire', `PYRO BUFFERED (offline) mod=${cue.moduleAddress} ch=${cue.channel}`);
    }
    return false;
  }

  /** Execute all buffered cues (when connection restores). */
  flushBuffer(bus: FieldBus): number {
    let flushed = 0;
    while (this._localBuffer.length > 0 && bus.isAlive()) {
      const cue = this._localBuffer.shift()!;
      this.fire(cue, bus);
      flushed++;
    }
    return flushed;
  }

  getBufferSize(): number { return this._localBuffer.length; }

  clearBuffer(): void { this._localBuffer.length = 0; }
}

export const pyroExecutor = new PyroExecutor();
