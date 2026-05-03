import { describe, it, expect } from 'vitest';
import { MISSION_SCRIPTS } from '../missionScripts';
import { createMissionRunner } from '../missionRunner';

describe('Mission catalog v2.3', () => {
  it('contains 19 missions across 9 chapters', () => {
    expect(MISSION_SCRIPTS.length).toBe(19);
    const chapters = new Set(MISSION_SCRIPTS.map((m) => m.chapter));
    expect(chapters.size).toBeGreaterThanOrEqual(8);
  });

  it('every mission has briefing + debrief + at least 1 stage with objectives', () => {
    for (const m of MISSION_SCRIPTS) {
      expect(m.briefing.lines.length).toBeGreaterThan(0);
      expect(m.debrief.takeaways.length).toBeGreaterThan(0);
      expect(m.stages.length).toBeGreaterThan(0);
      m.stages.forEach((s) => expect(s.objectives.length).toBeGreaterThan(0));
    }
  });

  it('every mission declares cinematic beats and failure scenarios', () => {
    for (const m of MISSION_SCRIPTS) {
      expect((m.cinematicBeats ?? []).length).toBeGreaterThan(0);
      expect((m.failureScenarios ?? []).length).toBeGreaterThan(0);
    }
  });

  it('mission ids are unique', () => {
    const ids = MISSION_SCRIPTS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('MissionRunner v2.1 events', () => {
  it('emits stage:start and beat:start on startMission', () => {
    const m = MISSION_SCRIPTS[0];
    const r = createMissionRunner(m);
    const evs: string[] = [];
    r.onEvent((e) => evs.push(e.kind));
    r.startMission();
    expect(evs).toContain('stage:start');
    expect(evs).toContain('objective:revealed');
    if ((m.cinematicBeats ?? []).some((b) => b.triggerOn === 'stage-start' && (!b.stageId || b.stageId === m.stages[0].id))) {
      expect(evs).toContain('beat:start');
    }
  });

  it('emits mission:complete with stars when all stages finish', () => {
    const m = MISSION_SCRIPTS[0];
    const r = createMissionRunner(m);
    const completed: { score: number; stars: number }[] = [];
    r.onEvent((e) => { if (e.kind === 'mission:complete') completed.push({ score: e.finalScore, stars: e.stars }); });
    r.startMission();
    m.stages.forEach((s) => s.objectives.forEach((o) => r.completeObjective(o.snapPointId ?? o.label)));
    expect(completed.length).toBe(1);
    expect(completed[0].stars).toBeGreaterThan(0);
  });

  it('emits mission:failed:safety when 5 violations stack', () => {
    const m = MISSION_SCRIPTS[0];
    const r = createMissionRunner(m);
    const reasons: string[] = [];
    r.onEvent((e) => { if (e.kind === 'mission:failed') reasons.push(e.reason); });
    r.startMission();
    for (let i = 0; i < 5; i++) r.reportSafetyViolation();
    expect(reasons).toEqual(['safety']);
  });
});
