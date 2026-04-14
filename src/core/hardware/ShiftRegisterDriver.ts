/**
 * ─── 74HC595 Shift Register Driver ──────────────────────────────────
 * Interface for 74HC595 serial-in, parallel-out shift register chain.
 * Used to expand Arduino Nano 8 outputs → 32+ digital outputs.
 *
 * Hardware: 4x 74HC595 daisy-chained (32 outputs)
 * Protocol: SPI-like (DATA, CLOCK, LATCH)
 * Transport: WebSerial (real) or Emulator (simulation)
 */

import { blackbox } from '@/core/reliability/blackBoxRecorder';

export interface ShiftRegisterTransport {
  /** Write raw bytes to the shift register chain via serial. */
  write(bytes: Uint8Array): Promise<boolean>;
  isConnected(): boolean;
}

/** Emulated transport for simulation mode. */
class EmulatedShiftRegister implements ShiftRegisterTransport {
  private _state = new Uint8Array(4); // 4 chips × 8 bits = 32 outputs

  async write(bytes: Uint8Array): Promise<boolean> {
    this._state.set(bytes.subarray(0, 4));
    return true;
  }

  isConnected(): boolean { return true; }

  getState(): Uint8Array { return this._state; }
}

class ShiftRegisterDriver {
  private _transport: ShiftRegisterTransport;
  private _state = new Uint8Array(4); // 32 output bits
  private _chipCount = 4;

  constructor() {
    this._transport = new EmulatedShiftRegister();
  }

  /** Attach real hardware transport (WebSerial). */
  setTransport(transport: ShiftRegisterTransport): void {
    this._transport = transport;
    blackbox.record('hw', `ShiftRegister: transport set (connected: ${transport.isConnected()})`);
  }

  /** Set a single output pin (0–31) HIGH or LOW. */
  async setPin(pin: number, high: boolean): Promise<boolean> {
    if (pin < 0 || pin >= this._chipCount * 8) return false;

    const byteIdx = Math.floor(pin / 8);
    const bitIdx = pin % 8;

    if (high) {
      this._state[byteIdx] |= (1 << bitIdx);
    } else {
      this._state[byteIdx] &= ~(1 << bitIdx);
    }

    return this._flush();
  }

  /** Set all 32 outputs at once from a bitmask. */
  async setAll(mask: number): Promise<boolean> {
    this._state[0] = mask & 0xFF;
    this._state[1] = (mask >> 8) & 0xFF;
    this._state[2] = (mask >> 16) & 0xFF;
    this._state[3] = (mask >> 24) & 0xFF;
    return this._flush();
  }

  /** Clear all outputs (all LOW). */
  async clearAll(): Promise<boolean> {
    this._state.fill(0);
    return this._flush();
  }

  /** Get current pin state. */
  getPin(pin: number): boolean {
    const byteIdx = Math.floor(pin / 8);
    const bitIdx = pin % 8;
    return (this._state[byteIdx] & (1 << bitIdx)) !== 0;
  }

  getState(): Readonly<Uint8Array> { return this._state; }
  isConnected(): boolean { return this._transport.isConnected(); }

  private async _flush(): Promise<boolean> {
    const ok = await this._transport.write(this._state);
    if (!ok) {
      blackbox.record('emergency', 'ShiftRegister: write failed');
    }
    return ok;
  }
}

export const shiftRegisterDriver = new ShiftRegisterDriver();
