/**
 * ─── Real-Only Emission Gate ───────────────────────────────────────
 * Central choke-point that decides whether a telemetry snapshot or a
 * device event is allowed to reach the UI / store.
 *
 * Policy (when `real_only_mode` is ON, which is the default):
 *   • A device is "integrated" only if its provenance is
 *     `live_read_only` (real handshake) or `replay`.
 *   • Snapshots / telemetry events from `not_integrated` or `simulated`
 *     adapters are silently dropped and counted.
 *   • Lifecycle events (connected/disconnected/state_change) are
 *     ALWAYS allowed — operators must see connection attempts.
 *
 * Policy (when `real_only_mode` is OFF):
 *   • Everything passes (legacy behavior).
 *
 * Adapters call `markHandshakeOk(provenance)` from `provenance.ts`
 * after the device responds; only then do their snapshots flow.
 */

import type { ProvenanceInfo } from './provenance';
import type { DeviceEvent } from './types';
import { isProvenanceVerified } from './provenance';
import { isRealOnlyMode } from '@/lib/featureFlags';

interface GateStats {
  rejectedSnapshots: number;
  rejectedEvents: number;
  acceptedSnapshots: number;
  acceptedEvents: number;
  lastRejectedDeviceId: string | null;
  lastRejectedAt: number;
}

class RealOnlyGate {
  private _stats: GateStats = {
    rejectedSnapshots: 0,
    rejectedEvents: 0,
    acceptedSnapshots: 0,
    acceptedEvents: 0,
    lastRejectedDeviceId: null,
    lastRejectedAt: 0,
  };
  /** Provenance lookup so the gate can validate event emissions by deviceId. */
  private _provenanceLookup: ((deviceId: string) => ProvenanceInfo | undefined) | null = null;

  /** Wire the registry so the gate can resolve provenance for events. */
  registerProvenanceLookup(fn: (deviceId: string) => ProvenanceInfo | undefined): void {
    this._provenanceLookup = fn;
  }

  /** Should a snapshot from this provenance be accepted? */
  acceptSnapshot(prov: ProvenanceInfo, deviceId: string): boolean {
    if (!isRealOnlyMode()) {
      this._stats.acceptedSnapshots++;
      return true;
    }
    if (isProvenanceVerified(prov)) {
      this._stats.acceptedSnapshots++;
      return true;
    }
    this._stats.rejectedSnapshots++;
    this._stats.lastRejectedDeviceId = deviceId;
    this._stats.lastRejectedAt = Date.now();
    return false;
  }

  /**
   * Should this device event be accepted?
   * Lifecycle events always pass; only data-bearing types (`telemetry`,
   * `state_change` carrying values) are gated when device is unverified.
   */
  acceptEvent(event: Pick<DeviceEvent, 'device_id' | 'type'>): boolean {
    if (!isRealOnlyMode()) {
      this._stats.acceptedEvents++;
      return true;
    }
    // Always allow lifecycle / safety events so operators see connect attempts.
    if (event.type !== 'telemetry') {
      this._stats.acceptedEvents++;
      return true;
    }
    const prov = this._provenanceLookup?.(event.device_id);
    if (prov && isProvenanceVerified(prov)) {
      this._stats.acceptedEvents++;
      return true;
    }
    this._stats.rejectedEvents++;
    this._stats.lastRejectedDeviceId = event.device_id;
    this._stats.lastRejectedAt = Date.now();
    return false;
  }

  getStats(): Readonly<GateStats> { return { ...this._stats }; }

  resetStats(): void {
    this._stats = {
      rejectedSnapshots: 0,
      rejectedEvents: 0,
      acceptedSnapshots: 0,
      acceptedEvents: 0,
      lastRejectedDeviceId: null,
      lastRejectedAt: 0,
    };
  }
}

export const realOnlyGate = new RealOnlyGate();
