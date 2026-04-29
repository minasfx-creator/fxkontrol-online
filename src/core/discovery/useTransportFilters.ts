/**
 * ─── Transport Filter Store ────────────────────────────────────────
 * Persisted set of enabled discovery transports. Used by:
 *  - DiscoveryGrid (hides cards for disabled transports)
 *  - discoveryToasts (skips toast reports for disabled transports)
 *  - HardwareOverview Retry (only retries enabled+failed transports)
 *
 * Default: all four transports enabled. Persisted in localStorage so the
 * operator's preference survives reloads.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DiscoveryTransport } from './types';

export const ALL_TRANSPORTS: DiscoveryTransport[] = [
  'webserial', 'webusb', 'webble', 'mdns-artnet',
];

interface TransportFiltersState {
  enabled: Record<DiscoveryTransport, boolean>;
  toggle: (t: DiscoveryTransport) => void;
  setEnabled: (t: DiscoveryTransport, on: boolean) => void;
  enableAll: () => void;
  isEnabled: (t: DiscoveryTransport) => boolean;
}

export const useTransportFilters = create<TransportFiltersState>()(
  persist(
    (set, get) => ({
      enabled: {
        webserial: true,
        webusb: true,
        webble: true,
        'mdns-artnet': true,
      },
      toggle: (t) => set(s => ({ enabled: { ...s.enabled, [t]: !s.enabled[t] } })),
      setEnabled: (t, on) => set(s => ({ enabled: { ...s.enabled, [t]: on } })),
      enableAll: () => set({
        enabled: { webserial: true, webusb: true, webble: true, 'mdns-artnet': true },
      }),
      isEnabled: (t) => get().enabled[t] !== false,
    }),
    {
      name: 'fxk:discoveryTransportFilters:v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** Snapshot helper for non-React consumers (toasts, services). */
export function getEnabledTransports(): DiscoveryTransport[] {
  const { enabled } = useTransportFilters.getState();
  return ALL_TRANSPORTS.filter(t => enabled[t] !== false);
}
