/**
 * ─── Art-Net / DMX Protocol Monitor ────────────────────────────────
 * Real-time monitoring of Art-Net node link health, latency,
 * packet rates, and universe mapping.
 */

import { useEffect, useState } from 'react';
import { artNetNodeAdapter, type ArtNetNodeState } from '@/core/hardware/adapters/ArtNetNodeAdapter';
import { shouldAdapterTick } from '@/core/hardware/adapterTickGate';
import { cn } from '@/lib/utils';
import { Wifi, Activity } from 'lucide-react';

export default function ArtNetDMXMonitor() {
  const [state, setState] = useState<ArtNetNodeState>(artNetNodeAdapter.getState());

  useEffect(() => {
    if (!shouldAdapterTick(artNetNodeAdapter)) return;
    const iv = setInterval(() => {
      artNetNodeAdapter.pollTelemetry();
      setState(artNetNodeAdapter.getState());
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const conn = artNetNodeAdapter.getConnectionState();
  const online = conn === 'connected' || conn === 'degraded';

  return (
    <div className="flex flex-col h-full bg-background/80 p-3 gap-3">
      <div className="flex items-center gap-2">
        <Wifi className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">Art-Net / DMX Monitor</span>
        <div className={cn('w-2 h-2 rounded-full ml-auto', online ? (state.link.degraded ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-red-400')} />
        <span className={cn('text-[8px] font-mono', online ? (state.link.degraded ? 'text-amber-400' : 'text-emerald-400') : 'text-red-400')}>
          {conn.toUpperCase()}
        </span>
      </div>

      {!online ? (
        <div className="flex-1 flex items-center justify-center text-[10px] font-mono text-muted-foreground/40">
          Art-Net node offline
        </div>
      ) : (
        <div className="space-y-3">
          {/* Node info */}
          <div className="grid grid-cols-2 gap-2">
            <InfoCard label="Node IP" value={state.node_ip} />
            <InfoCard label="Protocol" value={state.link.protocol} />
            <InfoCard label="Universes" value={state.universes.join(', ')} />
            <InfoCard label="PPS" value={`${state.packets_per_second}`} />
          </div>

          {/* Link health */}
          <div className="rounded border border-border/20 bg-card/20 p-2 space-y-1">
            <span className="text-[7px] font-mono text-muted-foreground/50 uppercase">Link Health</span>
            <div className="grid grid-cols-3 gap-2">
              <MetricCard label="Latency" value={`${state.link.latency_ms.toFixed(1)}ms`}
                color={state.link.latency_ms > 30 ? 'amber' : 'emerald'} />
              <MetricCard label="Packet Loss" value={`${state.link.packet_loss.toFixed(1)}%`}
                color={state.link.packet_loss > 2 ? 'amber' : 'emerald'} />
              <MetricCard label="ArtPoll Resp" value={`${state.artpoll_responses}`} color="cyan" />
            </div>
          </div>

          {/* Degraded warning */}
          {state.link.degraded && (
            <div className="p-2 rounded border border-amber-500/30 bg-amber-500/10 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="text-[8px] font-mono text-amber-400">Link quality degraded — consider checking network</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/10 bg-card/10 p-1.5">
      <div className="text-[6px] font-mono text-muted-foreground/40 uppercase">{label}</div>
      <div className="text-[10px] font-mono text-foreground font-medium">{value}</div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  const cc: Record<string, string> = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    cyan: 'text-cyan-400',
  };
  return (
    <div className="text-center">
      <div className={cn('text-lg font-mono font-bold', cc[color])}>{value}</div>
      <div className="text-[6px] font-mono text-muted-foreground/40 uppercase">{label}</div>
    </div>
  );
}
