/**
 * ViewportTransitionOverlay — Smooth fade overlay during geo location transitions.
 * Listens for 'viewport-transition' events and fades viewport in/out.
 * Uses CSS transitions only — zero JS animation loops.
 */
import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

export default function ViewportTransitionOverlay() {
  const [phase, setPhase] = useState<'idle' | 'fade-out' | 'hold' | 'fade-in'>('idle');
  const [label, setLabel] = useState<string | null>(null);

  const handleTransition = useCallback((e: Event) => {
    const { locationName, holdMs = 800 } = (e as CustomEvent).detail ?? {};
    setLabel(locationName || null);

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

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    window.addEventListener('viewport-transition', handleTransition);
    return () => window.removeEventListener('viewport-transition', handleTransition);
  }, [handleTransition]);

  if (phase === 'idle') return null;

  return (
    <div
      className={cn(
        "absolute inset-0 z-[60] pointer-events-none flex items-center justify-center",
        "transition-opacity duration-[400ms] ease-in-out",
        phase === 'fade-out' && "opacity-100 bg-black",
        phase === 'hold' && "opacity-100 bg-black",
        phase === 'fade-in' && "opacity-0 bg-black",
      )}
    >
      {label && (phase === 'hold' || phase === 'fade-out') && (
        <div className="flex flex-col items-center gap-2 animate-fade-in">
          <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-mono tracking-[0.2em] uppercase text-primary/80">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}
