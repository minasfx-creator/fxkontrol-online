/**
 * Joi Execution Runtime v1 — ExecutionPlan → real-time deterministic dispatch.
 *
 * CAMADA EXTERNA, ISOLADA. Não toca core/HIL/runtime existente.
 *
 * Propriedade central:
 *   Execution(t) ≡ f(Plan, Clock)
 *
 * Garantias:
 *  - clock monotônico (sem drift acumulado)
 *  - frame alignment determinístico via floor((now - start) / frameSizeMs)
 *  - execução idempotente por frame (lastExecutedFrame guard)
 *  - safety hard-stop por risk threshold (peakRisk + degraded)
 *  - trace replay-ready com frame hash
 */

import type { ExecutionPlan, ExecutionFrame, PlannedCommand } from './joiExecutionPlanner';
import type { ExecutionLayer } from './joiCompilerV2';
import { __internals as compilerInternals } from './joiCompilerV2';

const fnv1a = compilerInternals.fnv1a;

// ─── Public types ──────────────────────────────────────────────────
export interface RuntimeConfig {
  readonly safetyThreshold: number; // 0..1 — abort if frame.peakRisk exceeds
  readonly mode: ExecutionLayer;
  readonly enableTrace: boolean;
  readonly maxTraceFrames?: number;  // bounded ring buffer (default: unbounded)
  readonly maxCatchUpFrames?: number; // bound burst execution after lag (default: 10)
  readonly onAbort?: (frame: ExecutionFrame, reason: AbortReason) => void;
  readonly onFrame?: (frame: ExecutionFrame, executed: number) => void;
  readonly adapter?: CommandAdapter;
}

export type AbortReason =
  | 'risk_threshold'
  | 'degraded_frame'
  | 'external'
  | 'adapter_failure'
  | 'integrity_mismatch';

export interface CommandAdapter {
  /** Return false to signal hardware/backpressure failure → runtime aborts. */
  dispatchPyro?: (cmd: PlannedCommand) => boolean | void;
  dispatchDmx?: (cmd: PlannedCommand) => boolean | void;
  dispatchDrone?: (cmd: PlannedCommand) => boolean | void;
}

export interface RuntimeFrameTrace {
  readonly frameIndex: number;
  readonly hash: string;
  readonly executedCommands: number;
  readonly activeSteps: number; // total commands available at frame (replay diff)
  readonly risk: number;
  readonly aborted: boolean;
  readonly abortReason?: AbortReason;
  readonly wallTimeMs: number;
}

export interface RuntimeStats {
  readonly framesExecuted: number;
  readonly framesAborted: number;
  readonly commandsDispatched: number;
  readonly lastFrameIndex: number;
  readonly running: boolean;
}

// ─── Monotonic clock (no accumulated drift) ────────────────────────
export class RuntimeClock {
  private start = 0;
  private started = false;

  constructor(private readonly frameSizeMs: number) {}

  startClock(now: number): void {
    this.start = now;
    this.started = true;
  }

  isStarted(): boolean {
    return this.started;
  }

  /** Pure function: frameIndex = floor((now - start) / frameSize). */
  getFrameIndex(now: number): number {
    if (!this.started) return -1;
    return Math.floor((now - this.start) / this.frameSizeMs);
  }

  /** Aligned wall time for a given frame index. */
  getFrameTime(frameIndex: number): number {
    return this.start + frameIndex * this.frameSizeMs;
  }

  getStart(): number {
    return this.start;
  }
}

// ─── Runtime ───────────────────────────────────────────────────────
export class ExecutionRuntimeV1 {
  private readonly clock: RuntimeClock;
  private readonly trace: RuntimeFrameTrace[] = [];
  private lastExecutedFrame = -1;
  private lastNow = -Infinity; // monotonic guard against time reversal
  private framesExecuted = 0;
  private framesAborted = 0;
  private commandsDispatched = 0;
  private running = false;
  private aborted = false;

  constructor(
    private readonly plan: ExecutionPlan,
    private readonly config: RuntimeConfig,
  ) {
    this.clock = new RuntimeClock(plan.frameSizeMs);
  }

  start(now: number): void {
    if (this.running) return;
    this.clock.startClock(now);
    this.running = true;
    this.aborted = false;
  }

  stop(): void {
    this.running = false;
  }

  /**
   * Advance the runtime. Pure function of (plan, clock, now).
   * Idempotent: re-calling with the same frame is a no-op.
   */
  tick(now: number): void {
    if (!this.running || this.aborted) return;

    // Monotonic guard — never execute on a backwards clock
    if (now < this.lastNow) return;
    this.lastNow = now;

    const frameIndex = this.clock.getFrameIndex(now);
    if (frameIndex === this.lastExecutedFrame) return;
    if (frameIndex < 0) return;

    // Terminal flush — clock advanced past plan end
    if (frameIndex >= this.plan.frames.length) {
      this.stop();
      return;
    }

    // Catch-up: execute skipped frames in order to preserve determinism.
    // Bounded to prevent latency-avalanche execution collapse.
    const startIdx = this.lastExecutedFrame + 1;
    const limit = this.config.maxCatchUpFrames ?? 10;
    let burst = 0;
    for (let i = Math.max(0, startIdx); i <= frameIndex; i++) {
      if (burst++ >= limit) break;
      const ok = this.executeFrame(i, now);
      if (!ok) return;
      this.lastExecutedFrame = i;
    }
  }

