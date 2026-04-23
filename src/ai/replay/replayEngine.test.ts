/**
 * Replay Engine v1 — determinism & divergence detection tests.
 */
import { describe, it, expect } from 'vitest';
import type { ExecutionPlan, ExecutionFrame, PlannedCommand } from '../joiExecutionPlanner';
import type { RuntimeTrace, ObservedFrame, ObservedEvent } from './types';
import { replayExecution } from './replayEngine';
import { __replayInternals } from './replayEngine';

// ─── Fixtures ──────────────────────────────────────────────────────
function mkCmd(seq: string, target: 'pyro' | 'dmx' | 'drone', action = 'fire'): PlannedCommand {
  return Object.freeze({
    sequenceId: seq,
    sourceStepId: `step-${seq}`,
    target,
    action: action as PlannedCommand['action'],
    params: Object.freeze({}),
    executionHint: { mode: 'simulated' as const, degraded: false },
    risk: 0.1,
  });
}

function mkFrame(index: number, frameSizeMs: number, cmds: PlannedCommand[], hash = `h-${index}`): ExecutionFrame {
  return Object.freeze<ExecutionFrame>({
    index,
    t0: index * frameSizeMs,
    t1: (index + 1) * frameSizeMs,
    hash,
    degraded: false,
    commands: Object.freeze(cmds),
    load: { logical: cmds.length, physical: cmds.length },
    telemetry: {
      risk: 0.1,
      avgRisk: 0.1,
      spread: 0,
      activeSteps: cmds.length,
      pyroLoad: cmds.filter((c) => c.target === 'pyro').length,
      dmxLoad: cmds.filter((c) => c.target === 'dmx').length,
      droneLoad: cmds.filter((c) => c.target === 'drone').length,
    },
  });
}

function mkPlan(frames: ExecutionFrame[]): ExecutionPlan {
  return Object.freeze<ExecutionPlan>({
    showId: 'test-show',
    version: 'joi-plan-v1',
    executionLayer: 'simulated',
    frameSizeMs: 16,
    frames: Object.freeze(frames),
    global: {
      duration: frames.length * 16,
      totalFrames: frames.length,
      maxConcurrency: Math.max(...frames.map((f) => f.commands.length), 0),
      riskEnvelope: { avg: 0.1, peak: 0.1, spread: 0 },
    },
  });
}

function traceFromPlan(plan: ExecutionPlan, mutate?: (frames: ObservedFrame[]) => ObservedFrame[]): RuntimeTrace {
  const projected = __replayInternals.projectPlan(plan);
  const frames: ObservedFrame[] = [];
  for (const [, pf] of projected) {
    frames.push({
      frameIndex: pf.frameIndex,
      hash: pf.hash,
      events: pf.events.map((e) => ({ ...e, executedAtMs: e.t0, status: 'ok' as const })),
    });
  }
  return { frames: mutate ? mutate(frames) : frames };
}

