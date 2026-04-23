/**
 * Replay Engine — pure contract types.
 * No dependency on core/runtime. Adapters live in ./adapters.
 */

export type ReplayIntegrity = "PASS" | "FAIL";

export type DivergenceType =
  | "missing_frame"
  | "extra_frame"
  | "missing_event"
  | "extra_event"
  | "order_mismatch"
  | "timing_drift"
  | "hash_mismatch"
  | "risk_mismatch"
  | "adapter_mismatch";

export type DivergenceSeverity = "info" | "warn" | "critical";

export interface PlannedRiskEnvelope {
  avg?: number;
  peak?: number;
  variance?: number;
  spread?: number;
}

export type ObservedRiskEnvelope = PlannedRiskEnvelope;

export interface PlannedEvent {
  frameIndex: number;
  executionLayer: string;
  sequenceId: string;
  t0: number;
  adapter: string;
  channel?: string | number;
  action?: string;
}

export interface ObservedEvent extends PlannedEvent {
  executedAtMs?: number;
  adapterStatus?: "ok" | "failed" | "degraded";
}

export interface PlannedFrame {
  frameIndex: number;
  hash: string;
  degraded?: boolean;
  riskEnvelope?: PlannedRiskEnvelope;
  events: PlannedEvent[];
}

export interface ObservedFrame {
  frameIndex: number;
  hash: string;
  degraded?: boolean;
  riskEnvelope?: ObservedRiskEnvelope;
  events: ObservedEvent[];
}

export interface ExecutionPlan {
  frames: PlannedFrame[];
}

export interface RuntimeTrace {
  frames: ObservedFrame[];
}

export interface ReplayDivergence {
  frameIndex: number;
  type: DivergenceType;
  severity: DivergenceSeverity;
  message: string;
  planned?: unknown;
  observed?: unknown;
}

export interface ReplayTimingStats {
  avgDriftMs: number;
  peakDriftMs: number;
  driftViolations: number;
}

export interface ReplayReport {
  integrity: ReplayIntegrity;
  framesPlanned: number;
  framesObserved: number;
  matchedFrames: number;
  divergences: ReplayDivergence[];
  timing: ReplayTimingStats;
}

export interface ReplayOptions {
  maxDriftMs?: number;
  riskTolerance?: number;
  failOnWarnings?: boolean;
}
