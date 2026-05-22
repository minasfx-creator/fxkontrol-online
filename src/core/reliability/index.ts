/**
 * ─── FXK Reliability Core ───────────────────────────────────────────
 * Mission-critical reliability infrastructure.
 */

export { SeededRandom, simRNG } from './seededRandom';
export { lockstep } from './lockstepEngine';
export { blackbox, type BlackBoxEntry } from './blackBoxRecorder';
export { autoScaler, type QualityTier, type ScaleState } from './autoScaler';
export { autoHeal, type SubsystemId, type HealStatus, type SubsystemHealth, type HealEvent } from './autoHealEngine';

// ── Command Layer ─────────────────────────────────────────────────
export { commandBus, type Command, type CommandHandler } from '@/core/command/CommandBus';
export { commandLog, type LogEntry } from '@/core/command/CommandLog';

// ── State Layer ───────────────────────────────────────────────────
export { snapshotManager, type Snapshot } from '@/core/state/SnapshotManager';

// ── Replay Layer ──────────────────────────────────────────────────
export { replayEngine, type ReplayState } from '@/core/engine/ReplayEngine';

// ── Execution & Time Layer ─────────────────────────────────────────
export { deterministicClock, type ClockState } from '@/core/time/deterministicClock';
export { StateBuffer } from '@/core/state/stateBuffer';
export { executionBridge, type TimelineCue, type BridgeStats } from '@/core/execution/executionBridge';
export { fieldBus, type FieldBusState, type TransportId } from '@/core/network/fieldBus';
export { simulationValidator, type ValidationReport, type ValidationIssue, type ValidationCue } from '@/core/validation/simulationValidator';
export { pyroExecutor, type PyroCue } from '@/core/execution/pyroExecutor';
export { droneExecutor, type DroneWaypoint } from '@/core/execution/droneExecutor';

// ── Sync Layer ─────────────────────────────────────────────────────
export { latencyCompensator, type SiteLatencyProfile, type CompensatedTime } from '@/core/sync/latencyCompensator';

// ── Frame Sync Layer (Broadcast Level) ─────────────────────────────
export { timecodeProvider, type TimecodeSource, type TimecodeState } from '@/core/time/timecodeProvider';
export { frameTimeService, type FrameTimeState } from '@/core/time/frameTimeService';
export { frameSyncEngine, type FrameSyncState, type FrameSyncStatus } from '@/core/sync/frameSyncEngine';
