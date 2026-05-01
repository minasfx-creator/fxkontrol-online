import { type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Big tactile card used by the /create Action Layer and Office hub.
 * Keyboard-accessible (button), uses semantic tokens only.
 */
export default function ActionCard({ icon: Icon, title, description, onClick, disabled, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group text-left w-full',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl',
        className,
      )}
    >
      <Card className="h-full p-5 bg-card/60 border-border/40 hover:border-primary/40 hover:bg-card/80 transition-colors">
        <div className="flex items-start gap-4">
          <div className="shrink-0 size-10 rounded-lg bg-primary/10 text-primary grid place-items-center group-hover:bg-primary/20 transition-colors">
            <Icon className="size-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          </div>
        </div>
      </Card>
    </button>
  );
}
