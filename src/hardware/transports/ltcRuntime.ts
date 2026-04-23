import { timelineClock } from '@/core/timeline/TimelineClock';
import { LTCTransport, createTimelineClockLTCTarget } from './ltc';

export const ltcRuntime = new LTCTransport(
  createTimelineClockLTCTarget({
    getTime: () => timelineClock.getTime(),
    syncExternalTime: (time) => timelineClock.syncExternalTime(time),
    releaseExternalSync: () => {
      timelineClock.setFrameDuration(null);
      timelineClock.releaseExternalSync();
    },
    getRate: () => timelineClock.getRate(),
    setRate: (rate) => timelineClock.setRate(rate),
  }),
);

export function updateTimelineClockFromLTCFps(): void {
  const fps = ltcRuntime.getDetectedFps();
  if (!(fps > 0)) return;
  timelineClock.setFrameDuration(1 / fps);
}