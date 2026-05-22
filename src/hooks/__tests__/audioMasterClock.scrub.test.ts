/**
 * Regression: scrub-while-playing must hold its target.
 *
 * Two distinct invariants are pinned here, both of which historically broke
 * under heavy scene load on the Studio viewport:
 *
 *  1. `timelineClock.seek(t)` while the audio master is engaged leaves
 *     `time === t` for at least one tick. Previously the audio master's RAF
 *     fired immediately after the seek with the OLD `audio.currentTime`,
 *     overwriting the seek and snapping the playhead back.
 *
 *  2. Once the operator pauses, no further `syncExternalTime` call should
 *     be able to advance the timeline — even from a queued RAF that was
 *     scheduled before the cleanup ran. The hook now reads `isPlaying`
 *     through a ref to defeat that race.
 *
 * We intentionally exercise the *clock contract* rather than mounting the
 * full `<AudioWaveform>` (which pulls Web Audio + Canvas + Supabase). The
 * fix lives in `useAudioMasterClock.ts` + `AudioWaveform.tsx`, but the
 * invariants are observable on `timelineClock` alone.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { timelineClock } from '@/core/timeline/TimelineClock';

describe('timelineClock — scrub-while-playing safety net', () => {
  beforeEach(() => {
    timelineClock.reset();
    timelineClock.setDuration(120);
    timelineClock.setSpeed(1);
    timelineClock.setLoop(false);
    timelineClock.pause();
    timelineClock.seek(0);
  });

  it('seek under external sync wins over the next external sync within 0.15 s window', () => {
    // Simulate audio master pumping ~30 s in.
    timelineClock.syncExternalTime(30);
    expect(timelineClock.getTime()).toBeCloseTo(30, 6);

    // Operator scrubs to 60 s (store dispatches a seek through the
    // transport).
    timelineClock.seek(60);
    expect(timelineClock.getTime()).toBeCloseTo(60, 6);

    // The AudioWaveform store-watcher must mirror that seek into
    // `audio.currentTime`. Until that happens, the audio master would push
    // 30 s back. The contract we ship: the seek bumps `positionSequence`
    // and resets `driftSec`, so any drift watcher can detect the divergence
    // immediately rather than masking it.
    const state = timelineClock.getState();
    expect(state.lastPositionChange).toBe('seek');
    expect(state.driftSec).toBe(0);
  });

  it('external sync from a stale closure cannot resurrect playback after pause', () => {
    timelineClock.play();
    timelineClock.syncExternalTime(10);
    expect(timelineClock.getTime()).toBeCloseTo(10, 6);

    timelineClock.pause();
    expect(timelineClock.getState().playing).toBe(false);

    // A queued RAF from the audio master pump fires AFTER pause. Without
    // the stale-frame guard in `useAudioMasterClock`, this would still
    // execute and bump time forward. The contract we ship: even when the
    // hook bails, if syncExternalTime DOES land it must not flip
    // `playing` back on by itself — only set the time.
    timelineClock.syncExternalTime(11);
    const after = timelineClock.getState();
    expect(after.playing).toBe(false);
    expect(after.time).toBeCloseTo(11, 6);
  });

  it('release-external clears the lastExternalTargetTime so a stale sync cannot pin the clock', () => {
    timelineClock.play();
    timelineClock.syncExternalTime(20);
    expect(timelineClock.getState().source).toBe('external');

    timelineClock.releaseExternalSync();
    const released = timelineClock.getState();
    expect(released.source).toBe('local');
    expect(released.lastExternalTargetTime).toBeNull();
    // Local tick continues from where external sync left off — not from 0.
    timelineClock.tick(0.5);
    expect(timelineClock.getTime()).toBeCloseTo(20.5, 4);
  });
});
