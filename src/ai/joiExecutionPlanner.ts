/**
 * Joi Execution Planner v1 — IR → frame-aligned ExecutionPlan.
 *
 * CAMADA EXTERNA, ISOLADA. Não toca core/HIL/runtime.
 *
 * Entrada:  JoiIR (compiler v2.3)
 * Saída:    ExecutionPlan determinístico, frame-bucketed, HIL-ready.
 *
 * Próxima camada (não aqui): Deterministic Execution Runtime (clock + scheduler + HIL bridge).
 */

import type {
  JoiIR,
  IRStep,
  IRAction,
  JoiTarget,
  ExecutionLayer,
} from './joiCompilerV2';
import { __internals as compilerInternals } from './joiCompilerV2';

const fnv1a = compilerInternals.fnv1a;

// ─── Output types ──────────────────────────────────────────────────
export interface PlannedCommand {
  readonly sequenceId: string;
  readonly sourceStepId: string;
  readonly target: JoiTarget;
  readonly action: IRAction;
  readonly params: Readonly<Record<string, number>>;
  readonly executionHint: {
    readonly mode: ExecutionLayer;
    readonly degraded: boolean;
  };
  readonly risk: number;
}

export interface ExecutionFrame {
  readonly index: number;
  readonly t0: number;
  readonly t1: number;
  readonly hash: string; // FNV1a, replay/diff verification
  readonly degraded: boolean;
  readonly commands: readonly PlannedCommand[];
  readonly telemetry: {
    readonly risk: number; // peak risk in frame
    readonly avgRisk: number;
    readonly activeSteps: number;
    readonly pyroLoad: number;
    readonly dmxLoad: number;
    readonly droneLoad: number;
  };
}

export interface ExecutionPlan {
  readonly showId: string;
  readonly version: 'joi-plan-v1';
  readonly executionLayer: ExecutionLayer;
  readonly frameSizeMs: number;
  readonly frames: readonly ExecutionFrame[];
  readonly global: {
    readonly duration: number;
    readonly totalFrames: number;
    readonly maxConcurrency: number;
    readonly riskEnvelope: {
      readonly avg: number;
      readonly peak: number;
      readonly spread: number;
    };
  };
}

// ─── Helpers ───────────────────────────────────────────────────────
function bucketSteps(ir: JoiIR): Map<number, IRStep[]> {
  const map = new Map<number, IRStep[]>();
  for (const step of ir.steps) {
    const arr = map.get(step.frameIndex);
    if (arr) arr.push(step);
    else map.set(step.frameIndex, [step]);
  }
  // Deterministic intra-frame ordering: t0 → sequenceId
  for (const arr of map.values()) {
    arr.sort(
      (a, b) => a.t0 - b.t0 || a.sequenceId.localeCompare(b.sequenceId),
    );
  }
  return map;
}

// ─── Public API ────────────────────────────────────────────────────
export function buildExecutionPlan(ir: JoiIR): ExecutionPlan {
  const buckets = bucketSteps(ir);
  const totalFrames = Math.max(ir.globalStats.frames, 0);
  const frames: ExecutionFrame[] = new Array(totalFrames);

  let maxConcurrency = 0;

  for (let i = 0; i < totalFrames; i++) {
    const steps = buckets.get(i) ?? [];
    const commands: PlannedCommand[] = [];
    let pyro = 0;
    let dmx = 0;
    let drone = 0;
    let riskSum = 0;
    let peakRisk = 0;
    let degraded = false;

    for (const step of steps) {
      if (step.executionHint.degraded) degraded = true;
      for (const cmd of step.commands) {
        commands.push(
          Object.freeze<PlannedCommand>({
            sequenceId: step.sequenceId,
            sourceStepId: step.id,
            target: cmd.target,
            action: cmd.action,
            params: cmd.params,
            executionHint: step.executionHint,
            risk: cmd.constraints.riskScore,
          }),
        );
        if (cmd.target === 'pyro') pyro++;
        else if (cmd.target === 'dmx') dmx++;
        else if (cmd.target === 'drone') drone++;
      }
      riskSum += step.context.risk;
      if (step.context.risk > peakRisk) peakRisk = step.context.risk;
    }

    const activeSteps = steps.length;
    const avgRisk = activeSteps > 0 ? riskSum / activeSteps : 0;
    if (avgRisk > 0.85) degraded = true;

    const frameLoad = pyro + dmx + drone;
    const hash = fnv1a(
      `${ir.showId}|${i}|${commands.length}|${pyro}|${dmx}|${drone}|${peakRisk.toFixed(4)}`,
    );

    frames[i] = Object.freeze<ExecutionFrame>({
      index: i,
      t0: i * ir.frameSizeMs,
      t1: (i + 1) * ir.frameSizeMs,
      hash,
      degraded,
      commands: Object.freeze(commands),
      telemetry: {
        risk: peakRisk,
        avgRisk,
        activeSteps,
        pyroLoad: pyro,
        dmxLoad: dmx,
        droneLoad: drone,
      },
    });

    if (frameLoad > maxConcurrency) maxConcurrency = frameLoad;
  }

  // Risk envelope at planner level (uses peak per frame)
  let sumRisk = 0;
  let peak = 0;
  for (const f of frames) {
    sumRisk += f.telemetry.risk;
    if (f.telemetry.risk > peak) peak = f.telemetry.risk;
  }
  const avg = frames.length > 0 ? sumRisk / frames.length : 0;
  const spread = Math.max(0, peak - avg);

  return Object.freeze<ExecutionPlan>({
    showId: ir.showId,
    version: 'joi-plan-v1',
    executionLayer: ir.executionLayer,
    frameSizeMs: ir.frameSizeMs,
    frames: Object.freeze(frames),
    global: {
      duration: ir.globalStats.duration,
      totalFrames: frames.length,
      maxConcurrency,
      riskEnvelope: { avg, peak, spread },
    },
  });
}

export const __plannerInternals = { bucketSteps };
