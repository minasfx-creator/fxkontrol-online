/**
 * ViewportTransitionOverlay — Smooth fade overlay during geo location transitions.
 * Listens for 'viewport-transition' events and fades viewport in/out.
 * Uses CSS transitions only — zero JS animation loops.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

export default function ViewportTransitionOverlay() {
  const [phase, setPhase] = useState<'idle' | 'fade-out' | 'hold' | 'fade-in'>('idle');
  const [label, setLabel] = useState<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const handleTransition = useCallback((e: Event) => {
    const { locationName, holdMs = 800 } = (e as CustomEvent).detail ?? {};
    setLabel(locationName || null);

    // Clear any previous transition timers
    clearTimers();

    // Phase 1: fade to black
    setPhase('fade-out');

    // Phase 2: hold
    const t1 = setTimeout(() => setPhase('hold'), 400);

    // Phase 3: fade back in
    const t2 = setTimeout(() => setPhase('fade-in'), 400 + holdMs);

    // Phase 4: done
    const t3 = setTimeout(() => {
      setPhase('idle');
      setLabel(null);
    }, 400 + holdMs + 600);

    timersRef.current = [t1, t2, t3];
  }, [clearTimers]);

  useEffect(() => {
    window.addEventListener('viewport-transition', handleTransition);
    return () => {
      window.removeEventListener('viewport-transition', handleTransition);
      clearTimers();
    };
  }, [handleTransition, clearTimers]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-black",
        "transition-opacity duration-600 ease-in-out",
        phase === 'idle' ? "opacity-0 pointer-events-none" : "",
        phase === 'fade-out' && "opacity-100 pointer-events-auto",
        phase === 'hold' && "opacity-100 pointer-events-auto",
        phase === 'fade-in' && "opacity-0 pointer-events-none",
      )}
    >
      {label && (phase === 'hold' || phase === 'fade-out') && (
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-mono tracking-[0.25em] uppercase" style={{ color: 'hsl(32 100% 50% / 0.7)' }}>
            {label}
          </span>
        </div>
      )}
    </div>
  );
}
