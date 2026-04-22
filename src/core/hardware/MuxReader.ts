/**
 * ─── CD4051 Multiplexer Reader ──────────────────────────────────────
 * Interface for CD4051 8-channel analog multiplexer.
 * Used to read continuity (ohms) from 8 channels via single ADC pin.
 *
 * Hardware: 2x CD4051 = 16 analog inputs, read via Arduino Nano ADC
 * Select lines: S0, S1, S2 (3 GPIO pins per mux)
 */

import { blackbox } from '@/core/reliability/blackBoxRecorder';

export interface MuxTransport {
  /** Select channel and read ADC value (0-1023). */
  readChannel(muxId: number, channel: number): Promise<number>;
  isConnected(): boolean;
}

/** Emulated mux: returns realistic resistance values. */
class EmulatedMuxTransport implements MuxTransport {
  private _values = new Float32Array(16).fill(25); // ~25Ω = OK igniter

  async readChannel(muxId: number, channel: number): Promise<number> {
    const idx = muxId * 8 + channel;
    // Simulate ADC value from resistance (voltage divider formula)
    const ohms = this._values[idx];
    // ADC = (R_sense / (R_sense + R_ref)) * 1023
    return Math.round((ohms / (ohms + 100)) * 1023);
  }

  isConnected(): boolean { return true; }

  /** Set simulated resistance for a channel (testing). */
  setResistance(muxId: number, channel: number, ohms: number): void {
    this._values[muxId * 8 + channel] = ohms;
  }
}

class MuxReader {
  private _transport: MuxTransport;
  private _muxCount = 2;     // 2x CD4051
  private _channelsPerMux = 8;
  private _refResistance = 100; // Reference resistor (ohms)
  private _lastReadings = new Float32Array(16);

  constructor() {
    this._transport = new EmulatedMuxTransport();
  }

  setTransport(transport: MuxTransport): void {
    this._transport = transport;
    blackbox.record('hw', `MuxReader: transport set (connected: ${transport.isConnected()})`);
  }

  /** Read resistance (ohms) from a specific mux channel. */
  async readOhms(muxId: number, channel: number): Promise<number> {
    if (muxId >= this._muxCount || channel >= this._channelsPerMux) return -1;

    const adc = await this._transport.readChannel(muxId, channel);
    // Convert ADC → resistance via voltage divider
    const ohms = adc > 0 ? (this._refResistance * adc) / (1023 - adc) : 99999;
    const idx = muxId * this._channelsPerMux + channel;
    this._lastReadings[idx] = ohms;
    return ohms;
  }

  /** Read all channels sequentially. Returns array of ohm values. */
  async readAll(): Promise<Float32Array> {
    for (let m = 0; m < this._muxCount; m++) {
      for (let c = 0; c < this._channelsPerMux; c++) {
        await this.readOhms(m, c);
      }
    }
    return this._lastReadings;
  }

  getLastReadings(): Readonly<Float32Array> { return this._lastReadings; }
  isConnected(): boolean { return this._transport.isConnected(); }
  get totalChannels(): number { return this._muxCount * this._channelsPerMux; }
}

export const muxReader = new MuxReader();
