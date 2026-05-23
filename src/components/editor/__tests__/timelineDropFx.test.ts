/**
 * Unit coverage for the timeline drop snap resolver. Locks the priority
 * order: playhead > edge > beat > free, plus clamping behaviour.
 */
import { describe, it, expect } from 'vitest';
import { resolveDropTime, formatDropTimestamp, snapAccent } from '../timelineDropFx';

const baseArgs = {
  duration: 60,
  pixelsPerSecond: 100, // 1s = 100px → snap thresholds: beat 0.08s, edge 0.06s, playhead 0.08s
  bpm: 120,             // beat interval = 0.5s
  snapToBeat: true,
  currentTime: 0,
};

describe('resolveDropTime', () => {
  it('clamps below 0 and above duration', () => {
    expect(resolveDropTime({ ...baseArgs, rawTime: -5, snapToBeat: false }).time).toBe(0);
    expect(resolveDropTime({ ...baseArgs, rawTime: 999, snapToBeat: false }).time).toBe(60);
  });

  it('returns "free" when no snap target is near', () => {
    const r = resolveDropTime({ ...baseArgs, rawTime: 12.345, snapToBeat: false, bpm: null });
    expect(r.snap).toBe('free');
    expect(r.time).toBeCloseTo(12.345, 3);
  });

  it('snaps to the nearest beat when within threshold', () => {
    // Beat at 10.0s, threshold = 0.08s → 10.05s should snap.
    const r = resolveDropTime({ ...baseArgs, rawTime: 10.05 });
    expect(r.snap).toBe('beat');
    expect(r.time).toBe(10);
  });

  it('does NOT snap to beat when snapToBeat=false', () => {
    const r = resolveDropTime({ ...baseArgs, rawTime: 10.05, snapToBeat: false });
    expect(r.snap).toBe('free');
  });

  it('snaps placement start to a neighbour end (edge)', () => {
    const r = resolveDropTime({
      ...baseArgs,
      snapToBeat: false,
      rawTime: 5.02, // neighbour ends at 5.0
      neighbours: [{ startTime: 3, durationOverride: 2 }],
    });
    expect(r.snap).toBe('edge');
    expect(r.time).toBe(5);
  });

  it('snaps placement end to a neighbour start (edge)', () => {
    const r = resolveDropTime({
      ...baseArgs,
      snapToBeat: false,
      rawTime: 4.98, // placing duration 1 → end at 5.98 ≈ neighbour start 6
      neighbours: [{ startTime: 6, durationOverride: 1 }],
      placing: { durationOverride: 1 },
    });
    expect(r.snap).toBe('edge');
    expect(r.time).toBe(5); // 6 - 1
  });

  it('playhead snap wins over beat snap when both are nearby', () => {
    // Playhead at 10.02 (within 0.08s threshold), beat at 10.0
    const r = resolveDropTime({ ...baseArgs, rawTime: 10.04, currentTime: 10.02 });
    expect(r.snap).toBe('playhead');
    expect(r.time).toBeCloseTo(10.02, 5);
  });

  it('playhead snap wins over edge snap', () => {
    const r = resolveDropTime({
      ...baseArgs,
      snapToBeat: false,
      rawTime: 5.02,
      currentTime: 5.01,
      neighbours: [{ startTime: 3, durationOverride: 2 }], // ends at 5.0
    });
    expect(r.snap).toBe('playhead');
    expect(r.time).toBeCloseTo(5.01, 5);
  });
});

describe('formatDropTimestamp', () => {
  it('formats MM:SS.cc with zero-padding', () => {
    expect(formatDropTimestamp(0)).toBe('00:00.00');
    expect(formatDropTimestamp(5.07)).toBe('00:05.07');
    expect(formatDropTimestamp(65.5)).toBe('01:05.50');
  });
});

describe('snapAccent', () => {
  it('returns distinct labels per snap reason', () => {
    expect(snapAccent('playhead').label).toBe('PLAYHEAD');
    expect(snapAccent('edge').label).toBe('EDGE');
    expect(snapAccent('beat').label).toBe('BEAT');
    expect(snapAccent('free').label).toBe('FREE');
  });
});
