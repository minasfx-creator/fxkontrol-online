import { describe, it, expect } from 'vitest';
import {
  appendShowPlan,
  lastCueEndTime,
  resumeOffsetFor,
  resumeOffsetAtCue,
} from '../continueShowPlan';
import type { ShowPlan, ShowSiteConfig } from '../types';

const site: ShowSiteConfig = {
  name: 'T',
  width: 100,
  depth: 100,
  maxHeight: 80,
  safetyDistance: 15,
  audiencePosition: 'front',
  showType: 'hybrid',
};

function makePlan(over: Partial<ShowPlan> = {}): ShowPlan {
  return {
    id: 'p1',
    title: 'Base',
    duration: 30,
    intent: 'base',
    style: 'classic',
    site,
    sections: [{ id: 's1', name: 'A', startTime: 0, duration: 30, intensity: 'medium', description: '' }],
    positions: [{ id: 'pos1', name: 'P1', type: 'pyro', x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#fff' }],
    timelineItems: [
      { id: 'it1', type: 'pyro_effect', label: 'cue', startTime: 5, duration: 2 },
      { id: 'it2', type: 'finale', label: 'fin', startTime: 25, duration: 4 },
    ],
    trajectories: [],
    safetyWarnings: ['w1'],
    assumptions: ['a1'],
    ...over,
  };
}

describe('continueShowPlan', () => {
  it('lastCueEndTime considers cue + duration', () => {
    expect(lastCueEndTime(makePlan())).toBe(29);
  });

  it('resumeOffsetFor uses max(duration, lastCue)', () => {
    expect(resumeOffsetFor(makePlan({ duration: 20 }))).toBe(29);
    expect(resumeOffsetFor(makePlan({ duration: 60 }))).toBe(60);
  });

  it('appendShowPlan shifts items, sections and trajectories by offset+gap', () => {
    const base = makePlan();
    const next = makePlan({
      id: 'p2',
      title: 'Next',
      duration: 20,
      intent: 'next',
      sections: [{ id: 's2', name: 'B', startTime: 0, duration: 20, intensity: 'high', description: '' }],
      positions: [{ id: 'pos2', name: 'P2', type: 'drone', x: 5, y: 0, z: 5, heading: 0, pitch: 0, roll: 0, color: '#0ff' }],
      timelineItems: [{ id: 'itN', type: 'drone_move', label: 'mv', startTime: 1, duration: 3 }],
      trajectories: [{ id: 'trN', name: 'T', positionId: 'pos2', waypoints: [{ x: 0, y: 0, z: 0, time: 0 }, { x: 1, y: 0, z: 0, time: 2 }] }],
      safetyWarnings: ['w1', 'w2'],
      assumptions: ['a2'],
    });

    const merged = appendShowPlan(base, next, { gap: 1 });
    // resumeOffsetFor(base) = max(duration=30, lastCue=29) = 30; offset = 30 + gap(1) = 31
    expect(merged.timelineItems).toHaveLength(3);
    expect(merged.timelineItems[2].startTime).toBe(32);
    expect(merged.sections[1].startTime).toBe(31);
    expect(merged.trajectories[0].waypoints[1].time).toBe(33);
    expect(merged.positions).toHaveLength(2);
    expect(merged.duration).toBe(51);
    expect(merged.safetyWarnings).toEqual(['w1', 'w2']);
    expect(merged.assumptions).toEqual(['a1', 'a2']);
  });

  it('does not mutate inputs', () => {
    const base = makePlan();
    const next = makePlan({ id: 'p2', timelineItems: [{ id: 'x', type: 'pyro_effect', label: 'l', startTime: 2 }] });
    const baseSnap = JSON.stringify(base);
    const nextSnap = JSON.stringify(next);
    appendShowPlan(base, next);
    expect(JSON.stringify(base)).toBe(baseSnap);
    expect(JSON.stringify(next)).toBe(nextSnap);
  });

  it('resumeOffsetAtCue uses cue end (start+duration), fallback to last when not found', () => {
    const p = makePlan();
    expect(resumeOffsetAtCue(p, 'it1')).toBe(7); // 5 + 2
    expect(resumeOffsetAtCue(p, 'it2')).toBe(29); // 25 + 4
    expect(resumeOffsetAtCue(p, 'missing')).toBe(resumeOffsetFor(p));
  });

  it('appendShowPlan with anchorCueId starts new segment at chosen cue end', () => {
    const base = makePlan();
    const next = makePlan({
      id: 'p2',
      duration: 10,
      sections: [],
      positions: [],
      timelineItems: [{ id: 'n1', type: 'pyro_effect', label: 'x', startTime: 0, duration: 2 }],
      trajectories: [],
      safetyWarnings: [],
      assumptions: [],
    });
    const merged = appendShowPlan(base, next, { gap: 0, anchorCueId: 'it1' });
    // anchor end = 7; new cue starts at 7
    const inserted = merged.timelineItems.find((i) => i.id === 'n1')!;
    expect(inserted.startTime).toBe(7);
    // existing later cue (it2 @25) is preserved
    expect(merged.timelineItems.find((i) => i.id === 'it2')!.startTime).toBe(25);
    // duration = max(base 30, anchor 7 + next 10) = 30
    expect(merged.duration).toBe(30);
  });
});
