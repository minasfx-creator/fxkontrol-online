/**
 * ─── Global E-STOP Button ──────────────────────────────────────────
 * Always-visible, top-most overlay. Routes through uiCommandGateway.
 *
 * Behaviour:
 *  - Always rendered (z-[9999]) above sidebar, dock, modals, drawers.
 *  - Idle state: dim red ring with low opacity — discoverable, non-intrusive.
 *  - Armed/Firing state: solid red, pulsing — impossible to ignore.
 *  - Press behaviour:
 *      * Idle: requires Hold-to-Confirm (600ms) to avoid accidental press.
 *      * Armed/Firing: single press (latency <50ms — life-safety).
 *
 * Memory rule respected: timer uses useRef, cleared on unmount.
 */

import { useEffect, useRef, useState } from 'react';
import { AlertOctagon } from 'lucide-react';
import { uiCommandGateway } from '@/core/command/uiCommandGateway';
import { safetyStateMachine, type SafetyState } from '@/core/safety/SafetyStateMachine';
import { haptics } from '@/lib/haptics';
import { cn } from '@/lib/utils';

const HOLD_MS = 600;

export default function GlobalEStopButton() {
  const [state, setState] = useState<SafetyState>(safetyStateMachine.state);
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  // Subscribe to SSM transitions so the visual reflects ARMED/FIRING.
  useEffect(() => {
    const unsub = safetyStateMachine.onTransition((r) => {
      setState(r.to as SafetyState);
    });
    return unsub;
  }, []);

  const clearTimers = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  // Always cleanup on unmount.
  useEffect(() => () => clearTimers(), []);

  const isHot = state === 'ARMED' || state === 'FIRING';

  const fire = () => {
    try { haptics.panic(); } catch { /* */ }
    uiCommandGateway.eStop({ source: 'GlobalEStopButton', detail: `from-state:${state}` });
  };

  const tickProgress = () => {
    const elapsed = performance.now() - startRef.current;
    const p = Math.min(1, elapsed / HOLD_MS);
    setHoldProgress(p);
    if (p < 1) rafRef.current = requestAnimationFrame(tickProgress);
  };

  const onPress = () => {
    if (isHot) {
      // Life-safety path — single press, no hold gate.
      fire();
      return;
    }
    // Idle/Locked path — Hold-to-Confirm to prevent accidental triggers.
    setHolding(true);
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tickProgress);
    timerRef.current = setTimeout(() => {
      setHolding(false);
      setHoldProgress(0);
      fire();
    }, HOLD_MS);
  };

  const cancel = () => {
    clearTimers();
    setHolding(false);
    setHoldProgress(0);
  };

  // Visual tier
  const tierClass = isHot
    ? 'bg-destructive/95 border-destructive shadow-[0_0_24px_hsl(var(--destructive)/0.55),0_0_64px_hsl(var(--destructive)/0.25)] armed-pulse'
    : holding
      ? 'bg-destructive/80 border-destructive/80 shadow-[0_0_18px_hsl(var(--destructive)/0.45)]'
      : 'bg-destructive/15 border-destructive/45 hover:bg-destructive/35 hover:border-destructive/70';

  const labelClass = isHot ? 'text-white' : holding ? 'text-white' : 'text-destructive';

  return (
    <button
      onPointerDown={onPress}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      className={cn(
        'fixed z-[9999] flex flex-col items-center justify-center rounded-xl border-2 transition-all active:scale-95 select-none touch-none',
        tierClass,
      )}
      style={{
        top: '12px',
        right: '12px',
        width: '56px',
        height: '56px',
      }}
      title={isHot ? 'EMERGENCY STOP — press to halt' : 'EMERGENCY STOP — hold 600ms to trigger'}
      aria-label="Emergency stop"
    >
      <AlertOctagon className={cn('w-5 h-5', labelClass)} />
      <span className={cn('text-[7px] font-mono font-black tracking-widest mt-0.5', labelClass)}>
        E-STOP
      </span>
      {/* Hold progress ring */}
      {holding && !isHot && (
        <span
          className="pointer-events-none absolute inset-0 rounded-xl border-2 border-destructive"
          style={{
            clipPath: `inset(${(1 - holdProgress) * 100}% 0 0 0)`,
            transition: 'none',
          }}
        />
      )}
    </button>
  );
}
