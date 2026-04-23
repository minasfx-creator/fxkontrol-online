/**
 * Replay Engine v1 — public surface.
 */
export type {
  ReplayIntegrity,
  DivergenceType,
  DivergenceSeverity,
  ReplayDivergence,
  ReplayTimingStats,
  ReplayReport,
  ObservedEvent,
  ObservedFrame,
  RuntimeTrace,
  ReplayOptions,
} from './types';

export { eventSignature } from './eventSignature';
export { replayExecution } from './replayEngine';
