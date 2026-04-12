/**
 * ─── Manual Mode State — Key Switch & Deadman ───────────────────────
 * Models the physical safety interlocks for manual/field operation:
 * - Key switch: physical key required to enable ARM
 * - Deadman switch: must be held during FIRE sequence
 *
 * These are read via CD4051 mux digital inputs.
 */

import { blackbox } from '@/core/reliability/blackBoxRecorder';

export interface ManualModeStatus {
  keySwitchEnabled: boolean;
  deadmanHeld: boolean;
  manualModeActive: boolean;
  lastUpdate: number;
}

class ManualModeState {
  private _status: ManualModeStatus = {
    keySwitchEnabled: false,
    deadmanHeld: false,
    manualModeActive: false,
    lastUpdate: Date.now(),
  };

  /** Update key switch state (from hardware input). */
  setKeySwitch(enabled: boolean): void {
    if (this._status.keySwitchEnabled !== enabled) {
      this._status.keySwitchEnabled = enabled;
      this._status.lastUpdate = Date.now();
      blackbox.record('hw', `ManualMode: key switch ${enabled ? 'ON' : 'OFF'}`);
    }
    this._evaluateMode();
  }

  /** Update deadman switch state (from hardware input). */
  setDeadman(held: boolean): void {
    if (this._status.deadmanHeld !== held) {
      this._status.deadmanHeld = held;
      this._status.lastUpdate = Date.now();
      if (!held && this._status.manualModeActive) {
        blackbox.record('emergency', 'ManualMode: DEADMAN RELEASED during active mode');
      }
    }
    this._evaluateMode();
  }

  private _evaluateMode(): void {
    const wasActive = this._status.manualModeActive;
    this._status.manualModeActive = this._status.keySwitchEnabled && this._status.deadmanHeld;

    if (this._status.manualModeActive && !wasActive) {
      blackbox.record('state', 'ManualMode: ENGAGED (key + deadman)');
    } else if (!this._status.manualModeActive && wasActive) {
      blackbox.record('state', 'ManualMode: DISENGAGED');
    }
  }

  /** Check if firing is allowed in manual mode. */
  canFire(): boolean {
    return this._status.keySwitchEnabled && this._status.deadmanHeld;
  }

  getStatus(): Readonly<ManualModeStatus> { return this._status; }
}

export const manualModeState = new ManualModeState();
