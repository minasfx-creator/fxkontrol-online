import { eventSignature } from "./event-signature";
import type {
  ExecutionPlan,
  ObservedEvent,
  ObservedFrame,
  PlannedEvent,
  PlannedFrame,
  ReplayDivergence,
  ReplayIntegrity,
  ReplayOptions,
  ReplayReport,
  RuntimeTrace,
} from "./types";

function compareNumber(
  planned: number | undefined,
  observed: number | undefined,
  tolerance: number,
): boolean {
  if (planned == null && observed == null) return true;
  if (planned == null || observed == null) return false;
  return Math.abs(planned - observed) <= tolerance;
}

function compareRiskEnvelope(
  frameIndex: number,
  planned: PlannedFrame,
  observed: ObservedFrame,
  riskTolerance: number,
): ReplayDivergence[] {
  const divergences: ReplayDivergence[] = [];
  const p = planned.riskEnvelope;
  const o = observed.riskEnvelope;

  if (!p && !o) return divergences;
  if (!p || !o) {
    divergences.push({
      frameIndex,
      type: "risk_mismatch",
      severity: "warn",
      message: "Risk envelope ausente em um dos lados.",
      planned: p,
      observed: o,
    });
    return divergences;
  }

  const fields: Array<keyof NonNullable<typeof p>> = ["avg", "peak", "variance", "spread"];

  for (const field of fields) {
    if (!compareNumber(p[field], o[field], riskTolerance)) {
      divergences.push({
        frameIndex,
        type: "risk_mismatch",
        severity: "warn",
        message: `Risk envelope divergente no campo "${field}".`,
        planned: p[field],
        observed: o[field],
      });
    }
  }

  return divergences;
}

function compareAdapterStatus(
  frameIndex: number,
  plannedEvent: PlannedEvent,
  observedEvent: ObservedEvent,
): ReplayDivergence[] {
  const divergences: ReplayDivergence[] = [];

  if (observedEvent.adapterStatus && observedEvent.adapterStatus !== "ok") {
    divergences.push({
      frameIndex,
      type: "adapter_mismatch",
      severity: observedEvent.adapterStatus === "failed" ? "critical" : "warn",
      message: `Adapter reportou status "${observedEvent.adapterStatus}".`,
      planned: plannedEvent.adapter,
      observed: observedEvent.adapterStatus,
    });
  }

  return divergences;
}

function compareEvents(
  frameIndex: number,
  plannedEvents: PlannedEvent[],
  observedEvents: ObservedEvent[],
  maxDriftMs: number,
): {
  divergences: ReplayDivergence[];
  totalDrift: number;
  peakDriftMs: number;
  driftViolations: number;
} {
  const divergences: ReplayDivergence[] = [];
  let totalDrift = 0;
  let peakDriftMs = 0;
  let driftViolations = 0;

  if (plannedEvents.length !== observedEvents.length) {
    divergences.push({
      frameIndex,
      type:
        plannedEvents.length > observedEvents.length ? "missing_event" : "extra_event",
      severity: "critical",
      message: "Quantidade de eventos diverge no frame.",
      planned: plannedEvents.length,
      observed: observedEvents.length,
    });
  }

  const plannedSet = new Set(plannedEvents.map(eventSignature));
  const observedSet = new Set(observedEvents.map(eventSignature));

  for (const sig of plannedSet) {
    if (!observedSet.has(sig)) {
      divergences.push({
        frameIndex,
        type: "missing_event",
        severity: "critical",
        message: "Evento planejado não apareceu no runtime.",
        planned: sig,
      });
    }
  }

  for (const sig of observedSet) {
    if (!plannedSet.has(sig)) {
      divergences.push({
        frameIndex,
        type: "extra_event",
        severity: "critical",
        message: "Evento executado não existe no plano.",
        observed: sig,
      });
    }
  }

  const n = Math.min(plannedEvents.length, observedEvents.length);

  for (let i = 0; i < n; i++) {
    const p = plannedEvents[i];
    const o = observedEvents[i];

    const ps = eventSignature(p);
    const os = eventSignature(o);

    if (ps !== os) {
      divergences.push({
        frameIndex,
        type: "order_mismatch",
        severity: "critical",
        message: `Evento divergente na posição ${i}.`,
        planned: ps,
        observed: os,
      });
    }

    const observedTime = o.executedAtMs ?? o.t0;
    const drift = Math.abs(observedTime - p.t0);

    totalDrift += drift;
    peakDriftMs = Math.max(peakDriftMs, drift);

    if (drift > maxDriftMs) {
      driftViolations += 1;
      divergences.push({
        frameIndex,
        type: "timing_drift",
        severity: drift > maxDriftMs * 3 ? "critical" : "warn",
        message: `Drift acima do limite no evento ${i}.`,
        planned: p.t0,
        observed: observedTime,
      });
    }

    divergences.push(...compareAdapterStatus(frameIndex, p, o));
  }

  return { divergences, totalDrift, peakDriftMs, driftViolations };
}

