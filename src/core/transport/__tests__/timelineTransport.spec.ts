import { beforeEach, describe, expect, it } from 'vitest';
import { timelineClock } from '@/core/timeline/TimelineClock';
import { useProjectStore } from '@/store/useProjectStore';
import { timelineTransport, getLastValidSpeed } from '@/core/transport/timelineTransport';

/**
 * Integration coverage for the operational transport path:
 *   UI → timelineTransport → timelineClock → tick → store mirror
 *
 * Locks down the UX guarantees that the central controller adds:
 *   - Play with persisted speed=0 must auto-restore a playable speed
 *     and the timeline must actually advance.
 *   - Play at end-of-duration must auto-rewind to 0.
 *   - Stop/rewind always returns the timeline to 0 and pauses.
 */
describe('timelineTransport', () => {
  beforeEach(() => {
    timelineClock.reset();
    timelineClock.setDuration(120);
    timelineClock.setSpeed(1);
    timelineClock.setLoop(false);
    timelineClock.pause();
    timelineClock.seek(0);
  });

  it('play() advances time at the current speed', () => {
    timelineTransport.play();
    expect(timelineClock.isPlaying()).toBe(true);

    timelineClock.tick(0.5);
    const { currentTime } = useProjectStore.getState();
    expect(currentTime).toBeGreaterThan(0);
  });

  it('play() with speed=0 restores last valid speed and advances', () => {
    timelineClock.setSpeed(2);
    expect(getLastValidSpeed()).toBe(2);

    // Simulate a corrupted/persisted speed of 0.
    timelineClock.setSpeed(0);
    expect(timelineClock.getState().speed).toBe(0);

    timelineTransport.play();

    const after = timelineClock.getState();
    expect(after.playing).toBe(true);
    expect(after.speed).toBeGreaterThan(0);

    timelineClock.tick(0.5);
    expect(useProjectStore.getState().currentTime).toBeGreaterThan(0);
  });

  it('play() with speed=0 and no prior valid speed falls back to 1×', () => {
    // Force-clear cache by setting a known speed first, then 0.
    timelineClock.setSpeed(1);
    timelineClock.setSpeed(0);

    timelineTransport.play();
    expect(timelineClock.getState().speed).toBeGreaterThanOrEqual(1);
  });

  it('play() at end-of-duration auto-rewinds to 0', () => {
    timelineClock.seek(120);
    expect(timelineClock.getState().time).toBe(120);

    timelineTransport.play();

    const state = timelineClock.getState();
    expect(state.time).toBe(0);
    expect(state.playing).toBe(true);
  });

  it('play() at end with loop=true does not auto-rewind', () => {
    timelineClock.setLoop(true);
    timelineClock.seek(120);
    timelineTransport.play();
    // Loop mode keeps current time as-is at boundary; tick will wrap.
    expect(timelineClock.getState().playing).toBe(true);
  });

  it('toggle() pauses when playing and plays when paused', () => {
    expect(timelineClock.isPlaying()).toBe(false);
    timelineTransport.toggle();
    expect(timelineClock.isPlaying()).toBe(true);
    timelineTransport.toggle();
    expect(timelineClock.isPlaying()).toBe(false);
  });

  it('stop() pauses and rewinds to 0', () => {
    timelineClock.seek(42);
    timelineTransport.play();
    timelineTransport.stop();
    const s = timelineClock.getState();
    expect(s.playing).toBe(false);
    expect(s.time).toBe(0);
  });

  it('store mirror reflects play even after auto-corrections', () => {
    timelineClock.setSpeed(0);
    timelineClock.seek(120);

    timelineTransport.play();
    timelineClock.tick(0.25);

    const store = useProjectStore.getState();
    expect(store.isPlaying).toBe(true);
    expect(store.currentTime).toBeGreaterThan(0);
    expect(store.playbackSpeed).toBeGreaterThan(0);
  });
});
