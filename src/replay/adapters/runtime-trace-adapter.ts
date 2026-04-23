/**
 * ─── Generic Runtime Trace Adapter ─────────────────────────────────
 * Maps an arbitrary runtime trace (unknown shape) to the pure
 * RuntimeTrace contract used by the replay engine.
 *
 * For FXK-native traces, use `trace-to-replay.ts` instead.
 */

import type {
  ObservedEvent,
  ObservedFrame,
  ObservedRiskEnvelope,
  RuntimeTrace,
} from "../types";

type UnknownRecord = Record<string, unknown>;

export interface RuntimeTraceAdapter<TTrace = unknown, TFrame = unknown, TEvent = unknown> {
  getFrames(trace: TTrace): TFrame[];
  mapFrame(frame: TFrame, frameIndexHint?: number): ObservedFrame;
  mapEvent(event: TEvent, frameIndexHint?: number): ObservedEvent;
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

function mapRiskEnvelope(input: unknown): ObservedRiskEnvelope | undefined {
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

function mapAdapterStatus(value: unknown): "ok" | "failed" | "degraded" | undefined {
  if (value === "ok" || value === "failed" || value === "degraded") return value;

  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (["ok", "success", "passed"].includes(normalized)) return "ok";
    if (["failed", "error", "aborted"].includes(normalized)) return "failed";
    if (["degraded", "partial", "warn"].includes(normalized)) return "degraded";
  }

  return undefined;
}

export const defaultRuntimeTraceAdapter: RuntimeTraceAdapter = {
  getFrames(trace: unknown): unknown[] {
    const obj = asRecord(trace);
    if (Array.isArray(obj.frames)) return obj.frames;
    if (Array.isArray(obj.trace)) return obj.trace;
    if (Array.isArray(obj.timeline)) return obj.timeline;
    return [];
  },

  mapFrame(frame: unknown, frameIndexHint = 0): ObservedFrame {
    const obj = asRecord(frame);
    const rawEvents = Array.isArray(obj.events)
      ? obj.events
      : Array.isArray(obj.executedEvents)
        ? obj.executedEvents
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
      events: rawEvents.map((event) =>
        defaultRuntimeTraceAdapter.mapEvent(event, frameIndex),
      ),
    };
  },

  mapEvent(event: unknown, frameIndexHint = 0): ObservedEvent {
    const obj = asRecord(event);

    const t0 = asNumber(obj.t0 ?? obj.time ?? obj.scheduledAtMs ?? obj.plannedAtMs, 0);

    return {
      frameIndex: asNumber(obj.frameIndex ?? obj.frame ?? obj.index, frameIndexHint),
      executionLayer: asString(obj.executionLayer ?? obj.layer ?? obj.domain, "unknown"),
      sequenceId: asString(obj.sequenceId ?? obj.id ?? obj.eventId, "unknown"),
      t0,
      executedAtMs: asNumber(
        obj.executedAtMs ?? obj.actualTimeMs ?? obj.timestampMs ?? obj.ts ?? obj.runtimeTs,
        t0,
      ),
      adapter: asString(obj.adapter ?? obj.adapterType ?? obj.target, "unknown"),
      channel: (obj.channel ?? obj.address ?? obj.output ?? obj.port) as
        | string
        | number
        | undefined,
      action: asString(obj.action ?? obj.command ?? obj.op ?? obj.type, ""),
      adapterStatus: mapAdapterStatus(obj.adapterStatus ?? obj.status ?? obj.result),
    };
  },
};

export function mapRuntimeTraceToReplayTrace<TTrace>(
  trace: TTrace,
  adapter: RuntimeTraceAdapter<TTrace> = defaultRuntimeTraceAdapter as RuntimeTraceAdapter<TTrace>,
): RuntimeTrace {
  const frames = adapter.getFrames(trace).map((frame, index) => adapter.mapFrame(frame, index));
  return { frames };
}
