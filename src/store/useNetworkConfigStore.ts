/**
 * ─── Network Config Store ──────────────────────────────────────────
 * Persisted configuration for real hardware network endpoints.
 * Used by Art-Net bridge, sACN, and edge function calls.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TransportProtocol = "artnet" | "sacn" | "serial";

export interface NetworkEndpoint {
  hostname: string;     // IP or DNS name of the Art-Net/sACN node
  port: number;         // UDP port (Art-Net default 6454, sACN 5568)
  wsRelayUrl: string;   // WebSocket relay URL (browser cannot send raw UDP)
}

export interface NetworkConfigState {
  protocol: TransportProtocol;
  endpoint: NetworkEndpoint;
  autoFailover: boolean;
  pollIntervalMs: number;

  setProtocol: (p: TransportProtocol) => void;
  setEndpoint: (patch: Partial<NetworkEndpoint>) => void;
  setAutoFailover: (v: boolean) => void;
  setPollIntervalMs: (ms: number) => void;
  reset: () => void;
}

const DEFAULT_ENDPOINT: NetworkEndpoint = {
  hostname: "192.168.1.100",
  port: 6454,
  wsRelayUrl: "",
};

export const useNetworkConfigStore = create<NetworkConfigState>()(
  persist(
    (set) => ({
      protocol: "artnet",
      endpoint: DEFAULT_ENDPOINT,
      autoFailover: true,
      pollIntervalMs: 1000,

      setProtocol: (protocol) => set({ protocol }),
      setEndpoint: (patch) =>
        set((s) => ({ endpoint: { ...s.endpoint, ...patch } })),
      setAutoFailover: (autoFailover) => set({ autoFailover }),
      setPollIntervalMs: (pollIntervalMs) => set({ pollIntervalMs }),
      reset: () =>
        set({
          protocol: "artnet",
          endpoint: DEFAULT_ENDPOINT,
          autoFailover: true,
          pollIntervalMs: 1000,
        }),
    }),
    { name: "fxk:network-config" },
  ),
);

/** Default UDP port for the chosen transport. */
export function defaultPortForProtocol(p: TransportProtocol): number {
  switch (p) {
    case "artnet":
      return 6454;
    case "sacn":
      return 5568;
    case "serial":
      return 0;
  }
}
