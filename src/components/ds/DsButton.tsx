/**
 * DS Button — opt-in component using FXKONTROL Design System v1 tokens.
 *
 * Variants: primary (sync/cyan), secondary, ghost, danger
 * Sizes:    sm (32) · md (40) · lg (48)
 *
 * NOTE: This is additive — does NOT replace `@/components/ui/button`.
 * Use `<Button>` (shadcn) for legacy chrome and `<DsButton>` for new
 * Mission-Control surfaces (Office, Live Firing, Field Ops, etc.).
 */
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const dsButtonVariants = cva(
  // base
  'inline-flex items-center justify-center gap-ds-2 whitespace-nowrap font-medium ' +
    'rounded-ds-md transition-colors ds-focus disabled:opacity-50 disabled:pointer-events-none ' +
    '[&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-status-sync text-ds-background hover:brightness-110 active:brightness-95',
        secondary:
          'border border-ds-border-default bg-ds-surface-elevated text-ds-text-primary ' +
          'hover:border-ds-border-active hover:text-status-sync',
        ghost:
          'text-ds-text-secondary hover:bg-ds-surface-elevated hover:text-ds-text-primary',
        danger:
          'bg-status-fail text-white hover:brightness-110 active:brightness-95',
      },
      size: {
        sm: 'h-8 px-3 text-[12px]',
        md: 'h-10 px-4 text-[14px]',
        lg: 'h-12 px-6 text-[15px]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface DsButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof dsButtonVariants> {
  asChild?: boolean;
}

export const DsButton = React.forwardRef<HTMLButtonElement, DsButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} className={cn(dsButtonVariants({ variant, size }), className)} {...props} />
    );
  },
);
DsButton.displayName = 'DsButton';

export { dsButtonVariants };
