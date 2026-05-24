import { describe, it, expect, beforeEach, vi } from 'vitest';
import { evaluateSystemReadiness } from '@/hooks/useSystemReadiness';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { createEmptyShowPlan } from '@/core/showplan/ShowPlan';
import { safetyStateMachine } from '@/core/safety/SafetyStateMachine';
import { workMode } from '@/core/safety/workMode';

describe('useSystemReadiness — pure evaluator', () => {
  beforeEach(() => {
    showPlanManager.load(createEmptyShowPlan());
    workMode.set('design');
    // Reset SSM via E_STOP then RESET
    safetyStateMachine.transition('E_STOP', { caller: 'human' });
    safetyStateMachine.transition('RESET_SAFETY', { caller: 'human' });
  });

  it('returns EMPTY when ShowPlan has no cues', () => {
    const r = evaluateSystemReadiness();
    expect(r.status).toBe('EMPTY');
    expect(r.showPlanLoaded).toBe(false);
    expect(r.readinessStatus).toBe('NO_PLAN');
  });

  it('reports current workMode', () => {
    workMode.set('simulation');
    expect(evaluateSystemReadiness().workMode).toBe('simulation');
  });

  it('safety state precedence: E_STOPPED beats EMPTY', () => {
    safetyStateMachine.transition('E_STOP', { caller: 'human' });
    const r = evaluateSystemReadiness();
    expect(r.status).toBe('E_STOPPED');
    expect(r.safetyState).toBe('SAFE');
  });

  it('exposes dominant provenance defaulting to none when aggregator empty', () => {
    const r = evaluateSystemReadiness();
    expect(['none', 'simulated', 'live_read_only', 'replay', 'not_integrated'])
      .toContain(r.dominantProvenance);
  });

  it('blockingReasons + warnings are arrays', () => {
    const r = evaluateSystemReadiness();
    expect(Array.isArray(r.blockingReasons)).toBe(true);
    expect(Array.isArray(r.warnings)).toBe(true);
  });

  it('does NOT call uiCommandGateway / fieldBus / SSM.transition', () => {
    // Spy on transition — evaluator must be pure read.
    const spy = vi.spyOn(safetyStateMachine, 'transition');
    spy.mockClear();
    evaluateSystemReadiness();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
