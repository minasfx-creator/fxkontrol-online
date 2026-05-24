import { describe, it, expect } from 'vitest';
import { createMissionRunner, computeStarRating } from '../missionRunner';
import { MISSION_SCRIPTS, getMissionScript } from '../missionScripts';
import type { MissionScript } from '../types';

const sample: MissionScript = MISSION_SCRIPTS[0]; // tutorial-truss

describe('MissionRunner FSM', () => {
  it('starts in briefing phase', () => {
    const r = createMissionRunner(sample);
    expect(r.snapshot().phase).toBe('briefing');
    expect(r.snapshot().stageIndex).toBe(0);
  });

  it('startMission moves to running', () => {
    const r = createMissionRunner(sample);
    r.startMission();
    expect(r.snapshot().phase).toBe('running');
  });

  it('completing all objectives in a stage advances to next stage', () => {
    const r = createMissionRunner(sample);
    r.startMission();
    const stage = sample.stages[0];
    stage.objectives.forEach((o) => {
      const id = o.snapPointId ?? o.label;
      r.completeObjective(id);
    });
    expect(r.snapshot().stageIndex).toBe(1);
    expect(r.snapshot().phase).toBe('running');
  });

  it('finishing the last stage marks mission complete', () => {
    const r = createMissionRunner(sample);
    r.startMission();
    sample.stages.forEach((stage) => {
      stage.objectives.forEach((o) => r.completeObjective(o.snapPointId ?? o.label));
    });
    expect(r.snapshot().phase).toBe('complete');
  });

  it('tick reduces remaining time and fails on timeout', () => {
    const r = createMissionRunner(sample);
    r.startMission();
    r.tick(sample.timeLimitSeconds + 1);
    expect(r.snapshot().phase).toBe('failed');
  });

  it('safety violation reduces score, never below zero', () => {
    const r = createMissionRunner(sample);
    r.startMission();
    r.reportSafetyViolation();
    r.reportSafetyViolation();
    expect(r.snapshot().score).toBe(0);
    expect(r.snapshot().safetyViolations).toBe(2);
  });

  it('reset returns to briefing and zero state', () => {
    const r = createMissionRunner(sample);
    r.startMission();
    r.tick(10);
    r.reset();
    const s = r.snapshot();
    expect(s.phase).toBe('briefing');
    expect(s.stageIndex).toBe(0);
    expect(s.elapsedSeconds).toBe(0);
    expect(s.remainingSeconds).toBe(sample.timeLimitSeconds);
  });

  it('completeObjective is idempotent for the same id', () => {
    const r = createMissionRunner(sample);
    r.startMission();
    const id = sample.stages[0].objectives[0].snapPointId!;
    const first = r.completeObjective(id);
    const second = r.completeObjective(id);
    expect(first.scoreDelta).toBeGreaterThan(0);
    expect(second.scoreDelta).toBe(0);
  });

  it('subscribe emits on every state change', () => {
    const r = createMissionRunner(sample);
    let count = 0;
    const unsub = r.subscribe(() => count++);
    r.startMission();
    r.tick(1);
    expect(count).toBeGreaterThanOrEqual(3); // initial + start + tick
    unsub();
  });

  it('computeStarRating returns 0 on failure', () => {
    const r = createMissionRunner(sample);
    r.startMission();
    r.fail();
    expect(computeStarRating(sample, r.snapshot())).toBe(0);
  });
});

describe('Mission scripts catalog', () => {
  it('all scripts have at least one stage with objectives', () => {
    MISSION_SCRIPTS.forEach((script) => {
      expect(script.stages.length).toBeGreaterThan(0);
      const totalObjectives = script.stages.reduce((s, st) => s + st.objectives.length, 0);
      expect(totalObjectives).toBeGreaterThan(0);
    });
  });

  it('all scripts have a briefing with at least one line', () => {
    MISSION_SCRIPTS.forEach((script) => {
      expect(script.briefing.lines.length).toBeGreaterThan(0);
    });
  });

  it('all scripts have a debrief with at least one takeaway', () => {
    MISSION_SCRIPTS.forEach((script) => {
      expect(script.debrief.takeaways.length).toBeGreaterThan(0);
    });
  });

  it('all scripts have a positive timeLimit', () => {
    MISSION_SCRIPTS.forEach((script) => {
      expect(script.timeLimitSeconds).toBeGreaterThan(0);
    });
  });

  it('getMissionScript finds scripts by id', () => {
    expect(getMissionScript('tutorial-truss')).toBeDefined();
    expect(getMissionScript('nonexistent-id')).toBeUndefined();
  });
});
