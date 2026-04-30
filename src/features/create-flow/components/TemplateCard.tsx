import { Card } from '@/components/ui/card';
import type { TemplateMeta } from '@/features/create-flow/templates';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  template: TemplateMeta;
  onPick: (id: string) => void;
}

export default function TemplateCard({ template, onPick }: Props) {
  return (
    <button
      type="button"
      onClick={() => onPick(template.id)}
      className={cn(
        'text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl',
      )}
    >
      <Card className="h-full p-5 bg-card/60 border-border/40 hover:border-primary/40 transition-colors">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{template.name}</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4">{template.description}</p>
        <div className="flex flex-wrap gap-1.5">
          {template.segments.map((s) => (
            <span key={s} className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
              {s}
            </span>
          ))}
          <span className="text-[10px] font-mono text-muted-foreground ml-auto">{template.duration}s</span>
        </div>
      </Card>
    </button>
  );
}
