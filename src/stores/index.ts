/**
 * ─── Consolidated Stores — Public Surface ─────────────────────────
 * Import points for the 4 macro-stores. Legacy stores in
 * `src/store/` remain available during the migration window and
 * are gated by `useUIWorkspaceStore.featureFlags.consolidatedStores`.
 */
export { createStore, useShallow } from './createStore';
export { useMissionStore } from './missionStore';
export { useHardwareSyncStore } from './hardwareSyncStore';
export { useSimulationStore } from './simulationStore';
export { useUIWorkspaceStore } from './uiWorkspaceStore';
export { migrateLegacyStores } from './migration';

export type { MissionState, PlaybackState, SafetyInterlock } from './missionStore';
export type {
  HardwareSyncState, BridgeId, BridgeStatus, AuthorizedPort,
} from './hardwareSyncStore';
export type {
  SimulationState, SimulationMode, ViewportMode,
} from './simulationStore';
export type {
  UIWorkspaceState, FeatureFlags,
  CommandJournalEntry, ExecutiveReportEntry,
} from './uiWorkspaceStore';
export type { MigrationResult } from './migration';
