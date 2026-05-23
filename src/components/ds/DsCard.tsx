/**
 * DS Card — Office / Templates / Use-cases.
 * Vertical auto-layout: padding 16, gap 12, radius 16, panel surface.
 * Hover: cyan border + slight lift. Selectable via `selected` prop.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DsCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** When true, treat as button-like (cursor-pointer + hover effects). */
  interactive?: boolean;
  /** Selected state (cyan active border + glow). */
  selected?: boolean;
}

export const DsCard = React.forwardRef<HTMLDivElement, DsCardProps>(
  ({ className, interactive, selected, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col gap-ds-3 rounded-ds-lg border bg-ds-surface-panel p-ds-4',
        'transition-all',
        interactive &&
          'cursor-pointer hover:border-ds-border-active hover:-translate-y-0.5 ds-focus',
        selected ? 'ds-active-border' : 'border-ds-border-default',
        className,
      )}
      style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
      {...props}
    />
  ),
);
DsCard.displayName = 'DsCard';

export const DsCardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...p }, ref) => (
    <div ref={ref} className={cn('flex items-center gap-ds-3', className)} {...p} />
  ),
);
DsCardHeader.displayName = 'DsCardHeader';

export const DsCardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...p }, ref) => (
    <h3 ref={ref} className={cn('text-[18px] font-semibold leading-tight text-ds-text-primary', className)} {...p} />
  ),
);
DsCardTitle.displayName = 'DsCardTitle';

export const DsCardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...p }, ref) => (
    <p ref={ref} className={cn('text-[14px] leading-snug text-ds-text-secondary', className)} {...p} />
  ),
);
DsCardDescription.displayName = 'DsCardDescription';

export const DsCardCta = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...p }, ref) => (
    <span
      ref={ref}
      className={cn('text-[12px] font-mono uppercase tracking-wider text-status-sync', className)}
      {...p}
    />
  ),
);
DsCardCta.displayName = 'DsCardCta';
