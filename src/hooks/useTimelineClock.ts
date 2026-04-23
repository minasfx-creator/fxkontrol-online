import { useCallback, useEffect, useState } from 'react';
import { timelineClock, type TimelineClockState } from '@/core/timeline/TimelineClock';

export function useTimelineClock() {
  const [state, setState] = useState<TimelineClockState>(() => timelineClock.getState());

  useEffect(() => timelineClock.onChange(setState), []);

  const play = useCallback(() => timelineClock.play(), []);
  const pause = useCallback(() => timelineClock.pause(), []);
  const toggle = useCallback(() => timelineClock.toggle(), []);
  const seek = useCallback((time: number) => timelineClock.seek(time), []);
  const setSpeed = useCallback((speed: number) => timelineClock.setSpeed(speed), []);
  const setDuration = useCallback((duration: number) => timelineClock.setDuration(duration), []);
  const setLoop = useCallback((loop: boolean) => timelineClock.setLoop(loop), []);
  const syncExternalTime = useCallback((time: number) => timelineClock.syncExternalTime(time), []);

  return {
    ...state,
    play,
    pause,
    toggle,
    seek,
    setSpeed,
    setDuration,
    setLoop,
    syncExternalTime,
  };
}