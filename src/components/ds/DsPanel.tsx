/**
 * DS Panel — generic surface block (left/right panels, sidebars).
 * padding 16, bg surface-deep, 1px border default.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DsPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Use elevated surface instead of deep (for nested panels). */
  elevated?: boolean;
}

export const DsPanel = React.forwardRef<HTMLDivElement, DsPanelProps>(
  ({ className, elevated, ...p }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-ds-md border border-ds-border-default p-ds-4',
        elevated ? 'bg-ds-surface-elevated' : 'bg-ds-surface-deep',
        className,
      )}
      {...p}
    />
  ),
);
DsPanel.displayName = 'DsPanel';

export const DsPanelTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...p }, ref) => (
    <div
      ref={ref}
      className={cn('mb-ds-3 ds-caption font-mono uppercase tracking-wider text-ds-text-muted', className)}
      {...p}
    />
  ),
);
DsPanelTitle.displayName = 'DsPanelTitle';
