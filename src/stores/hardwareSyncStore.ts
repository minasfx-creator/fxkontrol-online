/**
 * ─── hardwareSyncStore ────────────────────────────────────────────
 * Macro-store consolidating Honest Hardware Layer + protocol
 * adapters: DMX, sACN, ArtNet, OSC, USB, Serial, BLE, MAVLink, SMPTE,
 * Tuya, Showven/FireOne/Finale bridges, port authorization, discovery.
 *
 * Status: SCAFFOLD. Real protocol logic still lives in the legacy
 * stores + UnifiedHardwareRegistry. This store is the migration
 * target — slices will absorb legacy state when the consolidation
 * feature flag flips on.
 */
import { createStore } from './createStore';

export type BridgeId = 'showven' | 'fireone' | 'finale' | 'cubemesh' | 'tuya';
export type BridgeStatus = 'connected' | 'idle' | 'error' | 'unknown';

export interface AuthorizedPort {
  /** Web Serial / Web USB key — typically `${vendorId}:${productId}` */
  key: string;
  label: string;
  authorizedAt: number;
}

export interface HardwareSyncState {
  // ── Discovery slice ──────────────────────────────────────────────
  connectedDevices: Array<{ id: string; type: string; label: string }>;
  lastDiscoveryAt: number | null;

  // ── Persistent auth slice ────────────────────────────────────────
  authorizedPorts: AuthorizedPort[];

  // ── Protocol slice ───────────────────────────────────────────────
  /** Sparse universe → channel-array map. Hot path uses subscribeWithSelector. */
  activeUniverses: Record<number, number[]>;

  // ── Bridges slice ────────────────────────────────────────────────
  bridgeStatus: Partial<Record<BridgeId, BridgeStatus>>;
  lastSyncAt: number | null;

  // ── Actions ──────────────────────────────────────────────────────
  setConnectedDevices: (devices: HardwareSyncState['connectedDevices']) => void;
  authorizePort: (port: Omit<AuthorizedPort, 'authorizedAt'>) => void;
  revokePort: (key: string) => void;
  sendDMX: (universe: number, channel: number, value: number) => void;
  setBridgeStatus: (bridge: BridgeId, status: BridgeStatus) => void;
  markSynced: () => void;
}

export const useHardwareSyncStore = createStore<HardwareSyncState>(
  'hardware',
  (set) => ({
    connectedDevices: [],
    lastDiscoveryAt: null,
    authorizedPorts: [],
    activeUniverses: {},
    bridgeStatus: {},
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
    // Persist only durable state — never universe values or live device lists.
    partialize: (state) => ({
      authorizedPorts: state.authorizedPorts,
      bridgeStatus: state.bridgeStatus,
    }),
  },
);
