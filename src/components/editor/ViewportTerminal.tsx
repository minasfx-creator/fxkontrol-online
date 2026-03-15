import { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'diag';
}

// Global log store
let logEntries: LogEntry[] = [];
let listeners: Set<() => void> = new Set();

export function pushLog(message: string, level: LogEntry['level'] = 'info') {
  const entry: LogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    timestamp: Date.now(),
    message,
    level,
  };
  logEntries = [entry, ...logEntries].slice(0, 100);
  listeners.forEach((fn) => fn());
}

function useLogEntries() {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return logEntries;
}

const LEVEL_COLORS: Record<LogEntry['level'], string> = {
  info: 'text-muted-foreground',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  success: 'text-green-400',
  diag: 'text-primary',
};

export default function ViewportTerminal() {
  const [collapsed, setCollapsed] = useState(true);
  const [visible, setVisible] = useState(true);
  const entries = useLogEntries();
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="absolute bottom-3 left-3 bg-surface-1/80 backdrop-blur border border-border/50 p-1.5 rounded hover:bg-surface-2/80 transition-all z-10"
        title="Show Terminal"
      >
        <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "absolute bottom-3 left-3 bg-surface-0/85 backdrop-blur-sm border border-border/60 rounded-sm font-mono-code text-[9px] z-10 transition-all",
        collapsed ? "w-72" : "w-80"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border/40">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3 h-3 text-primary" />
          <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">System Log</span>
          <span className="text-[7px] text-muted-foreground/60">({entries.length})</span>
        </div>
        <div className="flex gap-0.5">
          <button onClick={() => setCollapsed(!collapsed)} className="text-muted-foreground hover:text-foreground p-0.5">
            {collapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button onClick={() => setVisible(false)} className="text-muted-foreground hover:text-foreground p-0.5">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className={cn(
          "overflow-y-auto px-2 py-1 space-y-0.5 transition-all",
          collapsed ? "max-h-20" : "max-h-40"
        )}
      >
        {entries.length === 0 ? (
          <div className="text-muted-foreground/50 text-center py-2">&gt; FX Kontrol Engine Ready.</div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className={cn("leading-tight", LEVEL_COLORS[entry.level])}>
              <span className="text-muted-foreground/40 mr-1">
                {new Date(entry.timestamp).toLocaleTimeString('pt-BR', { hour12: false })}
              </span>
              &gt; {entry.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
