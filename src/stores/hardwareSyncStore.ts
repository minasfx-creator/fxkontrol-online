/**
 * ─── hardwareSyncStore ────────────────────────────────────────────
 * Macro-store consolidating Honest Hardware Layer + protocol
 * adapters: DMX, sACN, ArtNet, OSC, USB, Serial, BLE, MAVLink, SMPTE,
 * Tuya, Showven/FireOne/Finale bridges, port authorization, discovery.
 *
 * SLICE TOPOLOGY (minimize subscription fan-out):
 *   • auth      — authorizedPorts (PERSISTED, low frequency)
 *   • bridges   — bridgeStatus map (PERSISTED, mid frequency)
 *   • discovery — connectedDevices, lastDiscoveryAt (mid frequency)
 *   • protocol  — activeUniverses, lastSyncAt (HIGH frequency, 44Hz+)
 *
 * Hot path: HardwareSyncLoop drains the protocol slice at 44Hz with
 * shallow-eq guards (per-universe ref swap only on change). Heavy
 * panels MUST subscribe via `useHardwareBridges()` /
 * `useHardwareDiscovery()` — they never re-render on DMX ticks.
 */
import { useShallow } from 'zustand/react/shallow';
import { createStore } from './createStore';

export type BridgeId = 'showven' | 'fireone' | 'finale' | 'cubemesh' | 'tuya';
export type BridgeStatus = 'connected' | 'idle' | 'error' | 'unknown';

export interface AuthorizedPort {
  /** Web Serial / Web USB key — typically `${vendorId}:${productId}` */
  key: string;
  label: string;
  authorizedAt: number;
}

export interface HardwareAuthSlice {
  authorizedPorts: AuthorizedPort[];
}

export interface HardwareBridgesSlice {
  bridgeStatus: Partial<Record<BridgeId, BridgeStatus>>;
}

export interface HardwareDiscoverySlice {
  connectedDevices: Array<{ id: string; type: string; label: string }>;
  lastDiscoveryAt: number | null;
}

export interface HardwareProtocolSlice {
  /** Sparse universe → channel-array map. Hot path uses subscribeWithSelector. */
  activeUniverses: Record<number, number[]>;
  lastSyncAt: number | null;
}

export interface HardwareActions {
  setConnectedDevices: (devices: HardwareDiscoverySlice['connectedDevices']) => void;
  authorizePort: (port: Omit<AuthorizedPort, 'authorizedAt'>) => void;
  revokePort: (key: string) => void;
  sendDMX: (universe: number, channel: number, value: number) => void;
  setBridgeStatus: (bridge: BridgeId, status: BridgeStatus) => void;
  markSynced: () => void;
}

export type HardwareSyncState =
  & HardwareAuthSlice
  & HardwareBridgesSlice
  & HardwareDiscoverySlice
  & HardwareProtocolSlice
  & HardwareActions;

export const useHardwareSyncStore = createStore<HardwareSyncState>(
  'hardware',
  (set) => ({
    // auth
    authorizedPorts: [],
    // bridges
    bridgeStatus: {},
    // discovery
    connectedDevices: [],
    lastDiscoveryAt: null,
    // protocol (hot)
    activeUniverses: {},
    lastSyncAt: null,

    setConnectedDevices: (devices) => set((s) => {
      s.connectedDevices = devices;
      s.lastDiscoveryAt = Date.now();
    }),
    authorizePort: (port) => set((s) => {
      const existing = s.authorizedPorts.findIndex((p) => p.key === port.key);
      const entry: AuthorizedPort = { ...port, authorizedAt: Date.now() };
      if (existing >= 0) s.authorizedPorts[existing] = entry;
      else s.authorizedPorts.push(entry);
    }),
    revokePort: (key) => set((s) => {
      s.authorizedPorts = s.authorizedPorts.filter((p) => p.key !== key);
    }),
    sendDMX: (universe, channel, value) => set((s) => {
      let arr = s.activeUniverses[universe];
      if (!arr) { arr = new Array(512).fill(0); s.activeUniverses[universe] = arr; }
      arr[channel] = value;
    }),
    setBridgeStatus: (bridge, status) => set((s) => {
      s.bridgeStatus[bridge] = status;
    }),
    markSynced: () => set((s) => { s.lastSyncAt = Date.now(); }),
  }),
  {
    // Persist ONLY durable slices — never universes (huge, transient)
    // nor live device lists nor lastSyncAt (timestamp churn).
    partialize: (state) => ({
      authorizedPorts: state.authorizedPorts,
      bridgeStatus: state.bridgeStatus,
    }),
  },
);

// ── Slice selectors ──────────────────────────────────────────────
export const useHardwareAuth = () =>
  useHardwareSyncStore(useShallow((s): HardwareAuthSlice => ({
    authorizedPorts: s.authorizedPorts,
  })));

export const useHardwareBridges = () =>
  useHardwareSyncStore(useShallow((s): HardwareBridgesSlice => ({
    bridgeStatus: s.bridgeStatus,
  })));

export const useHardwareDiscovery = () =>
  useHardwareSyncStore(useShallow((s): HardwareDiscoverySlice => ({
    connectedDevices: s.connectedDevices,
    lastDiscoveryAt: s.lastDiscoveryAt,
  })));

export const useHardwareActions = (): HardwareActions =>
  useHardwareSyncStore(useShallow((s) => ({
    setConnectedDevices: s.setConnectedDevices,
    authorizePort: s.authorizePort,
    revokePort: s.revokePort,
    sendDMX: s.sendDMX,
    setBridgeStatus: s.setBridgeStatus,
    markSynced: s.markSynced,
  })));
