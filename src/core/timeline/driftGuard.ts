import type { TimelineClockState } from '@/core/timeline/TimelineClock';

export interface TimelineMirrorSnapshot {
  currentTime: number;
  isPlaying: boolean;
  duration: number;
  playbackSpeed: number;
}

export interface DriftSnapshot {
  timeDelta: number;
  playingMismatch: boolean;
  durationDelta: number;
  speedDelta: number;
}

export function getDriftSnapshot(clock: TimelineClockState, store: TimelineMirrorSnapshot): DriftSnapshot {
  return {
    timeDelta: clock.time - store.currentTime,
    playingMismatch: clock.playing !== store.isPlaying,
    durationDelta: clock.duration - store.duration,
    speedDelta: clock.speed - store.playbackSpeed,
  };
}

export function isDriftFree(clock: TimelineClockState, store: TimelineMirrorSnapshot): boolean {
  const drift = getDriftSnapshot(clock, store);
  return drift.timeDelta === 0 && !drift.playingMismatch && drift.durationDelta === 0 && drift.speedDelta === 0;
}