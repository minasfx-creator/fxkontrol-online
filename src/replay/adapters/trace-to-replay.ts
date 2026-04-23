/**
 * Adapter: ai/joiExecutionRuntime.RuntimeFrameTrace[] → replay.RuntimeTrace.
 *
 * The runtime trace is frame-level (no per-event timestamps) — we synthesize
 * observed events from the corresponding plan frame using the trace hash and
 * frame wall time as the executedAtMs anchor for every event in the frame.
 *
 * This is honest: the runtime currently dispatches all commands of a frame
 * as a single tick boundary, so per-event drift collapses to per-frame drift.
 */
import type { RuntimeFrameTrace } from "@/ai/joiExecutionRuntime";
import type {
  ExecutionPlan as AiExecutionPlan,
} from "@/ai/joiExecutionPlanner";
import type { ObservedEvent, ObservedFrame, RuntimeTrace } from "../types";
import { planToReplay } from "./plan-to-replay";

export interface TraceAdapterOptions {
  /** Map runtime adapter status from abort reason; default 'ok'. */
  defaultStatus?: ObservedEvent["adapterStatus"];
}

export function traceToReplay(
  plan: AiExecutionPlan,
  runtimeTrace: readonly RuntimeFrameTrace[],
  opts: TraceAdapterOptions = {},
): RuntimeTrace {
  const projected = planToReplay(plan);
  const planByIndex = new Map(projected.frames.map((f) => [f.frameIndex, f]));

  const frames: ObservedFrame[] = runtimeTrace.map((entry) => {
    const planFrame = planByIndex.get(entry.frameIndex);
    const planEvents = planFrame?.events ?? [];

    const status: ObservedEvent["adapterStatus"] = entry.aborted
      ? "failed"
      : (opts.defaultStatus ?? "ok");

    const events: ObservedEvent[] = planEvents.map((p) => ({
      ...p,
      executedAtMs: entry.wallTimeMs,
      adapterStatus: status,
    }));

    return {
      frameIndex: entry.frameIndex,
      hash: entry.hash,
      riskEnvelope: { peak: entry.risk },
      events,
    };
  });

  return { frames };
}
