/**
 * ─── Pyro Executor ──────────────────────────────────────────────────
 * Deterministic pyro fire engine with pre-fire delay compensation.
 * Stateless dispatcher: given cue + simTime → fire or not.
 * Offline fallback: buffers commands if fieldBus is down.
 */

import { blackbox } from '@/core/reliability/blackBoxRecorder';
import { type FieldBus, type TransportMessage } from '@/core/network/fieldBus';

export interface PyroCue {
  id: string;
  moduleAddress: number;
  channel: number;
  fireTime: number;       // seconds — scheduled time from timeline
  preFireDelay: number;   // seconds — compensation for igniter latency
  duration: number;       // seconds — firing pulse duration
  effectId: string;
}

class PyroExecutor {

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
    if (!Number.isInteger(cue.moduleAddress) || cue.moduleAddress < 0) {
      blackbox.record('emergency', `PYRO FIRE DENIED invalid module=${cue.moduleAddress}`, { cueId: cue.id });
      return false;
    }
    if (!Number.isInteger(cue.channel) || cue.channel < 0 || cue.channel > 31) {
      blackbox.record('emergency', `PYRO FIRE DENIED invalid channel=${cue.channel}`, { cueId: cue.id });
      return false;
    }
    if (!Number.isFinite(cue.duration) || cue.duration <= 0 || cue.duration > 10) {
      blackbox.record('emergency', `PYRO FIRE DENIED invalid duration=${cue.duration}`, { cueId: cue.id });
      return false;
    }

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

    // Safety-critical: pyro FIRE is a single-intent, time-bound command.
    // Never buffer/replay it after a transport outage; late ignition is worse
    // than a clearly failed command. The operator must explicitly re-issue.
    blackbox.record('emergency', `PYRO FIRE FAILED (not buffered) mod=${cue.moduleAddress} ch=${cue.channel}`, { cueId: cue.id });
    return false;
  }

  /** Retained for compatibility; destructive cues are no longer replayed. */
  flushBuffer(_bus: FieldBus): number { return 0; }

  getBufferSize(): number { return 0; }

  clearBuffer(): void { /* no-op: pyro queue intentionally disabled */ }
}

export const pyroExecutor = new PyroExecutor();
