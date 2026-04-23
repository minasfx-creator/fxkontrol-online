/**
 * Replay Engine v1 — public contract types.
 *
 * CAMADA EXTERNA, ISOLADA. Não toca core/HIL/runtime existente.
 *
 * Propriedade central:
 *   ReplayReport ≡ f(ExecutionPlan, RuntimeTrace)
 *
 * Pure, deterministic, UI-free.
 */

export type ReplayIntegrity = 'PASS' | 'FAIL';

export type DivergenceType =
  | 'missing_frame'
  | 'extra_frame'
  | 'missing_event'
  | 'extra_event'
  | 'order_mismatch'
  | 'timing_drift'
  | 'hash_mismatch'
  | 'risk_mismatch'
  | 'adapter_mismatch';

export type DivergenceSeverity = 'info' | 'warn' | 'critical';

export interface ReplayDivergence {
  readonly frameIndex: number;
  readonly type: DivergenceType;
  readonly severity: DivergenceSeverity;
  readonly message: string;
  readonly planned?: unknown;
  readonly observed?: unknown;
}

export interface ReplayTimingStats {
  readonly avgDriftMs: number;
  readonly peakDriftMs: number;
  readonly driftViolations: number;
}

export interface ReplayReport {
  readonly integrity: ReplayIntegrity;
  readonly framesPlanned: number;
  readonly framesObserved: number;
  readonly matchedFrames: number;
  readonly divergences: readonly ReplayDivergence[];
  readonly timing: ReplayTimingStats;
}

// ─── Trace shape expected by the replay engine ─────────────────────
// Adapter-friendly: the runtime can produce this from RuntimeFrameTrace
// + per-command observation. Kept minimal to avoid coupling.
export interface ObservedEvent {
  readonly frameIndex: number;
  readonly executionLayer: string;
  readonly sequenceId: string;
  readonly t0: number;            // planned event time (ms)
  readonly adapter: string;       // 'pyro' | 'dmx' | 'drone' | ...
  readonly channel?: string | number;
  readonly action?: string;
  readonly executedAtMs?: number; // wall time of dispatch
  readonly status?: 'ok' | 'fail';
}

export interface ObservedFrame {
  readonly frameIndex: number;
  readonly hash: string;
  readonly events: readonly ObservedEvent[];
}

export interface RuntimeTrace {
  readonly frames: readonly ObservedFrame[];
}

export interface ReplayOptions {
  /** Per-event drift tolerance in ms. Default: 5. */
  readonly maxDriftMs?: number;
}
