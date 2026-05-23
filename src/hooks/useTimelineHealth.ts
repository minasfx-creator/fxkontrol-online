/**
 * useTimelineHealth — subscribes to `timelineHealthStore` via
 * `useSyncExternalStore` so React components re-render whenever the
 * watchdog publishes a new clock status.
 */
import { useSyncExternalStore } from 'react';
import { timelineHealthStore, type TimelineHealthState } from '@/core/health/timelineHealthStore';

export function useTimelineHealth(): TimelineHealthState {
  return useSyncExternalStore(
    timelineHealthStore.subscribe,
    timelineHealthStore.getState,
    timelineHealthStore.getState,
  );
}
