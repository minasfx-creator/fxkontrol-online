/**
 * ─── Timeline Engine ────────────────────────────────────────────────
 * Synchronised show timeline. Drives playback time for all subsystems.
 * Supports play/pause/seek/speed and listener notifications.
 */

import { timelineClock, type TimelineClockState } from '@/core/timeline/TimelineClock';

export type TimelineState = TimelineClockState;

export const timelineEngine = timelineClock;
