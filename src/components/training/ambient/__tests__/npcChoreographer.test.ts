import { describe, it, expect } from 'vitest';
import { createNpcChoreographer } from '../npcChoreographer';
import type { RunnerEvent } from '../../missions/missionRunner';
import type { CinematicBeat, MissionStage } from '../../missions/types';

const anchor = (id: string): [number, number, number] | null =>
  id === 'roadie-veterano' ? [1, 0, 2] : id === 'bombeiro-fiscal' ? [3, 0, 1] : [0, 0, 0];

const stage: MissionStage = { id: 's1', kind: 'place', title: 'x', objectives: [{ label: 'x' }] };

describe('npcChoreographer', () => {
  it('snapshot starts empty', () => {
    const c = createNpcChoreographer({ resolveAnchor: anchor });
    expect(Object.keys(c.snapshot()).length).toBe(0);
  });

  it('beat:start with focused npc walks them to anchor and triggers gesture', () => {
    const c = createNpcChoreographer({ resolveAnchor: anchor });
    const beat: CinematicBeat = { id: 'b1', triggerOn: 'stage-start', shot: 'close-up-reaction', npcId: 'roadie-veterano' };
    c.ingest({ kind: 'beat:start', beat } as RunnerEvent);
    const pose = c.snapshot()['roadie-veterano'];
    expect(pose).toBeDefined();
    expect(pose.walkTo).toEqual([1, 0, 2]);
    expect(pose.gesture).not.toBe('idle');
    expect(pose.gestureSeq).toBeGreaterThan(0);
  });

  it('safety:violation makes veteran facepalm + inspector shake-head', () => {
    const c = createNpcChoreographer({ resolveAnchor: anchor });
    c.ingest({ kind: 'safety:violation', total: 1 } as RunnerEvent, {
      activeNpcIds: ['roadie-veterano', 'bombeiro-fiscal'],
    });
    const snap = c.snapshot();
    expect(snap['roadie-veterano'].gesture).toBe('facepalm');
    expect(snap['bombeiro-fiscal'].gesture).toBe('shake-head');
  });

  it('mission:complete cheers all active npcs', () => {
    const c = createNpcChoreographer({ resolveAnchor: anchor });
    c.ingest({ kind: 'mission:complete', finalScore: 100, stars: 5 } as RunnerEvent, {
      activeNpcIds: ['roadie-veterano', 'tecnica-som'],
    });
    const snap = c.snapshot();
    expect(snap['roadie-veterano'].gesture).toBe('cheer');
    expect(snap['tecnica-som'].gesture).toBe('cheer');
  });

  it('objective:complete triggers thumbs-up on speaker', () => {
    const c = createNpcChoreographer({ resolveAnchor: anchor });
    c.ingest({ kind: 'objective:complete', objectiveId: 'o1', scoreDelta: 50 } as RunnerEvent, {
      speakerId: 'tecnica-som',
    });
    expect(c.snapshot()['tecnica-som'].gesture).toBe('thumbs-up');
  });

  it('clear() resets everything', () => {
    const c = createNpcChoreographer({ resolveAnchor: anchor });
    c.setPose('roadie-veterano', 'wave');
    c.clear();
    expect(Object.keys(c.snapshot()).length).toBe(0);
  });
});

describe('gestures sample', () => {
  it('returns zero pose at t=0 and t=1', async () => {
    const { sampleGesture, ZERO_POSE } = await import('../../humanoid/gestures');
    expect(sampleGesture('wave', 0)).toEqual(ZERO_POSE);
    expect(sampleGesture('wave', 1)).toEqual(ZERO_POSE);
  });
  it('produces nonzero arm rotation mid-gesture', async () => {
    const { sampleGesture } = await import('../../humanoid/gestures');
    const p = sampleGesture('wave', 0.5);
    expect(Math.abs(p.rArmX)).toBeGreaterThan(0.1);
  });
});
