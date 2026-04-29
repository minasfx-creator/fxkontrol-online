/**
 * ─── hardwareSyncStore ────────────────────────────────────────────
 * Slim coordinator store for the 44Hz HardwareSyncLoop hot path.
 *
 * Canonical sources (DO NOT mirror here):
 *   - Authorized ports:        @/core/discovery/portRegistry
 *   - Discovered devices:      @/core/discovery/unifiedDiscovery
 *   - Runtime bridge/device:   the bridge engines themselves
 *
 * This store exists only to coordinate sync-loop state that is
 * actually consumed by React subscribers (universe channel arrays
 * + bridge status badges). Everything else was moved out during
 * the H1 dual-store cleanup.
 *
 * Hot path: HardwareSyncLoop drains stagedChannels at 44Hz with
 * shallow-eq guards (per-universe ref swap only on change). Heavy
 * panels MUST subscribe via `useHardwareBridges()` — they never
 * re-render on DMX ticks.
 */
import { useShallow } from 'zustand/react/shallow';
import { createStore } from './createStore';

export type BridgeId = 'showven' | 'fireone' | 'finale' | 'cubemesh' | 'tuya';
export type BridgeStatus = 'connected' | 'idle' | 'error' | 'unknown';

export interface HardwareBridgesSlice {
  bridgeStatus: Partial<Record<BridgeId, BridgeStatus>>;
}

export interface HardwareProtocolSlice {
  /** Sparse universe → channel-array map. Hot path uses subscribeWithSelector. */
  activeUniverses: Record<number, number[]>;
  lastSyncAt: number | null;
}

export interface HardwareActions {
  setActiveUniverses: (universes: Record<number, number[]>) => void;
  setBridgeStatus: (bridge: BridgeId, status: BridgeStatus) => void;
  markSynced: () => void;
  reset: () => void;
}

export type HardwareSyncState =
  & HardwareBridgesSlice
  & HardwareProtocolSlice
  & HardwareActions;

const INITIAL: Pick<HardwareSyncState, 'activeUniverses' | 'lastSyncAt' | 'bridgeStatus'> = {
  bridgeStatus: {},
  activeUniverses: {},
  lastSyncAt: null,
};

export const useHardwareSyncStore = createStore<HardwareSyncState>(
  'hardware',
  (set) => ({
    ...INITIAL,

    setActiveUniverses: (universes) => set((s) => {
      s.activeUniverses = universes;
    }),
    setBridgeStatus: (bridge, status) => set((s) => {
      s.bridgeStatus[bridge] = status;
    }),
    markSynced: () => set((s) => { s.lastSyncAt = Date.now(); }),
    reset: () => set((s) => {
      s.bridgeStatus = {};
      s.activeUniverses = {};
      s.lastSyncAt = null;
    }),
  }),
  {
    // Persist ONLY bridge status — universes are huge/transient,
    // lastSyncAt is timestamp churn.
    partialize: (state) => ({
      bridgeStatus: state.bridgeStatus,
    }),
  },
);

// ── Slice selectors ──────────────────────────────────────────────
export const useHardwareBridges = () =>
  useHardwareSyncStore(useShallow((s): HardwareBridgesSlice => ({
    bridgeStatus: s.bridgeStatus,
  })));

export const useHardwareActions = (): HardwareActions =>
  useHardwareSyncStore(useShallow((s) => ({
    setActiveUniverses: s.setActiveUniverses,
    setBridgeStatus: s.setBridgeStatus,
    markSynced: s.markSynced,
    reset: s.reset,
  })));
