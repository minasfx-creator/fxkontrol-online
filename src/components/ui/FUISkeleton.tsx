/**
 * FUISkeleton — FUI-themed loading skeleton with Electric Cyan scanline
 */
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  lines?: number;
  /** Render as a single block instead of lines */
  block?: boolean;
}

export default function FUISkeleton({ className, lines = 3, block = false }: Props) {
  if (block) {
    return (
      <div className={cn("relative overflow-hidden rounded-lg bg-muted/30 border border-border/10", className)}>
        <div className="absolute inset-0 fui-scanline-sweep" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-md bg-muted/30 border border-border/10"
          style={{
            height: 12,
            width: `${70 + Math.random() * 30}%`,
            animationDelay: `${i * 80}ms`,
          }}
        >
          <div className="absolute inset-0 fui-scanline-sweep" />
        </div>
      ))}
      <style>{`
        .fui-scanline-sweep {
          background: linear-gradient(90deg, transparent 0%, hsl(var(--fxk-cyan) / 0.08) 50%, transparent 100%);
          animation: fui-sweep 1.5s ease-in-out infinite;
        }
        @keyframes fui-sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
