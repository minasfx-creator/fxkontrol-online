import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '@/store/useProjectStore';
import type { TimelineItem, CueMarker } from '@/types/projectTypes';

const mkItem = (id: string, startTime: number): TimelineItem => ({
  id,
  effectId: 'fx-test',
  startTime,
  trackIndex: 0,
  position: { x: 0, y: 0, z: 0 },
});
const mkCue = (id: string, time: number): CueMarker => ({
  id,
  time,
  label: id,
  color: 'hsl(0,0%,50%)',
});

const resetStore = () => {
  useProjectStore.setState({
    timelineItems: [],
    cueMarkers: [],
    cameraKeyframes: [],
    trajectories: [],
    droneFormations: [],
    audioInPoint: 0,
    audioOutPoint: null,
    audioOriginalDuration: 30,
    audioTrimHistory: null,
    duration: 30,
    currentTime: 0,
  });
};

describe('applyAudioTrim / resetAudioTrim', () => {
  beforeEach(resetStore);

  it('shifts items inside the new window and drops items outside', () => {
    const s = useProjectStore.getState();
    s.addTimelineItem(mkItem('a', 1));   // outside (before)
    s.addTimelineItem(mkItem('b', 3));   // inside → 1
    s.addTimelineItem(mkItem('c', 7));   // inside → 5
    s.addTimelineItem(mkItem('d', 9));   // outside (after; 9-2=7 > 6)

    const result = useProjectStore.getState().applyAudioTrim(2, 8);

    expect(result.ok).toBe(true);
    expect(result.removedItems).toBe(2);

    const after = useProjectStore.getState();
    expect(after.duration).toBe(6);
    expect(after.audioInPoint).toBe(2);
    expect(after.audioOutPoint).toBe(8);
    const ids = after.timelineItems.map((i) => i.id).sort();
    expect(ids).toEqual(['b', 'c']);
    const byId = (id: string) => after.timelineItems.find((i) => i.id === id)!;
    expect(byId('b').startTime).toBeCloseTo(1);
    expect(byId('c').startTime).toBeCloseTo(5);
  });

  it('rejects invalid windows without mutating state', () => {
    const s = useProjectStore.getState();
    s.addTimelineItem(mkItem('a', 5));
    const before = useProjectStore.getState();

    const r1 = useProjectStore.getState().applyAudioTrim(5, 5);
    const r2 = useProjectStore.getState().applyAudioTrim(8, 2);
    const r3 = useProjectStore.getState().applyAudioTrim(2, 2.01); // < 50ms
    const r4 = useProjectStore.getState().applyAudioTrim(0, 100);  // > origDur

    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    expect(r3.ok).toBe(false);
    expect(r4.ok).toBe(false);

    const after = useProjectStore.getState();
    expect(after.duration).toBe(before.duration);
    expect(after.timelineItems).toEqual(before.timelineItems);
  });

  it('re-times cue markers and persists snapshot for undo', () => {
    const s = useProjectStore.getState();
    s.addCueMarker(mkCue('c1', 1));   // dropped
    s.addCueMarker(mkCue('c2', 4));   // kept → 2
    s.addTimelineItem(mkItem('x', 1)); // dropped

    useProjectStore.getState().applyAudioTrim(2, 8);

    const after = useProjectStore.getState();
    expect(after.cueMarkers.map((c) => c.id)).toEqual(['c2']);
    expect(after.cueMarkers[0].time).toBeCloseTo(2);
    expect(after.audioTrimHistory).not.toBeNull();
    expect(after.audioTrimHistory!.removedItems.map((i) => i.id)).toEqual(['x']);
  });

  it('resetAudioTrim restores duration, items and times', () => {
    const s = useProjectStore.getState();
    s.addTimelineItem(mkItem('a', 1));
    s.addTimelineItem(mkItem('b', 5));
    s.addCueMarker(mkCue('c1', 4));

    useProjectStore.getState().applyAudioTrim(2, 8);
    expect(useProjectStore.getState().timelineItems.length).toBe(1);

    useProjectStore.getState().resetAudioTrim();
    const after = useProjectStore.getState();
    expect(after.duration).toBe(30);
    expect(after.audioInPoint).toBe(0);
    expect(after.audioOutPoint).toBeNull();
    expect(after.audioTrimHistory).toBeNull();

    // 'a' was removed by trim → restored from snapshot at original time 1.
    // 'b' was inside window, shifted to 3, then shifted back to 5.
    const byId = (id: string) => after.timelineItems.find((i) => i.id === id)!;
    expect(byId('a').startTime).toBeCloseTo(1);
    expect(byId('b').startTime).toBeCloseTo(5);
    // Cue restored to original time 4.
    expect(after.cueMarkers[0].time).toBeCloseTo(4);
  });

  it('resetAudioTrim without snapshot still clears trim points safely', () => {
    useProjectStore.setState({
      audioInPoint: 3,
      audioOutPoint: 10,
      audioOriginalDuration: 20,
      audioTrimHistory: null,
      duration: 7,
    });
    useProjectStore.getState().resetAudioTrim();
    const after = useProjectStore.getState();
    expect(after.audioInPoint).toBe(0);
    expect(after.audioOutPoint).toBeNull();
    expect(after.duration).toBe(20);
  });

  it('setAudioUrl wipes trim state when source changes', () => {
    useProjectStore.setState({
      audioUrl: 'a.mp3',
      audioInPoint: 5,
      audioOutPoint: 10,
      audioOriginalDuration: 20,
      audioTrimHistory: { prevIn: 0, prevOut: null, delta: 5, removedItems: [], timestamp: 0 },
    });
    useProjectStore.getState().setAudioUrl('b.mp3');
    const after = useProjectStore.getState();
    expect(after.audioInPoint).toBe(0);
    expect(after.audioOutPoint).toBeNull();
    expect(after.audioOriginalDuration).toBeNull();
    expect(after.audioTrimHistory).toBeNull();
  });
});
