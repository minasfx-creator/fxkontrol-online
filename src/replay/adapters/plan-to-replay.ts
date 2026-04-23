/**
 * Adapter: ai/joiExecutionPlanner.ExecutionPlan → replay.ExecutionPlan.
 * Pure projection. No mutation.
 */
import type {
  ExecutionPlan as AiExecutionPlan,
  ExecutionFrame as AiExecutionFrame,
  PlannedCommand as AiPlannedCommand,
} from "@/ai/joiExecutionPlanner";
import type { ExecutionPlan, PlannedEvent, PlannedFrame } from "../types";

function commandToEvent(
  frameIndex: number,
  t0: number,
  cmd: AiPlannedCommand,
): PlannedEvent {
  return {
    frameIndex,
    executionLayer: cmd.executionHint.mode,
    sequenceId: cmd.sequenceId,
    t0,
    adapter: cmd.target,
    action: cmd.action,
  };
}

function frameToPlanned(frame: AiExecutionFrame): PlannedFrame {
  return {
    frameIndex: frame.index,
    hash: frame.hash,
    degraded: frame.degraded,
    riskEnvelope: {
      avg: frame.telemetry.avgRisk,
      peak: frame.telemetry.risk,
      spread: frame.telemetry.spread,
    },
    events: frame.commands.map((c) => commandToEvent(frame.index, frame.t0, c)),
  };
}

export function planToReplay(plan: AiExecutionPlan): ExecutionPlan {
  return { frames: plan.frames.map(frameToPlanned) };
}
