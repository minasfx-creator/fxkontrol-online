import type { SegmentType } from '@/features/viewport-tools/types';
import { Flame, Volume2, Plane, Lightbulb, Cable } from 'lucide-react';
import { cn } from '@/lib/utils';

const SEGMENTS: { id: SegmentType; label: string; icon: typeof Flame }[] = [
  { id: 'PYRO', label: 'PYRO', icon: Flame },
  { id: 'SFX', label: 'SFX', icon: Volume2 },
  { id: 'DRONES', label: 'DRONES', icon: Plane },
  { id: 'LIGHT', label: 'LIGHT', icon: Lightbulb },
  { id: 'DMX', label: 'DMX', icon: Cable },
];

interface Props {
  value: SegmentType[];
  onChange: (next: SegmentType[]) => void;
  className?: string;
}

export default function SegmentChips({ value, onChange, className }: Props) {
  const toggle = (s: SegmentType) => {
    onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s]);
  };
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {SEGMENTS.map(({ id, label, icon: Icon }) => {
        const active = value.includes(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold border transition-colors',
              active
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-card/40 border-border/40 text-muted-foreground hover:text-foreground hover:border-border',
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
