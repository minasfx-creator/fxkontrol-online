/**
 * useHoldToConfirm — Hold-to-confirm pattern for critical actions
 * Uses rAF for smooth progress, haptic ramp during hold.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { haptics } from '@/lib/haptics';

interface UseHoldToConfirmOptions {
  /** Hold duration in ms */
  duration?: number;
  /** Called when hold completes */
  onConfirm: () => void;
  /** Haptic feedback during hold */
  hapticOnConfirm?: 'fire' | 'arm' | 'panic' | 'toggle';
}

export function useHoldToConfirm({
  duration = 500,
  onConfirm,
  hapticOnConfirm = 'fire',
}: UseHoldToConfirmOptions) {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const startTimeRef = useRef(0);
  const rafRef = useRef<number>(0);
  const confirmedRef = useRef(false);

  const tick = useCallback(() => {
    const elapsed = performance.now() - startTimeRef.current;
    const p = Math.min(1, elapsed / duration);
    setProgress(p);

    if (p >= 1 && !confirmedRef.current) {
      confirmedRef.current = true;
      haptics[hapticOnConfirm]();
      onConfirm();
      setIsHolding(false);
      return;
    }

    if (p < 1) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [duration, onConfirm, hapticOnConfirm]);

  const startHold = useCallback(() => {
    confirmedRef.current = false;
    startTimeRef.current = performance.now();
    setIsHolding(true);
    setProgress(0);
    haptics.tap();
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const cancelHold = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setIsHolding(false);
    setProgress(0);
    confirmedRef.current = false;
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return { progress, isHolding, startHold, cancelHold };
}
