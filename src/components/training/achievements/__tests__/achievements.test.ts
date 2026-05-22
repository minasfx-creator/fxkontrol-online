import { describe, it, expect } from 'vitest';
import { evaluateAchievements, computeUnlocks, ACHIEVEMENT_CATALOG, type AchievementId } from '../achievements';
import { createMissionRunner } from '../../missions/missionRunner';
import { MISSION_SCRIPTS } from '../../missions/missionScripts';
import type { PlacementAttempt } from '../../missions/debriefMetrics';

const scriptWithInspect = MISSION_SCRIPTS.find((m) => m.stages.some((s) => s.kind === 'inspect' || s.kind === 'fire-check'))!;
const scriptNoInspect = MISSION_SCRIPTS.find((m) => !m.stages.some((s) => s.kind === 'inspect' || s.kind === 'fire-check'))!;

function completeRun(scriptId: string) {
  const script = MISSION_SCRIPTS.find((m) => m.id === scriptId)!;
  const r = createMissionRunner(script);
  r.startMission();
  script.stages.forEach((s) => s.objectives.forEach((o) => r.completeObjective(o.snapPointId ?? o.label)));
  return { script, snap: r.snapshot() };
}

const attempts = (correct: number, wrong: number): PlacementAttempt[] => [
  ...Array.from({ length: correct }, (_, i) => ({ tMs: i * 100, snapPointId: `c${i}`, equipmentId: 'eq', correct: true })),
  ...Array.from({ length: wrong }, (_, i) => ({ tMs: (correct + i) * 100, snapPointId: `w${i}`, equipmentId: 'eq', correct: false })),
];

describe('evaluateAchievements', () => {
  it('returns empty when mission not completed', () => {
    const r = createMissionRunner(scriptWithInspect);
    r.startMission(); r.fail('manual');
    const res = evaluateAchievements({ script: scriptWithInspect, snap: r.snapshot(), attempts: [] });
    expect(res.awarded).toEqual([]);
    expect(res.bonusXP).toBe(0);
  });

  it('awards zero-violations + perfect-cue-timing + no-unknown-devices on perfect run', () => {
    const { script, snap } = completeRun(scriptNoInspect.id);
    const res = evaluateAchievements({ script, snap, attempts: attempts(5, 0) });
    expect(res.awarded).toContain('zero-violations');
    expect(res.awarded).toContain('perfect-cue-timing');
    expect(res.awarded).toContain('no-unknown-devices');
    expect(res.bonusXP).toBeGreaterThan(0);
  });

  it('awards e-stop-ready only when mission has inspect/fire-check stage', () => {
    const a = completeRun(scriptWithInspect.id);
    const b = completeRun(scriptNoInspect.id);
    const ra = evaluateAchievements({ script: a.script, snap: a.snap, attempts: [] });
    const rb = evaluateAchievements({ script: b.script, snap: b.snap, attempts: [] });
    expect(ra.awarded).toContain('e-stop-ready');
    expect(rb.awarded).not.toContain('e-stop-ready');
  });

  it('drops perfect-cue-timing when wrong attempts also drop accuracy', () => {
    const { script, snap } = completeRun(scriptNoInspect.id);
    const res = evaluateAchievements({ script, snap, attempts: attempts(3, 4) });
    expect(res.awarded).not.toContain('no-unknown-devices');
  });

  it('every catalog entry has a positive XP bonus', () => {
    Object.values(ACHIEVEMENT_CATALOG).forEach((a) => expect(a.xpBonus).toBeGreaterThan(0));
  });
});

describe('computeUnlocks', () => {
  const ordered = MISSION_SCRIPTS.map((m) => m.id);
  const initial = MISSION_SCRIPTS.filter((m) => !m.locked).map((m) => m.id);

  it('unlocks the next mission after completion', () => {
    const justDone = ordered[0];
    const expectedNext = ordered[1];
    const out = computeUnlocks({
      orderedMissionIds: ordered,
      justCompletedId: justDone,
      lifetimeAchievements: [],
      currentUnlocked: initial,
    });
    expect(out.unlocked).toContain(expectedNext);
  });

  it('unlocks producer-late at 3 distinct achievements', () => {
    const lifetime: AchievementId[] = ['zero-violations', 'perfect-cue-timing', 'no-unknown-devices'];
    const out = computeUnlocks({
      orderedMissionIds: ordered,
      justCompletedId: ordered[0],
      lifetimeAchievements: lifetime,
      currentUnlocked: initial,
    });
    expect(out.unlocked).toContain('producer-late');
  });

  it('unlocks full-reveillon at 4 distinct achievements', () => {
    const lifetime: AchievementId[] = ['zero-violations', 'perfect-cue-timing', 'no-unknown-devices', 'e-stop-ready'];
    const out = computeUnlocks({
      orderedMissionIds: ordered,
      justCompletedId: ordered[0],
      lifetimeAchievements: lifetime,
      currentUnlocked: initial,
    });
    expect(out.unlocked).toContain('full-reveillon');
    expect(out.newlyUnlocked).toContain('full-reveillon');
  });

  it('is idempotent — calling twice gives the same set', () => {
    const lifetime: AchievementId[] = ['zero-violations'];
    const out1 = computeUnlocks({ orderedMissionIds: ordered, justCompletedId: ordered[0], lifetimeAchievements: lifetime, currentUnlocked: initial });
    const out2 = computeUnlocks({ orderedMissionIds: ordered, justCompletedId: ordered[0], lifetimeAchievements: lifetime, currentUnlocked: out1.unlocked });
    expect(out2.newlyUnlocked).toEqual([]);
    expect(new Set(out2.unlocked)).toEqual(new Set(out1.unlocked));
  });
});
