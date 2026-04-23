import { beforeEach, describe, expect, it } from 'vitest';
import { timelineClock } from '@/core/timeline/TimelineClock';
import { resolveSMPTEChase } from '@/core/timeline/smpteChase';
import { useProjectStore } from '@/store/useProjectStore';
import { isDriftFree } from '@/core/timeline/driftGuard';

function mirror() {
  const clock = timelineClock.getState();
  const store = useProjectStore.getState();

  expect(clock.time).toBe(store.currentTime);
  expect(clock.playing).toBe(store.isPlaying);
  expect(clock.duration).toBe(store.duration);
  expect(clock.speed).toBe(store.playbackSpeed);
  expect(isDriftFree(clock, store)).toBe(true);
}

describe('timelineClock/store sync', () => {
  beforeEach(() => {
    timelineClock.setDuration(120);
    timelineClock.setSpeed(1);
    timelineClock.setLoop(false);
    timelineClock.pause();
    timelineClock.seek(0);
  });

  it('syncs play pause toggle', () => {
    timelineClock.play();
    mirror();
    expect(useProjectStore.getState().isPlaying).toBe(true);

    timelineClock.pause();
    mirror();

    timelineClock.toggle();
    mirror();
    timelineClock.toggle();
    mirror();
  });

  it('syncs seek with clamp', () => {
    timelineClock.seek(12.5);
    mirror();
    expect(useProjectStore.getState().currentTime).toBe(12.5);

    timelineClock.seek(999);
    mirror();
    expect(useProjectStore.getState().currentTime).toBe(120);
  });

  it('syncs speed duration and loop', () => {
    timelineClock.setSpeed(1.75);
    mirror();
    expect(useProjectStore.getState().playbackSpeed).toBe(1.75);

    timelineClock.setDuration(30);
    mirror();
    expect(useProjectStore.getState().duration).toBe(30);

    timelineClock.setLoop(true);
    expect(timelineClock.getState().loop).toBe(true);
    mirror();
  });

  it('syncs external time metadata', () => {
    timelineClock.setSpeed(2);
    timelineClock.syncExternalTime(8);
    mirror();
    const store = useProjectStore.getState();
    expect(store.playbackSpeed).toBe(1);
    expect(store.timelineSource).toBe('external');
    expect(store.timelineLastExternalSync).not.toBeNull();
    expect(store.timelineDriftSec).toBe(8);
  });

  it('keeps mirror aligned across direct store mutators', () => {
    const store = useProjectStore.getState();

    store.setCurrentTime(18.25);
    mirror();

    store.setPlaying(true);
    mirror();

    store.setPlaybackSpeed(1.5);
    mirror();

    store.setDuration(10);
    mirror();
    expect(useProjectStore.getState().currentTime).toBe(10);

    store.setPlaying(false);
    mirror();
  });

  it('ticks deterministically and respects stop at duration', () => {
    timelineClock.setDuration(2);
    timelineClock.setSpeed(2);
    timelineClock.play();
    timelineClock.tick(0.25);
    mirror();
    expect(useProjectStore.getState().currentTime).toBe(0.5);

    timelineClock.tick(1);
    mirror();
    expect(useProjectStore.getState().currentTime).toBe(2);
    expect(useProjectStore.getState().isPlaying).toBe(false);
  });

  it('loops when enabled', () => {
    timelineClock.setDuration(2);
    timelineClock.setLoop(true);
    timelineClock.play();
    timelineClock.tick(2.5);
    mirror();
    expect(useProjectStore.getState().currentTime).toBe(0.5);
    expect(useProjectStore.getState().isPlaying).toBe(true);
  });

  it('resets without breaking mirror', () => {
    timelineClock.setDuration(64);
    timelineClock.setSpeed(1.25);
    timelineClock.play();
    timelineClock.tick(0.5);
    timelineClock.reset();

    mirror();
    const store = useProjectStore.getState();
    expect(store.currentTime).toBe(0);
    expect(store.isPlaying).toBe(false);
    expect(store.duration).toBe(64);
    expect(store.playbackSpeed).toBe(1);
  });

  it('ignores non-finite inputs and preserves deterministic state', () => {
    timelineClock.seek(5);
    timelineClock.setSpeed(2);
    timelineClock.setDuration(20);

    timelineClock.seek(Number.NaN);
    timelineClock.seek(Number.NEGATIVE_INFINITY);
    timelineClock.syncExternalTime(Number.POSITIVE_INFINITY);
    timelineClock.setSpeed(Number.POSITIVE_INFINITY);
    timelineClock.setDuration(Number.NaN);
    timelineClock.setDuration(-5);
    timelineClock.tick(Number.NaN);

    mirror();
    const store = useProjectStore.getState();
    expect(store.currentTime).toBe(5);
    expect(store.playbackSpeed).toBe(2);
    expect(store.duration).toBe(20);
  });

  it('preserves deterministic behavior across a full playback lifecycle', () => {
    timelineClock.setDuration(30);
    timelineClock.seek(12);
    mirror();

    timelineClock.play();
    timelineClock.tick(0.5);
    timelineClock.pause();
    mirror();
    expect(useProjectStore.getState().currentTime).toBe(12.5);

    timelineClock.setDuration(10);
    mirror();
    expect(useProjectStore.getState().currentTime).toBe(10);
    expect(useProjectStore.getState().isPlaying).toBe(false);

    timelineClock.seek(Number.NaN);
    timelineClock.setSpeed(Number.POSITIVE_INFINITY);
    mirror();
    expect(useProjectStore.getState().currentTime).toBe(10);
    expect(useProjectStore.getState().playbackSpeed).toBe(1);
  });

  it('seeks safely during playback without introducing a jump on the next tick', () => {
    timelineClock.setDuration(30);
    timelineClock.play();
    timelineClock.tick(1);
    mirror();
    expect(useProjectStore.getState().currentTime).toBe(1);

    timelineClock.seek(10);
    mirror();
    expect(useProjectStore.getState().currentTime).toBe(10);

    timelineClock.tick(0.5);
    mirror();
    expect(useProjectStore.getState().currentTime).toBe(10.5);
  });

  it('changes speed mid-play without exploding accumulated time', () => {
    timelineClock.setDuration(30);
    timelineClock.play();
    timelineClock.tick(1);
    mirror();
    expect(useProjectStore.getState().currentTime).toBe(1);

    timelineClock.setSpeed(2);
    mirror();
    expect(useProjectStore.getState().playbackSpeed).toBe(2);

    timelineClock.tick(0.5);
    mirror();
    expect(useProjectStore.getState().currentTime).toBe(2);
  });

  it('resyncs cleanly after pause when external time has advanced', () => {
    timelineClock.setDuration(120);
    timelineClock.syncExternalTime(20);
    timelineClock.pause();
    mirror();

    timelineClock.syncExternalTime(24.5);
    mirror();
    expect(useProjectStore.getState().currentTime).toBe(24.5);
    expect(useProjectStore.getState().timelineSource).toBe('external');

    timelineClock.play();
    timelineClock.tick(0.5);
    mirror();
    expect(useProjectStore.getState().currentTime).toBe(25);
    expect(useProjectStore.getState().isPlaying).toBe(true);
    expect(useProjectStore.getState().timelineSource).toBe('local');
  });

  it('keeps store mirrored without manual sync calls', () => {
    timelineClock.seek(14.25);
    expect(useProjectStore.getState().currentTime).toBe(14.25);

    timelineClock.play();
    expect(useProjectStore.getState().isPlaying).toBe(true);

    timelineClock.setDuration(10);
    expect(useProjectStore.getState().currentTime).toBe(10);
    expect(useProjectStore.getState().duration).toBe(10);
  });

  it('uses soft chase for jitter and snap only for large drift', () => {
    expect(resolveSMPTEChase(10, 10.01).mode).toBe('ignore');
    expect(resolveSMPTEChase(10, 10.03).mode).toBe('soft');
    expect(resolveSMPTEChase(10, 10.75).mode).toBe('snap');
  });
});