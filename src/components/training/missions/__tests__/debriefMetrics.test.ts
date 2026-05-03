import { describe, it, expect } from 'vitest';
import { computeDebriefMetrics, type PlacementAttempt } from '../debriefMetrics';
import { createMissionRunner } from '../missionRunner';
import { MISSION_SCRIPTS } from '../missionScripts';

const script = MISSION_SCRIPTS[0];

function runToComplete() {
  const r = createMissionRunner(script);
  r.startMission();
  script.stages.forEach((s) => s.objectives.forEach((o) => r.completeObjective(o.snapPointId ?? o.label)));
  return r.snapshot();
}

const buildAttempts = (correct: number, wrong: number): PlacementAttempt[] => {
  const out: PlacementAttempt[] = [];
  for (let i = 0; i < correct; i++) out.push({ tMs: i * 1000, snapPointId: `sp-${i}`, equipmentId: 'eq', correct: true });
  for (let i = 0; i < wrong; i++) out.push({ tMs: (correct + i) * 1000, snapPointId: `sp-w-${i}`, equipmentId: 'eq', correct: false });
  return out;
};

describe('computeDebriefMetrics', () => {
  it('returns 4 canonical rows in stable order', () => {
    const snap = runToComplete();
    const m = computeDebriefMetrics({ script, snap, attempts: [] });
    expect(m.rows.map((r) => r.id)).toEqual(['time', 'accuracy3p', 'positioning', 'errors']);
  });

  it('grades a perfect run with high overall score', () => {
    const snap = runToComplete();
    const totalObj = script.stages.reduce((a, s) => a + s.objectives.length, 0);
    const m = computeDebriefMetrics({ script, snap, attempts: buildAttempts(totalObj, 0) });
    expect(m.overallScore).toBeGreaterThan(0.85);
    expect(['S', 'A']).toContain(m.overallGrade);
    expect(m.rows.find((r) => r.id === 'errors')!.score).toBe(1);
  });

  it('penalises wrong attempts in accuracy + errors rows', () => {
    const snap = runToComplete();
    const totalObj = script.stages.reduce((a, s) => a + s.objectives.length, 0);
    const m = computeDebriefMetrics({ script, snap, attempts: buildAttempts(totalObj, 4) });
    const acc = m.rows.find((r) => r.id === 'accuracy3p')!;
    const err = m.rows.find((r) => r.id === 'errors')!;
    expect(acc.score).toBeLessThan(1);
    expect(err.score).toBeLessThan(0.5);
    expect(m.recommendations.length).toBeGreaterThan(0);
  });

  it('always returns at least one recommendation', () => {
    const snap = runToComplete();
    const m = computeDebriefMetrics({ script, snap, attempts: [] });
    expect(m.recommendations.length).toBeGreaterThan(0);
  });

  it('flags incomplete missions in recommendations', () => {
    const r = createMissionRunner(script);
    r.startMission();
    r.fail('manual');
    const m = computeDebriefMetrics({ script, snap: r.snapshot(), attempts: [] });
    expect(m.recommendations.some((s) => s.toLowerCase().includes('repetir'))).toBe(true);
  });
});
