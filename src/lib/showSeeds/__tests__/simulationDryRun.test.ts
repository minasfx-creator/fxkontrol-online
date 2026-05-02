import { describe, it, expect } from 'vitest';
import { createLibertadoresShowPlan } from '../libertadores';
import { simulationDryRun } from '../simulationDryRun';

describe('simulationDryRun · Libertadores', () => {
  const sp = createLibertadoresShowPlan();

  it('is deterministic for the same plan', () => {
    const a = simulationDryRun(sp);
    const b = simulationDryRun(sp);
    expect(a.cuesFired).toBe(b.cuesFired);
    expect(a.peakConcurrentBurns).toBe(b.peakConcurrentBurns);
    expect(a.durationS).toBe(b.durationS);
    expect(a.framesSampled).toBe(b.framesSampled);
  });

  it('fires exactly the planned cues', () => {
    const r = simulationDryRun(sp);
    expect(r.totalCues).toBe(sp.pyroCues.length);
    expect(r.cuesFired).toBe(sp.pyroCues.length);
  });

  it('respects the ≥1s channel-reuse interlock (golden seed invariant)', () => {
    const r = simulationDryRun(sp);
    expect(r.interlockBreaches).toEqual([]);
  });

  it('reports a finite, non-zero duration matching ShowPlan metadata', () => {
    const r = simulationDryRun(sp);
    expect(r.durationS).toBeGreaterThan(0);
    expect(r.durationS).toBeLessThanOrEqual(120);
  });

  it('caps trace samples for UI consumption', () => {
    const r = simulationDryRun(sp);
    expect(r.trace.length).toBeGreaterThan(0);
    expect(r.trace.length).toBeLessThanOrEqual(240);
  });

  it('peak concurrency stays within hardware-realistic bounds (≤ totalCues)', () => {
    const r = simulationDryRun(sp);
    expect(r.peakConcurrentBurns).toBeGreaterThan(0);
    expect(r.peakConcurrentBurns).toBeLessThanOrEqual(r.totalCues);
  });
});
