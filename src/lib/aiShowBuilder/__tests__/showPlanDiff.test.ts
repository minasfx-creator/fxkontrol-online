import { describe, it, expect } from 'vitest';
import { diffShowPlan, summarizeDiff } from '../showPlanDiff';
import type { ShowPlan, ShowSiteConfig } from '../types';

const site: ShowSiteConfig = {
  name: 'T', width: 100, depth: 100, maxHeight: 80,
  safetyDistance: 15, audiencePosition: 'front', showType: 'hybrid',
};

function plan(over: Partial<ShowPlan> = {}): ShowPlan {
  return {
    id: 'p', title: 'p', duration: 10, intent: '', style: '',
    site, sections: [], positions: [], timelineItems: [], trajectories: [],
    safetyWarnings: [], assumptions: [], ...over,
  };
}

describe('showPlanDiff', () => {
  it('detects added/removed cues, positions, sections, trajectories and duration delta', () => {
    const prev = plan({
      duration: 10,
      timelineItems: [{ id: 'a', type: 'pyro_effect', label: 'A', startTime: 1 }],
      positions: [{ id: 'p1', name: 'P1', type: 'pyro', x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#fff' }],
      sections: [{ id: 's1', name: 'S1', startTime: 0, duration: 10, intensity: 'medium', description: '' }],
    });
    const next = plan({
      duration: 25,
      timelineItems: [
        { id: 'a', type: 'pyro_effect', label: 'A', startTime: 1 },
        { id: 'b', type: 'finale', label: 'B', startTime: 20 },
      ],
      positions: prev.positions,
      sections: [
        ...prev.sections,
        { id: 's2', name: 'S2', startTime: 11, duration: 14, intensity: 'high', description: '' },
      ],
      trajectories: [{ id: 't1', name: 'T1', positionId: 'p1', waypoints: [] }],
    });
    const d = diffShowPlan(prev, next);
    expect(d.addedCueIds).toEqual(['b']);
    expect(d.removedCueIds).toEqual([]);
    expect(d.addedSectionIds).toEqual(['s2']);
    expect(d.addedTrajectoryIds).toEqual(['t1']);
    expect(d.addedPositionIds).toEqual([]);
    expect(d.durationDelta).toBe(15);
    expect(summarizeDiff(d)).toContain('+1 cues');
    expect(summarizeDiff(d)).toContain('+15.0s');
  });

  it('summarize "sem mudanças" when identical', () => {
    const p = plan();
    expect(summarizeDiff(diffShowPlan(p, p))).toBe('sem mudanças');
  });
});
