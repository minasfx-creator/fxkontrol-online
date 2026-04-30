/**
 * FloatHandle — Reusable drag handle / header for floating Mission Control
 * panels. Renders a glass strip with a grip icon, optional title, and
 * optional close button. Pair with `useDraggableFloat`:
 *
 *     const drag = useDraggableFloat({ id: 'panel-effects', defaultPos });
 *     return (
 *       <div ref={drag.ref} style={drag.style}>
 *         <FloatHandle title="Effects" onClose={...} {...drag.dragHandleProps} />
 *         {content}
 *       </div>
 *     );
 *
 * Buttons inside the handle automatically opt out of the drag (the hook
 * skips pointerdown when the target matches `button, [data-no-drag]`).
 */

import { GripVertical, X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

interface Props {
  title?: string;
  onClose?: () => void;
  /** Show a small "reset position" button next to close. */
  onResetPosition?: () => void;
  className?: string;
  /** Spread the result of `useDraggableFloat().dragHandleProps` here. */
  onPointerDown: (e: ReactPointerEvent) => void;
  onDoubleClick: () => void;
  style?: CSSProperties;
  role?: string;
  'aria-label'?: string;
}

export default function FloatHandle({
  title,
  onClose,
  onResetPosition,
  className,
  onPointerDown,
  onDoubleClick,
  style,
  role,
  'aria-label': ariaLabel,
}: Props) {
  return (
    <div
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      role={role}
      aria-label={ariaLabel}
      style={style}
      className={cn(
        'flex items-center gap-1.5 h-7 px-2 select-none',
        'bg-[#050810]/90 border-b border-cyan-500/15',
        'text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/70',
        className,
      )}
    >
      <GripVertical className="h-3 w-3 text-cyan-300/40 shrink-0" aria-hidden />
      {title && <span className="truncate">{title}</span>}
      <span className="flex-1" />
      {onResetPosition && (
        <button
          type="button"
          data-no-drag
          onClick={onResetPosition}
          title="Reset position"
          className="h-5 w-5 inline-flex items-center justify-center rounded text-muted-foreground/60 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
      {onClose && (
        <button
          type="button"
          data-no-drag
          onClick={onClose}
          title="Close"
          className="h-5 w-5 inline-flex items-center justify-center rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
