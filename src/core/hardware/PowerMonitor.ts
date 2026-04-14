/**
 * ─── Power Monitor — 12V Battery Monitoring ─────────────────────────
 * Reads battery voltage/current via CD4051 mux channel.
 * Estimates State of Charge (SOC) and alerts on low voltage.
 *
 * Hardware: 12V SLA/LiFePO4 battery, voltage divider to ADC,
 *           ACS712 current sensor on dedicated mux channel.
 */

import { muxReader } from './MuxReader';
import { blackbox } from '@/core/reliability/blackBoxRecorder';

export interface PowerStatus {
  voltage: number;         // V
  current: number;         // A (estimated)
  socPercent: number;      // 0–100
  isLow: boolean;          // < 11.5V
  isCritical: boolean;     // < 10.8V
  lastUpdate: number;
}

// Voltage divider: 12V → 3.3V via 10k/4.7k divider
const DIVIDER_RATIO = (10 + 4.7) / 4.7; // ≈ 3.128
const ADC_REF_V = 3.3;
const ADC_MAX = 1023;

// SLA 12V SOC curve (linear approx)
const V_FULL = 12.7;
const V_EMPTY = 10.5;

class PowerMonitor {
  private _status: PowerStatus = {
    voltage: 12.6,
    current: 0,
    socPercent: 95,
    isLow: false,
    isCritical: false,
    lastUpdate: Date.now(),
  };

  private _voltageMuxId = 1;    // Second CD4051
  private _voltageChannel = 6;  // Channel 6 for voltage
  private _currentChannel = 7;  // Channel 7 for current sensor
  private _pollInterval: ReturnType<typeof setInterval> | null = null;

  /** Start periodic monitoring. */
  startMonitoring(intervalMs = 2000): void {
    if (this._pollInterval) return;
    this._pollInterval = setInterval(() => this._poll(), intervalMs);
    blackbox.record('hw', 'PowerMonitor: monitoring started');
  }

  stopMonitoring(): void {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  private async _poll(): Promise<void> {
    try {
      // Read voltage via mux
      const vAdc = await muxReader.readOhms(this._voltageMuxId, this._voltageChannel);
      // Convert ADC reading to voltage (vAdc here is raw resistance; in real HW, read raw ADC)
      const rawV = (vAdc / ADC_MAX) * ADC_REF_V * DIVIDER_RATIO;
      const voltage = Math.max(0, Math.min(15, rawV || this._status.voltage));

      // Read current sensor (ACS712: 185mV/A, 2.5V offset at 0A)
      const iAdc = await muxReader.readOhms(this._voltageMuxId, this._currentChannel);
      const iVoltage = (iAdc / ADC_MAX) * ADC_REF_V;
      const current = Math.max(0, (iVoltage - 2.5) / 0.185);

      // SOC estimation
      const socPercent = Math.round(Math.max(0, Math.min(100,
        ((voltage - V_EMPTY) / (V_FULL - V_EMPTY)) * 100
      )));

      const isLow = voltage < 11.5;
      const isCritical = voltage < 10.8;

      this._status = { voltage, current, socPercent, isLow, isCritical, lastUpdate: Date.now() };

      if (isCritical) {
        blackbox.record('emergency', `PowerMonitor: CRITICAL ${voltage.toFixed(1)}V`);
      } else if (isLow) {
        blackbox.record('hw', `PowerMonitor: LOW ${voltage.toFixed(1)}V (${socPercent}%)`);
      }
    } catch {
      // Keep last known state on read failure
    }
  }

  getStatus(): Readonly<PowerStatus> { return this._status; }

  /** Manual voltage override (for testing/simulation). */
  setSimulatedVoltage(v: number): void {
    const socPercent = Math.round(Math.max(0, Math.min(100,
      ((v - V_EMPTY) / (V_FULL - V_EMPTY)) * 100
    )));
    this._status = {
      voltage: v,
      current: 0,
      socPercent,
      isLow: v < 11.5,
      isCritical: v < 10.8,
      lastUpdate: Date.now(),
    };
  }
}

export const powerMonitor = new PowerMonitor();
