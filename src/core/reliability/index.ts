/**
 * ─── FXK Reliability Core ───────────────────────────────────────────
 * Mission-critical reliability infrastructure.
 */

export { SeededRandom, simRNG } from './seededRandom';
export { lockstep } from './lockstepEngine';
export { predictive, type PredictedEvent } from './predictiveEngine';
export { reality, type WindData, type SensorReading, type RealityCorrection } from './realityEngine';
export { emergency, type EmergencyLevel, type EmergencyState } from './emergencySystem';
export { diagnostic, feedDiagnosticFps, type DiagnosticReport, type DiagnosticCheck, type CheckStatus } from './selfDiagnostic';
export { blackbox, type BlackBoxEntry } from './blackBoxRecorder';
export { autoScaler, type QualityTier, type ScaleState } from './autoScaler';
export { autoHeal, type SubsystemId, type HealStatus, type SubsystemHealth, type HealEvent } from './autoHealEngine';

// ── Execution & Time Layer (v5.0) ──────────────────────────────────
export { deterministicClock, type ClockState } from '@/core/time/deterministicClock';
export { StateBuffer } from '@/core/state/stateBuffer';
export { executionBridge, type TimelineCue, type BridgeStats } from '@/core/execution/executionBridge';
export { fieldBus, type FieldBusState, type TransportId } from '@/core/network/fieldBus';
export { simulationValidator, type ValidationReport, type ValidationIssue, type ValidationCue } from '@/core/validation/simulationValidator';
export { pyroExecutor, type PyroCue } from '@/core/execution/pyroExecutor';
export { droneExecutor, type DroneWaypoint } from '@/core/execution/droneExecutor';

// ── Global Sync Layer (v6.0) ───────────────────────────────────────
export { globalClock, type SyncRole, type ClockSyncState } from '@/core/sync/globalClockAdapter';
export { globalSync, type GlobalSyncState, type SyncOperator, type OperatorPermission } from '@/core/sync/globalSyncEngine';

// ── Multi-Site Sync Layer (v7.0) ──────────────────────────────────
export { multiSiteSync, type SiteInfo, type SiteStatus, type MultiSiteState, type ConsistencyResult } from '@/core/sync/multiSiteSyncEngine';
export { latencyCompensator, type SiteLatencyProfile, type CompensatedTime } from '@/core/sync/latencyCompensator';
export { multiSiteValidator, type MultiSiteValidationReport, type SiteValidationResult, type ValidationSiteConfig, type SiteValidationStatus } from '@/core/sync/multiSiteValidator';

// ── Frame Sync Layer (v8.0 — Broadcast Level) ────────────────────
export { timecodeProvider, type TimecodeSource, type TimecodeState } from '@/core/time/timecodeProvider';
export { frameTimeService, type FrameTimeState } from '@/core/time/frameTimeService';
export { frameSyncEngine, type FrameSyncState, type FrameSyncStatus } from '@/core/sync/frameSyncEngine';
