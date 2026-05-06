/**
 * ─── MuxContinuityReader — Honest 32-ch Reader Bridge ──────────────
 * Adapts `MuxReaderAdapterCD4051` (16 analog channels) into the
 * `ContinuityReader` contract expected by `continuityCheckService`.
 *
 * Honest-hardware policy:
 *   • Channels 0..15 → resistance read from the dual-MUX adapter when
 *     a real reader is present. If the adapter is offline / not
 *     handshaked, returns Infinity (UNKNOWN downstream).
 *   • Channels 16..31 → ALWAYS Infinity. We do not invent data; the
 *     standard FXK16 + dual-CD4051 bench covers 16 channels. The
 *     remaining bank requires a second MUX pair, which is not yet
 *     wired in the verified hardware roster.
 *   • `resolveContinuityReader()` returns null when the MUX adapter
 *     has no live provenance — caller must then run the service
 *     without a reader, which yields 32× UNKNOWN.
 *
 * READ-ONLY. Never imports uiCommandGateway, fieldBus, executor or
 * SafetyStateMachine.transition.
 */

import type { ContinuityReader } from './ContinuityCheckService';
import { muxReaderAdapter } from '@/core/hardware/adapters/MuxReaderAdapterCD4051';

const LIVE_PIN_COUNT = 16;

export interface ContinuityReaderProvenance {
  /** 'live_read_only' | 'simulated' | 'not_integrated' */
  mode: 'live_read_only' | 'simulated' | 'not_integrated';
  source: string;
}

export class MuxContinuityReader implements ContinuityReader {
  /** Read resistance for `pin`. Pins ≥16 always return Infinity (no truth source). */
  async readContinuity(pin: number): Promise<number> {
    if (pin < 0 || pin >= LIVE_PIN_COUNT) return Number.POSITIVE_INFINITY;
    try {
      const channels = muxReaderAdapter.getAllChannels();
      const cell = channels[pin];
      if (!cell) return Number.POSITIVE_INFINITY;
      const ohms = Number(cell.resistance_ohms);
      // adapter default 9999 means "not yet sampled" — treat honestly.
      if (!Number.isFinite(ohms) || ohms >= 9000) return Number.POSITIVE_INFINITY;
      return ohms;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }
}

/**
 * Resolve an active reader if the MUX adapter is live-read-only.
 * Returns null when the adapter has not handshaked — service then
 * falls back to honest UNKNOWN per honest-hardware policy.
 */
export function resolveContinuityReader(): ContinuityReader | null {
  try {
    const prov = muxReaderAdapter.getProvenance();
    const mode = prov?.integration_mode;
    if (mode === 'live_read_only') {
      return new MuxContinuityReader();
    }
  } catch {
    /* adapter import side-effects in tests — fall through */
  }
  return null;
}

export function getReaderProvenance(): ContinuityReaderProvenance {
  try {
    const prov = muxReaderAdapter.getProvenance();
    const mode = prov?.integration_mode;
    if (mode === 'live_read_only') return { mode: 'live_read_only', source: 'CD4051×2 dual-MUX' };
    if (mode === 'simulated') return { mode: 'simulated', source: 'CD4051×2 (sim)' };
  } catch { /* */ }
  return { mode: 'not_integrated', source: 'no MUX reader' };
}

/** Single shared instance — cheap (no internal state). */
export const muxContinuityReader = new MuxContinuityReader();
