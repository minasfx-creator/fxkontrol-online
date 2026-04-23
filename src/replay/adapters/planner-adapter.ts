/**
 * ─── Generic Planner Adapter ───────────────────────────────────────
 * Maps an arbitrary planner output (unknown shape) to the pure
 * ExecutionPlan contract used by the replay engine.
 *
 * Use this when integrating a new planner whose types don't match
 * the FXK ExecutionPlan exactly. For FXK-native plans, use
 * `plan-to-replay.ts` instead.
 */

import type {
  ExecutionPlan,
  PlannedEvent,
  PlannedFrame,
  PlannedRiskEnvelope,
} from "../types";

type UnknownRecord = Record<string, unknown>;

export interface PlannerAdapter<TPlan = unknown, TFrame = unknown, TEvent = unknown> {
  getFrames(plan: TPlan): TFrame[];
  mapFrame(frame: TFrame, frameIndexHint?: number): PlannedFrame;
  mapEvent(event: TEvent, frameIndexHint?: number): PlannedEvent;
}

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" ? (value as UnknownRecord) : {};
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function mapRiskEnvelope(input: unknown): PlannedRiskEnvelope | undefined {
  const obj = asRecord(input);

  const avg = optionalNumber(obj.avg ?? obj.average ?? obj.avgRisk);
  const peak = optionalNumber(obj.peak ?? obj.peakRisk ?? obj.max);
  const variance = optionalNumber(obj.variance ?? obj.var);
  const spread = optionalNumber(obj.spread ?? obj.range);

  if (
    avg === undefined &&
    peak === undefined &&
    variance === undefined &&
    spread === undefined
  ) {
    return undefined;
  }

  return { avg, peak, variance, spread };
}

export const defaultPlannerAdapter: PlannerAdapter = {
  getFrames(plan: unknown): unknown[] {
    const obj = asRecord(plan);
    if (Array.isArray(obj.frames)) return obj.frames;
    if (Array.isArray(obj.timeline)) return obj.timeline;
    if (Array.isArray(obj.plan)) return obj.plan;
    return [];
  },

  mapFrame(frame: unknown, frameIndexHint = 0): PlannedFrame {
    const obj = asRecord(frame);
    const rawEvents = Array.isArray(obj.events)
      ? obj.events
      : Array.isArray(obj.items)
        ? obj.items
        : Array.isArray(obj.commands)
          ? obj.commands
          : Array.isArray(obj.actions)
            ? obj.actions
            : [];

    const frameIndex = asNumber(obj.frameIndex ?? obj.frame ?? obj.index, frameIndexHint);

    return {
      frameIndex,
      hash: asString(obj.hash ?? obj.frameHash ?? obj.integrityHash, ""),
      degraded: asBoolean(obj.degraded ?? obj.degradedFrame ?? obj.isDegraded, false),
      riskEnvelope: mapRiskEnvelope(obj.riskEnvelope ?? obj.telemetry ?? obj.risk),
      events: rawEvents.map((event) => defaultPlannerAdapter.mapEvent(event, frameIndex)),
    };
  },

  mapEvent(event: unknown, frameIndexHint = 0): PlannedEvent {
    const obj = asRecord(event);

    return {
      frameIndex: asNumber(obj.frameIndex ?? obj.frame ?? obj.index, frameIndexHint),
      executionLayer: asString(obj.executionLayer ?? obj.layer ?? obj.domain, "unknown"),
      sequenceId: asString(obj.sequenceId ?? obj.id ?? obj.eventId, "unknown"),
      t0: asNumber(obj.t0 ?? obj.time ?? obj.scheduledAtMs ?? obj.plannedAtMs, 0),
      adapter: asString(obj.adapter ?? obj.adapterType ?? obj.target, "unknown"),
      channel: (obj.channel ?? obj.address ?? obj.output ?? obj.port) as
        | string
        | number
        | undefined,
      action: asString(obj.action ?? obj.command ?? obj.op ?? obj.type, ""),
    };
  },
};

export function mapExecutionPlanToReplayPlan<TPlan>(
  plan: TPlan,
  adapter: PlannerAdapter<TPlan> = defaultPlannerAdapter as PlannerAdapter<TPlan>,
): ExecutionPlan {
  const frames = adapter.getFrames(plan).map((frame, index) => adapter.mapFrame(frame, index));
  return { frames };
}
