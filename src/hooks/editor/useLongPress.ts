/**
 * useLongPress — Detects a long-press (mouse/touch) with cancellation.
 * Cleans up timers on unmount and on pointer cancel/leave.
 */
import { useCallback, useEffect, useRef } from 'react';

interface UseLongPressOptions {
  onLongPress: () => void;
  onClick?: () => void;
  /** Hold duration in ms (default 600). */
  delay?: number;
}

export interface LongPressHandlers {
  onMouseDown: () => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: () => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
}

export function useLongPress({ onLongPress, onClick, delay = 600 }: UseLongPressOptions): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggeredRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    triggeredRef.current = false;
    clear();
    timerRef.current = setTimeout(() => {
      triggeredRef.current = true;
      onLongPress();
    }, delay);
  }, [clear, delay, onLongPress]);

  const end = useCallback(() => {
    clear();
    if (!triggeredRef.current) onClick?.();
  }, [clear, onClick]);

  useEffect(() => () => clear(), [clear]);

  return {
    onMouseDown: start,
    onMouseUp: end,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: end,
    onTouchCancel: clear,
  };
}
