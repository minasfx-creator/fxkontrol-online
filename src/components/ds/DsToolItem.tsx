/**
 * DS ToolItem — toolbar/dock button (icon + label, hover highlight, active cyan border).
 * Use inside left panel sections (Selection / Edit / Patch / Safety) or floating dock.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DsToolItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** Active = cyan border + light cyan tint. */
  active?: boolean;
  /** Mark as safety-critical (amber border + warning visual). */
  critical?: boolean;
  /** Optional keyboard hint (e.g. "M"). */
  shortcut?: string;
}

export const DsToolItem = React.forwardRef<HTMLButtonElement, DsToolItemProps>(
  ({ icon: Icon, label, active, critical, shortcut, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={active}
        className={cn(
          'inline-flex items-center gap-ds-2 rounded-ds-sm px-ds-3 py-ds-2 text-[12px]',
          'border ds-interactive ds-focus',
          critical
            ? 'border-status-warn/40 bg-status-warn/10 text-status-warn hover:bg-status-warn/15'
            : active
              ? 'border-ds-border-active bg-status-sync/10 text-status-sync'
              : 'border-transparent bg-ds-surface-deep text-ds-text-secondary hover:border-ds-border-subtle hover:text-ds-text-primary',
          className,
        )}
        {...props}
      >
        <Icon className="size-3.5" />
        <span>{label}</span>
        {shortcut && (
          <kbd className="ml-ds-1 rounded-ds-sm bg-ds-surface-elevated px-1.5 py-0.5 font-mono text-[10px] text-ds-text-muted">
            {shortcut}
          </kbd>
        )}
      </button>
    );
  },
);
DsToolItem.displayName = 'DsToolItem';
