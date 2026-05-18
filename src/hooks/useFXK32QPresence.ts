/**
 * useFXK32QPresence — honest read-only presence/state for the FXK32Q
 * controller. Combines three independent honest signals:
 *
 *   1. deviceAggregator (via useActiveControllers) — is there a
 *      PhysicalDevice online whose family resolves to kind 'fxk32q'?
 *   2. fxk32qModuleAdapter.getConnectionState() — did the FXK32Q
 *      handshake reach 'connected'? (promoted by discoveryRegistryBridge
 *      after `MODEL:FXK32Q;CH:32`).
 *   3. fxk32qModuleAdapter.getProvenance() — is integration_mode
 *      verified (`live_read_only`/`live_read_write`) so the data we
 *      surface isn't simulated?
 *
 * Polling 1s for adapter snapshot (no events on the adapter); device
 * list is reactive (aggregator subscription via useActiveControllers).
 *
 * NEVER mutates SafetyStateMachine / FieldBus / workMode. Pure observer.
 * Mocks/simulator paths are intentionally NOT considered "present".
 */
import { useEffect, useRef, useState } from 'react';
import { useActiveControllers } from '@/hooks/useActiveControllers';
import { fxk32qModuleAdapter } from '@/core/hardware/adapters/FXK32QModuleAdapter';
import { isProvenanceVerified } from '@/core/hardware/provenance';
import type { PhysicalDevice } from '@/core/discovery/types';

export type FXK32QPresenceReason =
  | 'no-device'             // aggregator has no online fxk32q
  | 'device-only'           // device online but adapter not connected
  | 'connected-unverified'  // adapter connected but provenance simulated
  | 'present';              // device + adapter connected + provenance verified

export interface FXK32QPresence {
  /** Strongest honest signal: device + adapter handshake + verified provenance. */
  present: boolean;
  /** Aggregator says a recognised FXK32Q PhysicalDevice is online. */
  deviceOnline: boolean;
  /** Adapter handshake confirmed (`MODEL:FXK32Q;CH:32`). */
  adapterConnected: boolean;
  /** Adapter provenance is `live_read_only` or `live_read_write`. */
  provenanceVerified: boolean;
  /** Discriminated reason useful for UI badges/diagnostics. */
  reason: FXK32QPresenceReason;
  /** Underlying PhysicalDevice when available. */
  device?: PhysicalDevice;
}

interface AdapterSnapshot {
  connected: boolean;
  verified: boolean;
}

function readAdapter(): AdapterSnapshot {
  const conn = fxk32qModuleAdapter.getConnectionState() === 'connected';
  const verified = isProvenanceVerified(fxk32qModuleAdapter.getProvenance());
  return { connected: conn, verified };
}

export function useFXK32QPresence(pollMs: number = 1000): FXK32QPresence {
  const { controllers } = useActiveControllers();
  const fxk = controllers.find((c) => c.profile.kind === 'fxk32q');
  const deviceOnline = !!fxk;

  const [snap, setSnap] = useState<AdapterSnapshot>(() => readAdapter());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      const next = readAdapter();
      setSnap((prev) =>
        prev.connected === next.connected && prev.verified === next.verified ? prev : next
      );
    }, Math.max(250, pollMs));
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [pollMs]);

  const present = deviceOnline && snap.connected && snap.verified;
  const reason: FXK32QPresenceReason = !deviceOnline
    ? 'no-device'
    : !snap.connected
      ? 'device-only'
      : !snap.verified
        ? 'connected-unverified'
        : 'present';

  return {
    present,
    deviceOnline,
    adapterConnected: snap.connected,
    provenanceVerified: snap.verified,
    reason,
    device: fxk?.device,
  };
}
