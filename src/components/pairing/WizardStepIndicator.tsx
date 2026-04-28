import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  steps: { key: string; label: string }[];
  currentIndex: number;
}

export function WizardStepIndicator({ steps, currentIndex }: Props) {
  return (
    <ol className="flex items-center justify-between w-full px-2 py-3 select-none">
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={step.key} className="flex flex-col items-center flex-1 min-w-0">
            <div
              className={cn(
                'h-7 w-7 rounded-full border flex items-center justify-center text-[11px] font-mono transition-colors',
                done && 'bg-primary/20 border-primary text-primary',
                active && 'bg-primary text-primary-foreground border-primary shadow-[0_0_12px_hsl(var(--primary)/0.6)]',
                !done && !active && 'bg-muted/20 border-border/40 text-muted-foreground',
              )}
              aria-current={active ? 'step' : undefined}
            >
              {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                'mt-1.5 text-[10px] uppercase tracking-wider truncate w-full text-center',
                active ? 'text-primary font-semibold' : 'text-muted-foreground',
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
