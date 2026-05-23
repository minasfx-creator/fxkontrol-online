/**
 * DS Skeleton primitives — tokenized, no business logic.
 * Use for loading states across editor surfaces (panels, fields, viewport).
 *
 * Animation: subtle shimmer (1.4s) using ds-surface tokens. Respects
 * prefers-reduced-motion via the `.ds-skeleton` class defined globally.
 */
import { cn } from '@/lib/utils';

interface DsSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tailwind height utility, e.g. "h-4". Defaults to h-3. */
  h?: string;
  /** Tailwind width utility, e.g. "w-24". Defaults to w-full. */
  w?: string;
  /** Rounded variant. Defaults to "sm". */
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const radius: Record<NonNullable<DsSkeletonProps['rounded']>, string> = {
  sm: 'rounded-ds-sm',
  md: 'rounded-ds-md',
  lg: 'rounded-ds-lg',
  full: 'rounded-full',
};

export function DsSkeleton({
  h = 'h-3',
  w = 'w-full',
  rounded = 'sm',
  className,
  ...rest
}: DsSkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'ds-skeleton bg-ds-surface-elevated/70',
        h,
        w,
        radius[rounded],
        className,
      )}
      {...rest}
    />
  );
}

export function DsSkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-ds-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <DsSkeleton
          key={i}
          h="h-2.5"
          w={i === lines - 1 ? 'w-2/3' : 'w-full'}
        />
      ))}
    </div>
  );
}

/** Panel placeholder — title row + 3 lines. */
export function DsPanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-ds-md border border-ds-border-subtle bg-ds-surface-panel p-ds-4">
      <DsSkeleton h="h-3" w="w-24" className="mb-ds-3" />
      <div className="flex flex-col gap-ds-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-ds-3">
            <DsSkeleton h="h-2.5" w="w-16" />
            <DsSkeleton h="h-2.5" w="w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Viewport placeholder — grid stage with centered spinner. */
export function DsViewportSkeleton({ label = 'Loading viewport' }: { label?: string }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-ds-background">
      <div
        className="absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(34,211,238,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.18) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="absolute inset-0 grid place-items-center">
        <div className="flex flex-col items-center gap-ds-3">
          <div
            className="size-8 rounded-full border-2 border-status-sync/30 border-t-status-sync animate-spin"
            role="status"
            aria-label={label}
          />
          <div className="text-ds-caption font-mono uppercase tracking-[0.2em] text-status-sync/80">
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}
