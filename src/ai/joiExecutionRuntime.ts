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

// ─── Public types ──────────────────────────────────────────────────
export interface RuntimeConfig {
  readonly safetyThreshold: number; // 0..1 — abort if frame.peakRisk exceeds
  readonly mode: ExecutionLayer;
  readonly enableTrace: boolean;
  readonly onAbort?: (frame: ExecutionFrame, reason: AbortReason) => void;
  readonly onFrame?: (frame: ExecutionFrame, executed: number) => void;
  readonly adapter?: CommandAdapter;
}

export type AbortReason = 'risk_threshold' | 'degraded_frame' | 'external';

export interface CommandAdapter {
  dispatchPyro?: (cmd: PlannedCommand) => void;
  dispatchDmx?: (cmd: PlannedCommand) => void;
  dispatchDrone?: (cmd: PlannedCommand) => void;
}

export interface RuntimeFrameTrace {
  readonly frameIndex: number;
  readonly hash: string;
  readonly executedCommands: number;
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

    const frameIndex = this.clock.getFrameIndex(now);
    if (frameIndex === this.lastExecutedFrame) return;
    if (frameIndex < 0 || frameIndex >= this.plan.frames.length) return;

    // Catch-up: if we skipped frames (jitter/pause), execute each in order
    // to preserve determinism. Bounded by plan length.
    const startIdx = this.lastExecutedFrame + 1;
    for (let i = Math.max(0, startIdx); i <= frameIndex; i++) {
      this.executeFrame(i, now);
      if (this.aborted) return;
    }
  }

  private executeFrame(frameIndex: number, wallTimeMs: number): void {
    const frame = this.plan.frames[frameIndex];
    this.lastExecutedFrame = frameIndex;

    const risk = frame.telemetry.risk;

    // Safety gate — hard stop on threshold breach
    if (risk > this.config.safetyThreshold) {
      this.recordAbort(frame, risk, wallTimeMs, 'risk_threshold');
      return;
    }

    // Optional secondary gate: degraded frames in 'real' mode
    if (frame.degraded && this.config.mode === 'real') {
      this.recordAbort(frame, risk, wallTimeMs, 'degraded_frame');
      return;
    }

    // Deterministic dispatch — commands already ordered by planner
    let executed = 0;
    for (const cmd of frame.commands) {
      this.dispatch(cmd);
      executed++;
    }

    this.commandsDispatched += executed;
    this.framesExecuted++;

    if (this.config.enableTrace) {
      this.trace.push(
        Object.freeze<RuntimeFrameTrace>({
          frameIndex,
          hash: frame.hash,
          executedCommands: executed,
          risk,
          aborted: false,
          wallTimeMs,
        }),
      );
    }

    this.config.onFrame?.(frame, executed);
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
      this.trace.push(
        Object.freeze<RuntimeFrameTrace>({
          frameIndex: frame.index,
          hash: frame.hash,
          executedCommands: 0,
          risk,
          aborted: true,
          abortReason: reason,
          wallTimeMs,
        }),
      );
    }

    this.config.onAbort?.(frame, reason);
  }

  /** Command execution boundary — isolated adapter pattern. */
  private dispatch(cmd: PlannedCommand): void {
    const adapter = this.config.adapter;
    if (!adapter) return; // dry-run mode

    switch (cmd.target) {
      case 'pyro':
        adapter.dispatchPyro?.(cmd);
        break;
      case 'dmx':
        adapter.dispatchDmx?.(cmd);
        break;
      case 'drone':
        adapter.dispatchDrone?.(cmd);
        break;
    }
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
