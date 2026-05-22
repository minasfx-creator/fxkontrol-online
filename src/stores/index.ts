/**
 * ─── Consolidated Stores — Public Surface ─────────────────────────
 * Slim macro-store barrel. After the H1 audit, only what's actually
 * consumed remains:
 *   • hardwareSyncStore — DMX/ArtNet hot path + bridge status
 *   • uiWorkspaceStore  — layout, prefs, journal/report mirrors
 *
 * Removed (zero consumers / canonical lives elsewhere):
 *   • missionStore, simulationStore  — owned by per-domain stores
 *     in `src/store/` (useFleetStore, useSceneStore, timeline hooks).
 *   • hardwareSyncStore.auth/discovery — canonical sources are
 *     `portRegistry` and `unifiedDiscovery`.
 *   • uiWorkspaceStore.featureFlags    — canonical is `@/lib/featureFlags`.
 */
export { createStore, useShallow } from './createStore';

// Stores
export {
  useHardwareSyncStore,
  useHardwareBridges,
  useHardwareActions,
} from './hardwareSyncStore';
export {
  useUIWorkspaceStore,
  useUIWorkspaceLayout,
  useUIWorkspacePrefs,
  useUIWorkspaceTelemetry,
  useUIWorkspaceActions,
} from './uiWorkspaceStore';
export { migrateLegacyStores } from './migration';

// Types
export type {
  HardwareSyncState,
  HardwareBridgesSlice,
  HardwareProtocolSlice,
  HardwareActions,
  BridgeId,
  BridgeStatus,
} from './hardwareSyncStore';
export type {
  UIWorkspaceState,
  UIWorkspaceLayoutSlice,
  UIWorkspacePrefsSlice,
  UIWorkspaceTelemetrySlice,
  UIWorkspaceActions,
  CommandJournalEntry,
  ExecutiveReportEntry,
} from './uiWorkspaceStore';
