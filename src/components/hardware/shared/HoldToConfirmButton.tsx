/**
 * ─── HoldToConfirmButton ───────────────────────────────────────────
 * Reusable hold-to-confirm action button for the auto-controller cards.
 * Centralises the timer/useRef cleanup pattern so every card behaves
 * identically (no leaks on unmount, on mouse-leave, on touch-cancel).
 *
 * Props:
 *   • holdMs        — required hold duration (e.g. 800 pyro, 400 outlets)
 *   • onConfirm     — fired exactly once after the hold completes
 *   • onTap?        — fired immediately on press without hold (rare; e.g.
 *                     E-STOP tap-to-fire). When provided, holdMs is ignored.
 *   • disabled?     — when true, button is non-interactive
 *   • tooltip?      — optional hover/long-press explanation
 *
 * The component never executes hardware itself — it only resolves the
 * gesture. The caller wires the actual command into onConfirm.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'ghost' | 'secondary';

export interface HoldToConfirmButtonProps {
  holdMs: number;
  onConfirm: () => void | Promise<void>;
  onTap?: () => void | Promise<void>;
  disabled?: boolean;
  tooltip?: string;
  variant?: ButtonVariant;
  className?: string;
  children: React.ReactNode;
  /** Label shown while the user is holding. Defaults to "Segure…". */
  holdingLabel?: string;
  ariaLabel?: string;
}

export function HoldToConfirmButton({
  holdMs,
  onConfirm,
  onTap,
  disabled,
  tooltip,
  variant = 'outline',
  className,
  children,
  holdingLabel = 'Segure…',
  ariaLabel,
}: HoldToConfirmButtonProps) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setHolding(false);
  }, []);

  // Cleanup on unmount — never leak timers.
  useEffect(() => clear, [clear]);

  const start = useCallback(() => {
    if (disabled) return;
    if (onTap) {
      void onTap();
      return;
    }
    setHolding(true);
    timer.current = setTimeout(() => {
      void onConfirm();
      clear();
    }, holdMs);
  }, [disabled, onTap, onConfirm, holdMs, clear]);

  return (
    <Button
      size="sm"
      variant={variant}
      className={cn('h-8 text-xs', className)}
      disabled={disabled}
      title={tooltip}
      aria-label={ariaLabel}
      aria-pressed={holding || undefined}
      onMouseDown={start}
      onMouseUp={clear}
      onMouseLeave={clear}
      onTouchStart={start}
      onTouchEnd={clear}
      onTouchCancel={clear}
    >
      {holding ? holdingLabel : children}
    </Button>
  );
}

export default HoldToConfirmButton;