  /** Centralized pre-frame safety gate. */
  private shouldAbort(frame: ExecutionFrame): AbortReason | null {
    if (frame.telemetry.risk > this.config.safetyThreshold) {
      return 'risk_threshold';
    }
    if (frame.degraded && this.config.mode === 'real') {
      return 'degraded_frame';
    }
    return null;
  }

  private executeFrame(frameIndex: number, wallTimeMs: number): boolean {
    const frame = this.plan.frames[frameIndex];
    const risk = frame.telemetry.risk;

    // Pre-frame safety gate — runs BEFORE any dispatch
    const abortReason = this.shouldAbort(frame);
    if (abortReason) {
      this.recordAbort(frame, risk, wallTimeMs, abortReason);
      return false;
    }

    // Self-integrity check — verify frame.hash is present AND consistent
    // with a runtime-derived signature using fields we have access to.
    // Catches: in-memory mutation, wrong-plan-loaded, frame swap.
    if (!frame.hash) {
      this.recordAbort(frame, risk, wallTimeMs, 'integrity_mismatch');
      return false;
    }
    const runtimeSig = fnv1a(
      `${ir_showId(this.plan)}|${frame.index}|${frame.commands.length}|${frame.telemetry.pyroLoad}|${frame.telemetry.dmxLoad}|${frame.telemetry.droneLoad}|${risk.toFixed(4)}`,
    );
    if (runtimeSig !== frame.hash) {
      this.recordAbort(frame, risk, wallTimeMs, 'integrity_mismatch');
      return false;
    }

    // Deterministic dispatch — commands already ordered by planner
    const activeSteps = frame.commands.length;
    let executed = 0;
    for (const cmd of frame.commands) {
      const ok = this.dispatch(cmd);
      if (!ok) {
        this.recordAbort(frame, risk, wallTimeMs, 'adapter_failure');
        return false;
      }
      executed++;
    }

    this.commandsDispatched += executed;
    this.framesExecuted++;

    if (this.config.enableTrace) {
      this.pushTrace({
        frameIndex,
        hash: frame.hash,
        executedCommands: executed,
        activeSteps,
        risk,
        aborted: false,
        wallTimeMs,
      });
    }

    this.config.onFrame?.(frame, executed);
    return true;
  }

  private recordAbort(
    frame: ExecutionFrame,
    risk: number,
    wallTimeMs: number,
    reason: AbortReason,
  ): void {
    this.framesAborted++;
    this.aborted = true;
    this.running = false;

    if (this.config.enableTrace) {
      this.pushTrace({
        frameIndex: frame.index,
        hash: frame.hash,
        executedCommands: 0,
        risk,
        aborted: true,
        abortReason: reason,
        wallTimeMs,
      });
    }

    this.config.onAbort?.(frame, reason);
  }

  /** Bounded ring-buffer push (forensic tail). */
  private pushTrace(entry: RuntimeFrameTrace): void {
    const max = this.config.maxTraceFrames;
    if (max && max > 0 && this.trace.length >= max) {
      this.trace.shift();
    }
    this.trace.push(Object.freeze(entry));
  }

  /**
   * Command execution boundary — isolated adapter pattern.
   * Returns false if adapter signalled failure (backpressure / hardware fault).
   */
  private dispatch(cmd: PlannedCommand): boolean {
    const adapter = this.config.adapter;
    if (!adapter) return true; // dry-run mode

    let result: boolean | void;
    switch (cmd.target) {
      case 'pyro':
        result = adapter.dispatchPyro?.(cmd);
        break;
      case 'dmx':
        result = adapter.dispatchDmx?.(cmd);
        break;
      case 'drone':
        result = adapter.dispatchDrone?.(cmd);
        break;
    }
    return result !== false;
  }

  /** External abort hook (E-STOP equivalent). */
  abort(reason: AbortReason = 'external'): void {
    if (this.aborted) return;
    this.aborted = true;
    this.running = false;
    const frame = this.plan.frames[Math.max(0, this.lastExecutedFrame)];
    if (frame) {
      this.config.onAbort?.(frame, reason);
    }
  }

  // ── Introspection ──────────────────────────────────────────────
  getTrace(): readonly RuntimeFrameTrace[] {
    return this.trace;
  }

  getStats(): RuntimeStats {
    return {
      framesExecuted: this.framesExecuted,
      framesAborted: this.framesAborted,
      commandsDispatched: this.commandsDispatched,
      lastFrameIndex: this.lastExecutedFrame,
      running: this.running,
    };
  }

  isRunning(): boolean {
    return this.running;
  }

  isAborted(): boolean {
    return this.aborted;
  }

  /**
   * Replay verification — every traced frame hash must match the plan.
   * Returns false on first mismatch (drift detected).
   */
  verify(plan: ExecutionPlan = this.plan): boolean {
    for (const entry of this.trace) {
      const frame = plan.frames[entry.frameIndex];
      if (!frame || frame.hash !== entry.hash) return false;
    }
    return true;
  }
}

export const __runtimeInternals = { RuntimeClock };
