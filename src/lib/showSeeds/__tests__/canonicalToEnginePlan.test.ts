import { describe, it, expect } from 'vitest';
import { createLibertadoresShowPlan } from '../libertadores';
import { canonicalToEnginePlan } from '../canonicalToEnginePlan';
import { adaptShowPlanToSceneGraph } from '@/lib/showEngine/SceneAdapter';
import { compileTimeline, cuesActivatedBetween, cuesAt } from '@/lib/showEngine/timelineCompiler';

describe('Libertadores → Engine adapter (Show3DEngine pipeline)', () => {
  const sp = createLibertadoresShowPlan();
  const enginePlan = canonicalToEnginePlan(sp);

  it('is deterministic (same input → same output)', () => {
    const a = canonicalToEnginePlan(sp);
    const b = canonicalToEnginePlan(sp);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('preserves cardinality (positions + timelineItems)', () => {
    expect(enginePlan.positions.length).toBe(sp.positions.length);
    expect(enginePlan.timelineItems.length).toBe(sp.pyroCues.length);
  });

  it('produces a time-ordered timeline starting at t=0', () => {
    expect(enginePlan.timelineItems.length).toBeGreaterThan(0);
    expect(enginePlan.timelineItems[0].startTime).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < enginePlan.timelineItems.length; i++) {
      expect(enginePlan.timelineItems[i].startTime).toBeGreaterThanOrEqual(
        enginePlan.timelineItems[i - 1].startTime,
      );
    }
  });

  it('site bounds wrap the actual position footprint', () => {
    const xs = enginePlan.positions.map(p => p.x);
    const span = Math.max(...xs) - Math.min(...xs);
    expect(enginePlan.site.width).toBeGreaterThanOrEqual(span);
    expect(enginePlan.site.depth).toBeGreaterThan(0);
  });

  it('SceneAdapter accepts the converted plan and produces a populated graph', () => {
    const graph = adaptShowPlanToSceneGraph(enginePlan);
    expect(graph).toBeTruthy();
    // graph must have at least the site + the positions
    const positions = (graph as { positions?: unknown[] }).positions;
    if (Array.isArray(positions)) {
      expect(positions.length).toBe(enginePlan.positions.length);
    }
  });

  it('compileTimeline accepts the converted plan with non-zero duration', () => {
    const compiled = compileTimeline(enginePlan);
    expect(compiled.duration).toBeGreaterThan(0);
    expect(compiled.duration).toBeLessThanOrEqual(enginePlan.duration + 5);
  });

  it('cuesActivatedBetween covers all cues across the show window', () => {
    const compiled = compileTimeline(enginePlan);
    const all = cuesActivatedBetween(compiled, -1, compiled.duration + 1);
    expect(all.length).toBe(sp.pyroCues.length);
  });

  it('cuesAt(midpoint) returns a finite, plausible active set', () => {
    const compiled = compileTimeline(enginePlan);
    const mid = compiled.duration / 2;
    const active = cuesAt(compiled, mid);
    expect(Array.isArray(active)).toBe(true);
    expect(active.length).toBeGreaterThanOrEqual(0);
    expect(active.length).toBeLessThanOrEqual(sp.pyroCues.length);
  });
});