// ─── Tests ─────────────────────────────────────────────────────────
describe('replayExecution', () => {
  it('PASS when trace mirrors plan exactly', () => {
    const plan = mkPlan([
      mkFrame(0, 16, [mkCmd('a', 'pyro'), mkCmd('b', 'dmx')]),
      mkFrame(1, 16, [mkCmd('c', 'drone')]),
    ]);
    const trace = traceFromPlan(plan);
    const report = replayExecution(plan, trace);

    expect(report.integrity).toBe('PASS');
    expect(report.framesPlanned).toBe(2);
    expect(report.framesObserved).toBe(2);
    expect(report.matchedFrames).toBe(2);
    expect(report.divergences).toHaveLength(0);
    expect(report.timing.driftViolations).toBe(0);
  });

  it('detects missing_frame', () => {
    const plan = mkPlan([
      mkFrame(0, 16, [mkCmd('a', 'pyro')]),
      mkFrame(1, 16, [mkCmd('b', 'pyro')]),
    ]);
    const trace = traceFromPlan(plan, (fs) => fs.filter((f) => f.frameIndex !== 1));
    const report = replayExecution(plan, trace);

    expect(report.integrity).toBe('FAIL');
    expect(report.divergences.some((d) => d.type === 'missing_frame' && d.frameIndex === 1)).toBe(true);
  });

  it('detects extra_frame', () => {
    const plan = mkPlan([mkFrame(0, 16, [mkCmd('a', 'pyro')])]);
    const trace = traceFromPlan(plan, (fs) => [
      ...fs,
      { frameIndex: 99, hash: 'ghost', events: [] },
    ]);
    const report = replayExecution(plan, trace);

    expect(report.integrity).toBe('FAIL');
    expect(report.divergences.some((d) => d.type === 'extra_frame' && d.frameIndex === 99)).toBe(true);
  });

  it('detects hash_mismatch', () => {
    const plan = mkPlan([mkFrame(0, 16, [mkCmd('a', 'pyro')])]);
    const trace = traceFromPlan(plan, (fs) =>
      fs.map((f) => ({ ...f, hash: 'tampered' })),
    );
    const report = replayExecution(plan, trace);

    expect(report.integrity).toBe('FAIL');
    expect(report.divergences.some((d) => d.type === 'hash_mismatch')).toBe(true);
  });

  it('detects missing_event and extra_event', () => {
    const plan = mkPlan([mkFrame(0, 16, [mkCmd('a', 'pyro'), mkCmd('b', 'dmx')])]);

    const traceMissing = traceFromPlan(plan, (fs) =>
      fs.map((f) => ({ ...f, events: f.events.slice(0, 1) })),
    );
    const r1 = replayExecution(plan, traceMissing);
    expect(r1.divergences.some((d) => d.type === 'missing_event')).toBe(true);

    const traceExtra = traceFromPlan(plan, (fs) =>
      fs.map((f) => ({
        ...f,
        events: [
          ...f.events,
          { ...f.events[0], sequenceId: 'extra' } as ObservedEvent,
        ],
      })),
    );
    const r2 = replayExecution(plan, traceExtra);
    expect(r2.divergences.some((d) => d.type === 'extra_event')).toBe(true);
  });

  it('detects order_mismatch', () => {
    const plan = mkPlan([mkFrame(0, 16, [mkCmd('a', 'pyro'), mkCmd('b', 'dmx')])]);
    const trace = traceFromPlan(plan, (fs) =>
      fs.map((f) => ({ ...f, events: [f.events[1], f.events[0]] })),
    );
    const report = replayExecution(plan, trace);
    expect(report.integrity).toBe('FAIL');
    expect(report.divergences.some((d) => d.type === 'order_mismatch')).toBe(true);
  });

  it('detects timing_drift above tolerance', () => {
    const plan = mkPlan([mkFrame(0, 16, [mkCmd('a', 'pyro')])]);
    const trace = traceFromPlan(plan, (fs) =>
      fs.map((f) => ({
        ...f,
        events: f.events.map((e) => ({ ...e, executedAtMs: e.t0 + 50 })),
      })),
    );
    const report = replayExecution(plan, trace, { maxDriftMs: 5 });
    expect(report.integrity).toBe('FAIL');
    expect(report.timing.driftViolations).toBeGreaterThan(0);
    expect(report.timing.peakDriftMs).toBeGreaterThanOrEqual(50);
  });

  it('flags adapter failure', () => {
    const plan = mkPlan([mkFrame(0, 16, [mkCmd('a', 'pyro')])]);
    const trace = traceFromPlan(plan, (fs) =>
      fs.map((f) => ({
        ...f,
        events: f.events.map((e) => ({ ...e, status: 'fail' as const })),
      })),
    );
    const report = replayExecution(plan, trace);
    expect(report.divergences.some((d) => d.type === 'adapter_mismatch')).toBe(true);
  });

  it('is deterministic (same inputs → same report)', () => {
    const plan = mkPlan([
      mkFrame(0, 16, [mkCmd('a', 'pyro'), mkCmd('b', 'dmx')]),
      mkFrame(1, 16, [mkCmd('c', 'drone')]),
    ]);
    const trace = traceFromPlan(plan);
    const r1 = replayExecution(plan, trace);
    const r2 = replayExecution(plan, trace);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
