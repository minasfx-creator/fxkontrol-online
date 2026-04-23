/**
 * Replay Engine v1 — deterministic ExecutionPlan ↔ RuntimeTrace verifier.
 *
 * Compares planned frames vs observed frames and produces a pure
 * ReplayReport. No UI. No side effects. Bit-exact.
 *
 * Detection coverage:
 *   - missing_frame / extra_frame
 *   - hash_mismatch
 *   - missing_event / extra_event
 *   - order_mismatch (positional signature diff)
 *   - timing_drift (configurable per-event tolerance)
 */

import type { ExecutionPlan, ExecutionFrame, PlannedCommand } from '../joiExecutionPlanner';
import { eventSignature } from './eventSignature';
import type {
  ObservedEvent,
  ObservedFrame,
  ReplayDivergence,
  ReplayIntegrity,
  ReplayOptions,
  ReplayReport,
  RuntimeTrace,
} from './types';

// ─── Plan adapter ──────────────────────────────────────────────────
// ExecutionFrame uses `index` + `commands`. The replay contract
// uses `frameIndex` + `events`. We project the plan into the
// observation shape so the comparator stays format-agnostic.
function plannedEventFromCommand(
  frameIndex: number,
  t0: number,
  cmd: PlannedCommand,
): ObservedEvent {
  return {
    frameIndex,
    executionLayer: cmd.executionHint.mode,
    sequenceId: cmd.sequenceId,
    t0,
    adapter: cmd.target,
    action: cmd.action,
  };
}

interface ProjectedPlanFrame {
  frameIndex: number;
  hash: string;
  events: ObservedEvent[];
}

function projectPlan(plan: ExecutionPlan): Map<number, ProjectedPlanFrame> {
  const out = new Map<number, ProjectedPlanFrame>();
  for (const frame of plan.frames as readonly ExecutionFrame[]) {
    const events = frame.commands.map((cmd) =>
      plannedEventFromCommand(frame.index, frame.t0, cmd),
    );
    out.set(frame.index, {
      frameIndex: frame.index,
      hash: frame.hash,
      events,
    });
  }
  return out;
}

// ─── Public API ────────────────────────────────────────────────────
export function replayExecution(
  plan: ExecutionPlan,
  trace: RuntimeTrace,
  opts: ReplayOptions = {},
): ReplayReport {
  const maxDriftMs = opts.maxDriftMs ?? 5;
  const divergences: ReplayDivergence[] = [];
  let matchedFrames = 0;
  let totalDrift = 0;
  let peakDriftMs = 0;
  let driftViolations = 0;
  let driftSamples = 0;

  const plannedFrames = projectPlan(plan);
  const observedFrames = new Map<number, ObservedFrame>(
    trace.frames.map((f) => [f.frameIndex, f]),
  );

  const allFrameIndexes = Array.from(
    new Set<number>([...plannedFrames.keys(), ...observedFrames.keys()]),
  ).sort((a, b) => a - b);

  for (const frameIndex of allFrameIndexes) {
    const planned = plannedFrames.get(frameIndex);
    const observed = observedFrames.get(frameIndex);

    if (!planned && observed) {
      divergences.push({
        frameIndex,
        type: 'extra_frame',
        severity: 'critical',
        message: 'Frame executado sem existir no plano.',
        observed,
      });
      continue;
    }

    if (planned && !observed) {
      divergences.push({
        frameIndex,
        type: 'missing_frame',
        severity: 'critical',
        message: 'Frame planejado não foi executado.',
        planned,
      });
      continue;
    }

    if (!planned || !observed) continue;

    let frameOk = true;

    // Hash check — structural identity
    if (planned.hash !== observed.hash) {
      frameOk = false;
      divergences.push({
        frameIndex,
        type: 'hash_mismatch',
        severity: 'critical',
        message: 'Hash do frame diverge entre plano e runtime.',
        planned: planned.hash,
        observed: observed.hash,
      });
    }

    // Event count
    if (planned.events.length !== observed.events.length) {
      frameOk = false;
      divergences.push({
        frameIndex,
        type:
          planned.events.length > observed.events.length
            ? 'missing_event'
            : 'extra_event',
        severity: 'critical',
        message: 'Quantidade de eventos diverge no frame.',
        planned: planned.events.length,
        observed: observed.events.length,
      });
    }

    // Positional comparison up to common length
    const n = Math.min(planned.events.length, observed.events.length);
    for (let i = 0; i < n; i++) {
      const p = planned.events[i];
      const o = observed.events[i];

      const ps = eventSignature(p);
      const os = eventSignature(o);

      if (ps !== os) {
        frameOk = false;
        divergences.push({
          frameIndex,
          type: 'order_mismatch',
          severity: 'critical',
          message: `Evento divergente na posição ${i}.`,
          planned: ps,
          observed: os,
        });
      }

      // Drift accounting
      const observedTime = o.executedAtMs ?? o.t0;
      const drift = Math.abs(observedTime - p.t0);
      totalDrift += drift;
      driftSamples++;
      if (drift > peakDriftMs) peakDriftMs = drift;

      if (drift > maxDriftMs) {
        frameOk = false;
        driftViolations++;
        divergences.push({
          frameIndex,
          type: 'timing_drift',
          severity: drift > maxDriftMs * 3 ? 'critical' : 'warn',
          message: `Drift acima do limite no evento ${i}.`,
          planned: p.t0,
          observed: observedTime,
        });
      }

      // Adapter status (optional channel)
      if (o.status === 'fail') {
        frameOk = false;
        divergences.push({
          frameIndex,
          type: 'adapter_mismatch',
          severity: 'critical',
          message: `Adapter reportou falha no evento ${i}.`,
          planned: p.adapter,
          observed: o.status,
        });
      }
    }

    if (frameOk) matchedFrames++;
  }

  const integrity: ReplayIntegrity = divergences.some(
    (d) => d.severity === 'critical',
  )
    ? 'FAIL'
    : 'PASS';

  return Object.freeze<ReplayReport>({
    integrity,
    framesPlanned: plan.frames.length,
    framesObserved: trace.frames.length,
    matchedFrames,
    divergences: Object.freeze(divergences),
    timing: {
      avgDriftMs: driftSamples > 0 ? totalDrift / driftSamples : 0,
      peakDriftMs,
      driftViolations,
    },
  });
}

export const __replayInternals = { projectPlan, plannedEventFromCommand };
