/**
 * FXK16ActivityFeed — Read-only live feed shared across FieldOps,
 * FieldTest, and Live Firing. Renders the last N entries from the
 * `fxk16Sync` ring buffer (status changes, ARM toggles, FIRE/BATCH
 * spans with latency, ESTOP events). Click "clear" to wipe the local
 * log (does not touch hardware). Subscribes once via useFXK16Sync —
 * every surface mounting this card stays perfectly in sync.
 */
import { CheckCircle2, XCircle, Loader2, Activity, Zap } from 'lucide-react';
import { useFXK16Sync } from '@/hooks/useFXK16Sync';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Props {
  /** Max rows to render. Defaults to 24. */
  limit?: number;
  /** Optional title override. */
  title?: string;
  className?: string;
}

function formatTime(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

export default function FXK16ActivityFeed({ limit = 24, title = 'Activity', className }: Props) {
  const { events, lastFireAt, lastBatchAt, lastEStopAt, lastLatencyMs, armed, status, clearEvents } = useFXK16Sync();
  const slice = events.slice(0, limit);
  const ready = !!status?.connected && status?.linkHealth === 'healthy';

  return (
    <div className={cn('rounded-lg border border-border/40 bg-card/30 backdrop-blur-sm', className)}>
      {/* Header strip */}
      <div className="px-3 py-2 border-b border-border/30 flex items-center gap-2 flex-wrap">
        <Activity className="w-3.5 h-3.5 text-[hsl(32_100%_65%)]" />
        <span className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-foreground/85">
          FXK16 · {title}
        </span>
        <Badge
          variant="outline"
          className={cn(
            'text-[8px] h-4 px-1.5 font-mono ml-1',
            ready ? 'border-green-500/40 text-green-400' : 'border-red-500/40 text-red-400/70',
          )}
        >
          {ready ? 'READY' : 'OFFLINE'}
        </Badge>
        {armed && (
          <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-mono border-amber-500/50 text-amber-300 animate-pulse">
            ARMED
          </Badge>
        )}
        {lastLatencyMs > 0 && (
          <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-mono border-blue-500/40 text-blue-300">
            {lastLatencyMs}ms
          </Badge>
        )}
        <button
          onClick={clearEvents}
          className="ml-auto text-[8px] font-mono uppercase text-muted-foreground/40 hover:text-muted-foreground/80"
          disabled={events.length === 0}
        >
          clear
        </button>
      </div>

      {/* Timestamp summary row */}
      <div className="px-3 py-1.5 border-b border-border/20 grid grid-cols-3 gap-2 text-[9px] font-mono text-muted-foreground/70">
        <div>FIRE: <span className="text-foreground/80">{formatTime(lastFireAt)}</span></div>
        <div>BATCH: <span className="text-foreground/80">{formatTime(lastBatchAt)}</span></div>
        <div>E-STOP: <span className="text-foreground/80">{formatTime(lastEStopAt)}</span></div>
      </div>

      {/* Event list */}
      <div className="max-h-44 overflow-y-auto">
        {slice.length === 0 ? (
          <div className="px-3 py-4 text-[10px] font-mono text-muted-foreground/40 text-center">
            Sem eventos. Conecte e dispare em qualquer painel — todos compartilham este feed.
          </div>
        ) : (
          <ul className="divide-y divide-border/20">
            {slice.map((e) => {
              const isStart = e.kind.endsWith('_start');
              const isOk = e.ok === true || (!isStart && e.kind === 'connected');
              const isErr = e.ok === false || e.kind === 'disconnected' || e.kind === 'heartbeat_timeout';
              return (
                <li key={e.id} className="px-3 py-1 flex items-center gap-2 text-[10px] font-mono">
                  {isStart && <Loader2 className="w-3 h-3 text-blue-400 animate-spin shrink-0" />}
                  {!isStart && isOk && <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />}
                  {!isStart && isErr && <XCircle className="w-3 h-3 text-red-400 shrink-0" />}
                  {!isStart && !isOk && !isErr && <Zap className="w-3 h-3 text-muted-foreground/60 shrink-0" />}
                  <span className="text-muted-foreground/60 shrink-0">{formatTime(e.ts)}</span>
                  <span className="truncate text-foreground/80">{e.label}</span>
                  {typeof e.latencyMs === 'number' && (
                    <span className="ml-auto text-blue-300/80 shrink-0">{e.latencyMs}ms</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
