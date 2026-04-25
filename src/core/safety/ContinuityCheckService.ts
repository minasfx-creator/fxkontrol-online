/**
 * ─── Continuity Check Service ──────────────────────────────────────
 * Pure kernel service (no React) for 32-channel igniter continuity.
 * Reads resistance via FireOne hardware bridge or emulator,
 * classifies channels, and updates SafetyStateMachine conditions.
 *
 * Thresholds (FireOne spec):
 *   OPEN:  > 200 Ω  (no igniter)
 *   OK:    0.5–50 Ω (igniter connected)
 *   SHORT: < 0.5 Ω  (dangerous short-circuit)
 */

import { safetyStateMachine } from './SafetyStateMachine';
import { safetyAuditTrail } from './SafetyAuditTrail';

export type PinStatus = 'UNKNOWN' | 'OK' | 'OPEN' | 'SHORT';

export interface PinResult {
  pin: number;
  ohms: number;
  status: PinStatus;
  lastChecked: number;
}

export interface ContinuityReport {
  total: number;
  ok: number;
  open: number;
  short: number;
  unknown: number;
  lastCheckTime: number;
}

/** Anything that can read continuity — hardware bridge or emulator */
export interface ContinuityReader {
  readContinuity(pin: number): Promise<number>;
}

const TOTAL_PINS = 32;
const THRESHOLD_SHORT = 0.5;   // < 0.5Ω = short
const THRESHOLD_OK_MAX = 50;   // 0.5–50Ω = OK
const THRESHOLD_OPEN = 200;    // > 200Ω = open

function classify(ohms: number): PinStatus {
  if (ohms < THRESHOLD_SHORT) return 'SHORT';
  if (ohms <= THRESHOLD_OK_MAX) return 'OK';
  // 50–200Ω marginal AND > 200Ω no-igniter both treated as OPEN for safety.
  return 'OPEN';
}

class ContinuityCheckService {
  private _pins: PinResult[] = [];
  private _lastCheckTime = 0;
  private _checking = false;

  constructor() {
    for (let i = 0; i < TOTAL_PINS; i++) {
      this._pins.push({ pin: i, ohms: Infinity, status: 'UNKNOWN', lastChecked: 0 });
    }
  }

  get isChecking(): boolean { return this._checking; }

  /** Run full 32-channel check */
  async runFullCheck(reader?: ContinuityReader): Promise<ContinuityReport> {
    this._checking = true;
    const now = Date.now();

    for (let i = 0; i < TOTAL_PINS; i++) {
      try {
        const ohms = reader
          ? await reader.readContinuity(i)
          : this._simulateRead(i);
        this._pins[i] = { pin: i, ohms, status: classify(ohms), lastChecked: now };
      } catch {
        this._pins[i] = { pin: i, ohms: Infinity, status: 'UNKNOWN', lastChecked: now };
      }
    }

    this._lastCheckTime = now;
    this._checking = false;

    const report = this.getReport();
    this._updateSafetyConditions(report);
    this._logAudit(report);
    return report;
  }

  /** Check single pin */
  async runPinCheck(pin: number, reader?: ContinuityReader): Promise<PinResult> {
    if (pin < 0 || pin >= TOTAL_PINS) throw new Error(`Invalid pin: ${pin}`);
    const now = Date.now();
    try {
      const ohms = reader
        ? await reader.readContinuity(pin)
        : this._simulateRead(pin);
      this._pins[pin] = { pin, ohms, status: classify(ohms), lastChecked: now };
    } catch {
      this._pins[pin] = { pin, ohms: Infinity, status: 'UNKNOWN', lastChecked: now };
    }
    // Recompute safety condition after single pin check
    this._updateSafetyConditions(this.getReport());
    return this._pins[pin];
  }

  /** Get aggregate report */
  getReport(): ContinuityReport {
    let ok = 0, open = 0, short = 0, unknown = 0;
    for (const p of this._pins) {
      switch (p.status) {
        case 'OK': ok++; break;
        case 'OPEN': open++; break;
        case 'SHORT': short++; break;
        default: unknown++; break;
      }
    }
    return { total: TOTAL_PINS, ok, open, short, unknown, lastCheckTime: this._lastCheckTime };
  }

  /** Get all pin results (read-only) */
  getAllPins(): readonly PinResult[] {
    return this._pins;
  }

  /** ARM requires ≥1 OK and zero SHORT */
  isPassingForArm(): boolean {
    const r = this.getReport();
    return r.ok >= 1 && r.short === 0;
  }

  /** FIRE requires specific pin OK */
  isPassingForFire(pin: number): boolean {
    return this._pins[pin]?.status === 'OK';
  }

  // ── Private ──────────────────────────────────────────────────
  private _updateSafetyConditions(report: ContinuityReport): void {
    safetyStateMachine.setConditions({
      continuityOk: report.ok >= 1 && report.short === 0,
    });
  }

  private _logAudit(report: ContinuityReport): void {
    const passing = report.ok >= 1 && report.short === 0;
    safetyAuditTrail.log({
      timestamp: Date.now(),
      tick: 0, // filled by caller if needed
      event: 'CONTINUITY_CHECK',
      from: safetyStateMachine.state,
      to: safetyStateMachine.state,
      detail: `Continuity: ${report.ok}/${report.total} OK, ${report.open} OPEN, ${report.short} SHORT — ${passing ? 'PASS' : 'FAIL'}`,
    });
  }

  /** Sim mode: deterministic pseudo-random resistances */
  private _simulateRead(pin: number): number {
    // ~60% OK, ~30% OPEN, ~10% marginal
    const seed = (pin * 7 + 13) % 32;
    if (seed < 19) return 1.5 + (seed * 2.3);     // OK range
    if (seed < 28) return 999;                      // OPEN
    return 25 + (seed * 5);                         // Marginal → OPEN
  }
}

export const continuityCheckService = new ContinuityCheckService();
