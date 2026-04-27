/**
 * ─── Consolidated Stores — Public Surface ─────────────────────────
 * Import points for the 4 macro-stores. Legacy stores in
 * `src/store/` remain available during the migration window and
 * are gated by `useUIWorkspaceStore.featureFlags.consolidatedStores`.
 *
 * PREFER slice selectors (e.g. `useMissionPlayback`,
 * `useHardwareBridges`) over the raw store hooks — they use
 * `useShallow` and only re-render when the slice itself changes.
 */
export { createStore, useShallow } from './createStore';

// Stores
export {
  useMissionStore,
  useMissionDurable,
  useMissionTimeline,
  useMissionPlayback,
  useMissionActions,
} from './missionStore';
export {
  useHardwareSyncStore,
  useHardwareAuth,
  useHardwareBridges,
  useHardwareDiscovery,
  useHardwareActions,
} from './hardwareSyncStore';
export {
  useSimulationStore,
  useSimulationMode,
  useSimulationCompute,
  useSimulationPhysics,
  useSimulationReplay,
  useSimulationActions,
} from './simulationStore';
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
  MissionState,
  MissionDurableSlice,
  MissionTimelineSlice,
  MissionPlaybackSlice,
  MissionActions,
  PlaybackState,
  SafetyInterlock,
} from './missionStore';
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
  SimulationState,
  SimulationModeSlice,
  SimulationComputeSlice,
  SimulationPhysicsSlice,
  SimulationReplaySlice,
  SimulationActions,
  SimulationMode,
  ViewportMode,
} from './simulationStore';
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
