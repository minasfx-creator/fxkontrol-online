import { useCallback, useEffect, useState } from 'react';
import { timelineClock, type TimelineClockState } from '@/core/timeline/TimelineClock';
import { timelineTransport } from '@/core/transport/timelineTransport';

/**
 * Reactive timeline state + UI-safe transport actions.
 *
 * Transport mutations (play/pause/toggle/stop/rewind/seek) go through the
 * single `timelineTransport` controller — never call `timelineClock.play()`
 * directly from a component. Technical sync hooks (setSpeed, setDuration,
 * setLoop, syncExternalTime) remain on the clock since they aren't user
 * transport actions.
 */
export function useTimelineClock() {
  const [state, setState] = useState<TimelineClockState>(() => timelineClock.getState());

  useEffect(() => timelineClock.onChange(setState), []);

  const play = useCallback(() => timelineTransport.play(), []);
  const pause = useCallback(() => timelineTransport.pause(), []);
  const toggle = useCallback(() => timelineTransport.toggle(), []);
  const stop = useCallback(() => timelineTransport.stop(), []);
  const rewind = useCallback(() => timelineTransport.rewind(), []);
  const seek = useCallback((time: number) => timelineTransport.seekTo(time), []);
  const setSpeed = useCallback((speed: number) => timelineClock.setSpeed(speed), []);
  const setDuration = useCallback((duration: number) => timelineClock.setDuration(duration), []);
  const setLoop = useCallback((loop: boolean) => timelineClock.setLoop(loop), []);
  const syncExternalTime = useCallback((time: number) => timelineClock.syncExternalTime(time), []);

  return {
    ...state,
    play,
    pause,
    toggle,
    stop,
    rewind,
    seek,
    setSpeed,
    setDuration,
    setLoop,
    syncExternalTime,
  };
}