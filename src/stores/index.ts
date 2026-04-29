/**
 * ─── Consolidated Stores — Public Surface ─────────────────────────
 * Macro-store barrel. After the H1 audit, only the actually-consumed
 * macro stores remain:
 *   • hardwareSyncStore — DMX/ArtNet hot path + bridge status
 *   • uiWorkspaceStore  — layout, prefs, feature flags, journal/report mirrors
 *
 * The previously-defined `missionStore` and `simulationStore` were
 * removed (zero consumers; their concerns are owned by per-domain
 * stores in `src/store/` such as `useFleetStore`, `useViewportStore`,
 * `useSceneStore`, and the timeline hooks).
 *
 * PREFER slice selectors (e.g. `useHardwareBridges`,
 * `useUIWorkspaceFlags`) over the raw store hooks — they use
 * `useShallow` and only re-render when the slice itself changes.
 */
export { createStore, useShallow } from './createStore';

// Stores
export {
  useHardwareSyncStore,
  useHardwareAuth,
  useHardwareBridges,
  useHardwareDiscovery,
  useHardwareActions,
} from './hardwareSyncStore';
export {
  useUIWorkspaceStore,
  useUIWorkspaceLayout,
  useUIWorkspacePrefs,
  useUIWorkspaceFlags,
  useUIWorkspaceTelemetry,
  useUIWorkspaceActions,
} from './uiWorkspaceStore';
export { migrateLegacyStores } from './migration';

// Types
export type {
  HardwareSyncState,
  HardwareAuthSlice,
  HardwareBridgesSlice,
  HardwareDiscoverySlice,
  HardwareProtocolSlice,
  HardwareActions,
  BridgeId,
  BridgeStatus,
  AuthorizedPort,
} from './hardwareSyncStore';
export type {
  UIWorkspaceState,
  UIWorkspaceLayoutSlice,
  UIWorkspacePrefsSlice,
  UIWorkspaceFlagsSlice,
  UIWorkspaceTelemetrySlice,
  UIWorkspaceActions,
  FeatureFlags,
  CommandJournalEntry,
  ExecutiveReportEntry,
} from './uiWorkspaceStore';
export type { MigrationResult } from './migration';
