/**
 * FloatTooltip — Animated tooltip wrapper for floating Mission Control
 * controls. Uses Tailwind animate-fade-in / scale-in tokens so all floats
 * share the same haptic-feeling reveal (200ms, ease-out, slight scale).
 *
 * Why custom (vs Radix Tooltip): the floating dock is itself draggable;
 * Radix portals interfere with snap guides and the drag pointer capture.
 * This is a pure CSS reveal — zero state, zero portal, zero conflicts.
 *
 * Usage:
 *   <FloatTooltip label="ARM" shortcut="A" side="right">
 *     <button>...</button>
 *   </FloatTooltip>
 *
 * Hover (mouse) and focus-visible (keyboard) reveal the tooltip; touch
 * users get no flicker. The tooltip is purely decorative — it must never
 * carry actionable content.
 */
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface Props {
  label: string;
  shortcut?: string;
  side?: 'right' | 'left' | 'top' | 'bottom';
  children: ReactNode;
  className?: string;
}

export default function FloatTooltip({
  label,
  shortcut,
  side = 'right',
  children,
  className,
}: Props) {
  const sideClass = {
    right: 'left-full ml-2 top-1/2 -translate-y-1/2 origin-left',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2 origin-right',
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2 origin-bottom',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2 origin-top',
  }[side];

  return (
    <div className={cn('group relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap',
          'rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
          'bg-[#050810]/95 text-cyan-200 border border-cyan-500/30',
          'shadow-lg shadow-cyan-500/10 backdrop-blur-sm',
          'opacity-0 scale-95 transition-all duration-200',
          'group-hover:opacity-100 group-hover:scale-100',
          'group-focus-within:opacity-100 group-focus-within:scale-100',
          'delay-100 group-hover:delay-300 group-focus-within:delay-150',
          sideClass,
        )}
      >
        {label}
        {shortcut && (
          <kbd className="ml-1.5 px-1 py-0.5 rounded bg-cyan-500/15 text-cyan-300/80 text-[8px] font-mono tracking-normal border border-cyan-500/20">
            {shortcut}
          </kbd>
        )}
      </span>
    </div>
  );
}
