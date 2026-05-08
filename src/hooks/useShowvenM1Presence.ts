/**
 * useShowvenM1Presence — honest read-only presence for the Showven M1
 * master controller. Mirrors `useFireOneXL4Presence` + `useFXK32QPresence`:
 *
 *   1. deviceAggregator (via useActiveControllers) — there is a
 *      PhysicalDevice online whose family resolves to kind 'showven'.
 *   2. showvenM1Adapter.getConnectionState() — wizard handshake reached
 *      'connected' (promoted by discoveryRegistryBridge).
 *   3. showvenM1Adapter.getProvenance() — verified (live_read_only).
 *
 * Pure observer — never mutates SafetyStateMachine / FieldBus / workMode.
 */
import { useEffect, useRef, useState } from 'react';
import { useActiveControllers } from '@/hooks/useActiveControllers';
import { showvenM1Adapter } from '@/core/hardware/adapters/ShowvenM1Adapter';
import { isProvenanceVerified } from '@/core/hardware/provenance';
import type { PhysicalDevice } from '@/core/discovery/types';

export type ShowvenM1PresenceReason =
  | 'no-device'
  | 'device-only'
  | 'connected-unverified'
  | 'present';

export interface ShowvenM1Presence {
  present: boolean;
  deviceOnline: boolean;
  adapterConnected: boolean;
  provenanceVerified: boolean;
  reason: ShowvenM1PresenceReason;
  device?: PhysicalDevice;
  firmware: string | null;
  masterAddress: number | null;
  baudRate: number | null;
  slavesOnline: number;
}

interface AdapterSnapshot {
  connected: boolean;
  verified: boolean;
  firmware: string | null;
  masterAddress: number | null;
  baudRate: number | null;
  slavesOnline: number;
}

function readAdapter(): AdapterSnapshot {
  return {
    connected: showvenM1Adapter.getConnectionState() === 'connected',
    verified: isProvenanceVerified(showvenM1Adapter.getProvenance()),
    firmware: showvenM1Adapter.getFirmware(),
    masterAddress: showvenM1Adapter.getMasterAddress(),
    baudRate: showvenM1Adapter.getBaudRate(),
    slavesOnline: showvenM1Adapter.getSlavesOnline(),
  };
}

export function useShowvenM1Presence(pollMs: number = 1000): ShowvenM1Presence {
  const { controllers } = useActiveControllers();
  const showven = controllers.find((c) => c.profile.kind === 'showven');
  const deviceOnline = !!showven;

  const [snap, setSnap] = useState<AdapterSnapshot>(() => readAdapter());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      const next = readAdapter();
      setSnap((prev) =>
        prev.connected === next.connected
        && prev.verified === next.verified
        && prev.firmware === next.firmware
        && prev.masterAddress === next.masterAddress
        && prev.baudRate === next.baudRate
        && prev.slavesOnline === next.slavesOnline
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
  const reason: ShowvenM1PresenceReason = !deviceOnline
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
    device: showven?.device,
    firmware: snap.firmware,
    masterAddress: snap.masterAddress,
    baudRate: snap.baudRate,
    slavesOnline: snap.slavesOnline,
  };
}