export function replayExecution(
  plan: ExecutionPlan,
  trace: RuntimeTrace,
  opts: ReplayOptions = {},
): ReplayReport {
  const maxDriftMs = opts.maxDriftMs ?? 5;
  const riskTolerance = opts.riskTolerance ?? 0.001;
  const failOnWarnings = opts.failOnWarnings ?? false;

  const divergences: ReplayDivergence[] = [];
  let matchedFrames = 0;
  let totalDrift = 0;
  let peakDriftMs = 0;
  let driftViolations = 0;

  const plannedFrames = new Map<number, PlannedFrame>(
    plan.frames.map((f) => [f.frameIndex, f]),
  );
  const observedFrames = new Map<number, ObservedFrame>(
    trace.frames.map((f) => [f.frameIndex, f]),
  );

  const allFrameIndexes = Array.from(
    new Set([...plannedFrames.keys(), ...observedFrames.keys()]),
  ).sort((a, b) => a - b);

  for (const frameIndex of allFrameIndexes) {
    const planned = plannedFrames.get(frameIndex);
    const observed = observedFrames.get(frameIndex);

    if (!planned && observed) {
      divergences.push({
        frameIndex,
        type: "extra_frame",
        severity: "critical",
        message: "Frame executado sem existir no plano.",
        observed,
      });
      continue;
    }

    if (planned && !observed) {
      divergences.push({
        frameIndex,
        type: "missing_frame",
        severity: "critical",
        message: "Frame planejado não foi executado.",
        planned,
      });
      continue;
    }

    if (!planned || !observed) continue;

    const beforeCount = divergences.length;

    if (planned.hash !== observed.hash) {
      divergences.push({
        frameIndex,
        type: "hash_mismatch",
        severity: "critical",
        message: "Hash do frame diverge entre plano e runtime.",
        planned: planned.hash,
        observed: observed.hash,
      });
    }

    divergences.push(
      ...compareRiskEnvelope(frameIndex, planned, observed, riskTolerance),
    );

    const eventResult = compareEvents(
      frameIndex,
      planned.events,
      observed.events,
      maxDriftMs,
    );

    divergences.push(...eventResult.divergences);
    totalDrift += eventResult.totalDrift;
    peakDriftMs = Math.max(peakDriftMs, eventResult.peakDriftMs);
    driftViolations += eventResult.driftViolations;

    if (divergences.length === beforeCount) {
      matchedFrames += 1;
    }
  }

  const observedEventCount = trace.frames.reduce(
    (acc, f) => acc + f.events.length,
    0,
  );

  const hasCritical = divergences.some((d) => d.severity === "critical");
  const hasWarn = divergences.some((d) => d.severity === "warn");

  const integrity: ReplayIntegrity =
    hasCritical || (failOnWarnings && hasWarn) ? "FAIL" : "PASS";

  return {
    integrity,
    framesPlanned: plan.frames.length,
    framesObserved: trace.frames.length,
    matchedFrames,
    divergences,
    timing: {
      avgDriftMs: observedEventCount > 0 ? totalDrift / observedEventCount : 0,
      peakDriftMs,
      driftViolations,
    },
  };
}
