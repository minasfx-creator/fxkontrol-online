import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export type PillVariant = 'ok' | 'ai' | 'warn' | 'neutral';

interface StatusPillProps {
  icon?: LucideIcon;
  label: string;
  variant?: PillVariant;
  pulse?: boolean;
}

const VARIANT_STYLES: Record<PillVariant, { dot: string; text: string; ring: string }> = {
  ok:      { dot: 'bg-[hsl(var(--fxk-green))]',   text: 'text-[hsl(var(--fxk-green))]',   ring: 'ring-[hsl(var(--fxk-green)/0.35)]' },
  ai:      { dot: 'bg-[hsl(var(--fxk-cyan))]',    text: 'text-[hsl(var(--fxk-cyan))]',    ring: 'ring-[hsl(var(--fxk-cyan)/0.35)]' },
  warn:    { dot: 'bg-[hsl(var(--fxk-amber))]',   text: 'text-[hsl(var(--fxk-amber))]',   ring: 'ring-[hsl(var(--fxk-amber)/0.35)]' },
  neutral: { dot: 'bg-muted-foreground',          text: 'text-muted-foreground',          ring: 'ring-border' },
};

export default function StatusPill({ icon: Icon, label, variant = 'neutral', pulse = false }: StatusPillProps) {
  const v = VARIANT_STYLES[variant];
  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full',
      'bg-background/40 ring-1 backdrop-blur-md',
      'text-[10px] font-mono font-semibold tracking-wider uppercase',
      v.text, v.ring,
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', v.dot, pulse && 'animate-pulse')} />
      {Icon && <Icon className="w-3 h-3" />}
      <span className="truncate">{label}</span>
    </div>
  );
}
