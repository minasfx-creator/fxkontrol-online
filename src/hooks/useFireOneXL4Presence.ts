/**
 * useFireOneXL4Presence — honest read-only presence/state for the
 * FireOne XL4+ master controller. Mirrors `useFXK32QPresence` and
 * combines three independent honest signals:
 *
 *   1. deviceAggregator (via useActiveControllers) — is there a
 *      PhysicalDevice online whose family resolves to kind 'fireone'?
 *   2. fireOneXL4Adapter.getConnectionState() — did the wizard
 *      handshake reach 'connected' (promoted by discoveryRegistryBridge
 *      after a verified IDENTIFY+firmware reply)?
 *   3. fireOneXL4Adapter.getProvenance() — is integration_mode
 *      verified (`live_read_only`/`live_read_write`)?
 *
 * Polling 1s on the adapter snapshot (no events). Aggregator is
 * reactive via useActiveControllers subscription.
 *
 * NEVER mutates SafetyStateMachine / FieldBus / workMode. Pure observer.
 * Mocks/simulator paths are intentionally NOT considered "present".
 */
import { useEffect, useRef, useState } from 'react';
import { useActiveControllers } from '@/hooks/useActiveControllers';
import { fireOneXL4Adapter } from '@/core/hardware/adapters/FireOneXL4Adapter';
import { isProvenanceVerified } from '@/core/hardware/provenance';
import type { PhysicalDevice } from '@/core/discovery/types';

export type FireOneXL4PresenceReason =
  | 'no-device'
  | 'device-only'
  | 'connected-unverified'
  | 'present';

export interface FireOneXL4Presence {
  present: boolean;
  deviceOnline: boolean;
  adapterConnected: boolean;
  provenanceVerified: boolean;
  reason: FireOneXL4PresenceReason;
  device?: PhysicalDevice;
  /** Wizard-confirmed firmware string (e.g. '5.00.08'). */
  firmware: string | null;
  /** Module address from STATUS reply. */
  moduleAddress: number | null;
  /** Baud the wizard authorized at. */
  baudRate: number | null;
}

interface AdapterSnapshot {
  connected: boolean;
  verified: boolean;
  firmware: string | null;
  moduleAddress: number | null;
  baudRate: number | null;
}

function readAdapter(): AdapterSnapshot {
  return {
    connected: fireOneXL4Adapter.getConnectionState() === 'connected',
    verified: isProvenanceVerified(fireOneXL4Adapter.getProvenance()),
    firmware: fireOneXL4Adapter.getFirmware(),
    moduleAddress: fireOneXL4Adapter.getModuleAddress(),
    baudRate: fireOneXL4Adapter.getBaudRate(),
  };
}

export function useFireOneXL4Presence(pollMs: number = 1000): FireOneXL4Presence {
  const { controllers } = useActiveControllers();
  const fireOne = controllers.find((c) => c.profile.kind === 'fireone');
  const deviceOnline = !!fireOne;

  const [snap, setSnap] = useState<AdapterSnapshot>(() => readAdapter());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      const next = readAdapter();
      setSnap((prev) =>
        prev.connected === next.connected
        && prev.verified === next.verified
        && prev.firmware === next.firmware
        && prev.moduleAddress === next.moduleAddress
        && prev.baudRate === next.baudRate
          ? prev
          : next,
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
  const reason: FireOneXL4PresenceReason = !deviceOnline
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
    device: fireOne?.device,
    firmware: snap.firmware,
    moduleAddress: snap.moduleAddress,
    baudRate: snap.baudRate,
  };
}
