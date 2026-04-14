/**
 * ─── Relay Bank Controller ──────────────────────────────────────────
 * Controls a 32-channel relay board via 74HC595 shift registers.
 * Each relay = one pyro firing channel.
 *
 * Hardware: 32-relay board, driven by 4x 74HC595
 * Safety: All relays default OFF. Arm/fire requires explicit enable.
 * Power: 12V battery via separate power bus (logic ≠ power).
 */

import { shiftRegisterDriver } from './ShiftRegisterDriver';
import { blackbox } from '@/core/reliability/blackBoxRecorder';

export type RelayState = 'OFF' | 'ARMED' | 'FIRING' | 'FIRED';

export interface RelayChannelStatus {
  channel: number;
  state: RelayState;
  firedAt: number | null;
  armDuration: number;  // ms armed before fire
}

class RelayBankController {
  private _channels: RelayChannelStatus[] = [];
  private _armed = false;
  private _totalChannels = 32;

  constructor() {
    this._initChannels();
  }

  private _initChannels(): void {
    this._channels = Array.from({ length: this._totalChannels }, (_, i) => ({
      channel: i,
      state: 'OFF',
      firedAt: null,
      armDuration: 0,
    }));
  }

  /** ARM all channels (pre-condition for fire). */
  armAll(): void {
    if (this._armed) return;
    this._armed = true;
    const now = Date.now();
    for (const ch of this._channels) {
      if (ch.state === 'OFF') {
        ch.state = 'ARMED';
        ch.armDuration = now;
      }
    }
    blackbox.record('hw', `RelayBank: ALL ARMED (${this._totalChannels} channels)`);
  }

  /** DISARM all channels immediately. */
  disarmAll(): void {
    this._armed = false;
    shiftRegisterDriver.clearAll();
    for (const ch of this._channels) {
      if (ch.state === 'ARMED') ch.state = 'OFF';
    }
    blackbox.record('hw', 'RelayBank: ALL DISARMED');
  }

  /** Fire a single channel. Returns false if channel is not ARMED. */
  async fire(channel: number, pulseDurationMs = 50): Promise<boolean> {
    if (channel < 0 || channel >= this._totalChannels) return false;
    const ch = this._channels[channel];
    if (ch.state !== 'ARMED') {
      blackbox.record('emergency', `RelayBank: FIRE DENIED ch${channel} (state: ${ch.state})`);
      return false;
    }

    ch.state = 'FIRING';
    ch.firedAt = Date.now();

    // Pulse the shift register pin HIGH
    await shiftRegisterDriver.setPin(channel, true);

    // Auto-off after pulse duration (safety: never leave relay energized)
    setTimeout(async () => {
      await shiftRegisterDriver.setPin(channel, false);
      ch.state = 'FIRED';
      blackbox.record('fire', `RelayBank: ch${channel} FIRED (pulse: ${pulseDurationMs}ms)`);
    }, pulseDurationMs);

    return true;
  }

  /** Reset all channels to OFF. */
  reset(): void {
    this._armed = false;
    shiftRegisterDriver.clearAll();
    this._initChannels();
    blackbox.record('hw', 'RelayBank: RESET');
  }

  /** Get status of all channels. */
  getChannels(): Readonly<RelayChannelStatus[]> { return this._channels; }

  /** Get single channel status. */
  getChannel(idx: number): Readonly<RelayChannelStatus> | null {
    return this._channels[idx] ?? null;
  }

  isArmed(): boolean { return this._armed; }
  get totalChannels(): number { return this._totalChannels; }

  /** Count channels by state. */
  getStats(): Record<RelayState, number> {
    const stats: Record<RelayState, number> = { OFF: 0, ARMED: 0, FIRING: 0, FIRED: 0 };
    for (const ch of this._channels) stats[ch.state]++;
    return stats;
  }
}

export const relayBankController = new RelayBankController();
