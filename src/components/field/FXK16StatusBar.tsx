/**
 * FXK16StatusBar — Compact, always-visible status strip showing the
 * current FXK16 link state. Pulls from the shared `useFXK16Sync`
 * snapshot so every surface (FieldOps, FieldTest, Live Firing) shows
 * the SAME truth. Render this anywhere a glance-confirmation of
 * connection, healthcheck, or last command result is useful.
 *
 * Chips (left → right):
 *   • LINK   : OFFLINE | HANDSHAKING | HEALTHY · transport
 *   • DEVICE : deviceModel · channelCount (FXK16 · 16ch)
 *   • FW     : firmware version (when reported)
 *   • RSSI   : signal in dBm (when reported)
 *   • ARM    : ARMED (amber pulse) | SAFE
 *   • LAST   : ✓/✗ <op> <latency>ms (last fire/batch/estop result)
 *   • ERROR  : last bridge error code (only when present)
 */
import { useMemo } from 'react';
import {
  Cable, ShieldOff, ShieldCheck, CheckCircle2, XCircle,
  AlertTriangle, Signal, Cpu, Activity,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFXK16Sync } from '@/hooks/useFXK16Sync';
import type { SyncEvent } from '@/lib/fxk16/syncStore';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  /** When true, hides chips that have no data (more compact). */
  compact?: boolean;
}

function pickLastResult(events: SyncEvent[]): SyncEvent | undefined {
  return events.find((e) =>
    e.kind === 'fire_settled'
    || e.kind === 'batch_settled'
    || e.kind === 'estop_result',
  );
}

export default function FXK16StatusBar({ className, compact = false }: Props) {
  const { status, armed, events, lastLatencyMs } = useFXK16Sync();

  const linkLabel = useMemo(() => {
    if (!status?.connected) return 'OFFLINE';
    if (status.linkHealth === 'handshaking') return 'HANDSHAKING';
    if (status.linkHealth === 'healthy') return 'HEALTHY';
    return (status.linkHealth ?? 'UNKNOWN').toUpperCase();
  }, [status]);

  const linkTone =
    !status?.connected ? 'border-red-500/40 text-red-400/80'
    : status.linkHealth === 'healthy' ? 'border-green-500/50 text-green-400'
    : 'border-amber-500/50 text-amber-300';

  const transport = (status?.transport ?? 'none').toUpperCase();
  const lastResult = pickLastResult(events);
  const lastError = status?.lastError;

  return (
    <div className={cn(
      'flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-md border border-border/30 bg-card/30 backdrop-blur-sm',
      className,
    )}>
      {/* LINK */}
      <Badge variant="outline" className={cn('text-[8px] h-4 px-1.5 font-mono gap-1', linkTone)}>
        <Cable className="w-2.5 h-2.5" />
        {linkLabel}{status?.connected ? ` · ${transport}` : ''}
      </Badge>

      {/* DEVICE */}
      {(status?.deviceModel || !compact) && (
        <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-mono gap-1 border-blue-500/40 text-blue-300">
          <Cpu className="w-2.5 h-2.5" />
          {status?.deviceModel ?? '—'}{status?.channelCount ? ` · ${status.channelCount}ch` : ''}
        </Badge>
      )}

      {/* FIRMWARE */}
      {status?.firmwareVersion && (
        <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-mono border-muted-foreground/30 text-muted-foreground/80">
          fw {status.firmwareVersion}
        </Badge>
      )}

      {/* RSSI */}
      {typeof status?.rssi === 'number' && (
        <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-mono gap-1 border-muted-foreground/30 text-muted-foreground/80">
          <Signal className="w-2.5 h-2.5" />
          {status.rssi}dBm
        </Badge>
      )}

      {/* ARM */}
      <Badge
        variant="outline"
        className={cn(
          'text-[8px] h-4 px-1.5 font-mono gap-1',
          armed
            ? 'border-amber-500/60 text-amber-300 animate-pulse'
            : 'border-green-500/40 text-green-400/80',
        )}
      >
        {armed ? <ShieldOff className="w-2.5 h-2.5" /> : <ShieldCheck className="w-2.5 h-2.5" />}
        {armed ? 'ARMED' : 'SAFE'}
      </Badge>

      {/* LAST RESULT */}
      {lastResult && (
        <Badge
          variant="outline"
          className={cn(
            'text-[8px] h-4 px-1.5 font-mono gap-1',
            lastResult.ok ? 'border-green-500/40 text-green-300' : 'border-red-500/40 text-red-300',
          )}
          title={lastResult.label}
        >
          {lastResult.ok ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
          <span className="truncate max-w-[12rem]">{lastResult.label}</span>
          {typeof lastResult.latencyMs === 'number' && (
            <span className="text-blue-300/80">{lastResult.latencyMs}ms</span>
          )}
        </Badge>
      )}

      {/* GLOBAL LATENCY (when no last result yet) */}
      {!lastResult && lastLatencyMs > 0 && (
        <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-mono gap-1 border-blue-500/40 text-blue-300">
          <Activity className="w-2.5 h-2.5" />
          {lastLatencyMs}ms
        </Badge>
      )}

      {/* LAST ERROR */}
      {lastError && (
        <Badge
          variant="outline"
          className="text-[8px] h-4 px-1.5 font-mono gap-1 border-red-500/50 text-red-300 ml-auto"
          title={lastError}
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          {status?.lastErrorCode ?? 'ERR'}
        </Badge>
      )}
    </div>
  );
}
