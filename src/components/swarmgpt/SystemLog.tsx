import { useEffect, useRef, useState } from 'react';
import { Terminal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type LogLevel = 'info' | 'ai' | 'warn' | 'ok';
export interface LogLine {
  id: string;
  time: string;
  message: string;
  level: LogLevel;
}

const LEVEL_PREFIX: Record<LogLevel, string> = {
  info: '[SYS]',
  ai:   '[AI]',
  warn: '[SAFETY]',
  ok:   '[OK]',
};
const LEVEL_COLOR: Record<LogLevel, string> = {
  info: 'text-muted-foreground',
  ai:   'text-[hsl(var(--fxk-cyan))]',
  warn: 'text-[hsl(var(--fxk-amber))]',
  ok:   'text-[hsl(var(--fxk-green))]',
};

interface SystemLogProps {
  lines: LogLine[];
  onClear: () => void;
}

export default function SystemLog({ lines, onClear }: SystemLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines.length]);

  return (
    <div className="glass-premium rounded-xl flex flex-col overflow-hidden h-full">
      <header className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Terminal className="w-3 h-3 text-[hsl(var(--fxk-cyan))]" />
          <span className="text-[9px] font-black tracking-[0.18em] uppercase text-foreground">
            System Log
          </span>
          <span className="text-[9px] font-mono text-muted-foreground">({lines.length})</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear} title="Clear">
          <Trash2 className="w-3 h-3" />
        </Button>
      </header>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1 font-mono text-[10px] leading-snug">
        {lines.length === 0 ? (
          <div className="text-muted-foreground/60">&gt; Waiting for AI events…</div>
        ) : (
          lines.map((l) => (
            <div key={l.id} className={cn('flex gap-1.5', LEVEL_COLOR[l.level])}>
              <span className="text-muted-foreground/50">{l.time}</span>
              <span className="font-bold">{LEVEL_PREFIX[l.level]}</span>
              <span className="flex-1">{l.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

let counter = 0;
export function useSystemLog(maxLines = 200) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const append = (message: string, level: LogLevel = 'info') => {
    setLines((prev) => {
      const next = [...prev, {
        id: `log-${Date.now()}-${counter++}`,
        time: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
        message,
        level,
      }];
      return next.length > maxLines ? next.slice(-maxLines) : next;
    });
  };
  const clear = () => setLines([]);
  return { lines, append, clear };
}
