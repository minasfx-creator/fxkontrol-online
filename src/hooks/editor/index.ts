/**
 * src/hooks/editor — Reusable hooks for editor components.
 * Extracted to deduplicate timer/listener cleanup patterns across large panels.
 */
export { useLongPress, type LongPressHandlers } from './useLongPress';
export { useFullscreenState } from './useFullscreenState';
export { useEscapeKey } from './useEscapeKey';
export { useTimerRegistry, type TimerRegistry } from './useTimerRegistry';
export { useElapsedTimer } from './useElapsedTimer';
export { useWindowEvent } from './useWindowEvent';
