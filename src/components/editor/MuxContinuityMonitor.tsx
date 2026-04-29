/**
 * ─── MUX / Continuity Monitor ──────────────────────────────────────
 * Displays 16-channel MUX readings with continuity state per channel.
 */

import { useEffect, useState } from 'react';
import { muxReaderAdapter } from '@/core/hardware/adapters/MuxReaderAdapterCD4051';
import { shouldAdapterTick } from '@/core/hardware/adapterTickGate';
import { cn } from '@/lib/utils';
import { Radio, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MultiplexerState } from '@/core/hardware/types';

const STATE_CFG: Record<string, { color: string; bg: string }> = {
  ok:      { color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  open:    { color: 'text-amber-400',   bg: 'bg-amber-500/15' },
  short:   { color: 'text-red-400',     bg: 'bg-red-500/15' },
  unknown: { color: 'text-muted-foreground/40', bg: 'bg-muted/10' },
};

export default function MuxContinuityMonitor() {
  const [muxStates, setMuxStates] = useState<MultiplexerState[]>(muxReaderAdapter.getState());

  useEffect(() => {
    if (!shouldAdapterTick(muxReaderAdapter)) return;
    const iv = setInterval(() => {
      muxReaderAdapter.pollTelemetry();
      setMuxStates(muxReaderAdapter.getState());
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const connected = muxReaderAdapter.getConnectionState() !== 'disconnected';
  const allChannels = muxStates.flatMap(m => m.channels);
  const ok = allChannels.filter(c => c.state === 'ok').length;
  const open = allChannels.filter(c => c.state === 'open').length;
  const short = allChannels.filter(c => c.state === 'short').length;

  return (
    <div className="flex flex-col h-full bg-background/80 p-3 gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">MUX / Continuity</span>
        </div>
        <div className="flex items-center gap-2 text-[8px] font-mono">
          <span className="text-emerald-400">{ok} OK</span>
          <span className="text-amber-400">{open} OPEN</span>
          <span className="text-red-400">{short} SHORT</span>
        </div>
      </div>

      {!connected ? (
        <div className="flex-1 flex items-center justify-center text-[10px] font-mono text-muted-foreground/40">
          MUX not connected
        </div>
      ) : (
        <>
          {muxStates.map(mux => (
            <div key={mux.mux_id} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-mono font-bold text-foreground uppercase">{mux.mux_id}</span>
                {mux.fault_state && <span className="text-[7px] font-mono text-red-400 font-bold">FAULT</span>}
                <span className="text-[7px] font-mono text-muted-foreground/40">Samples: {mux.sample_count}</span>
              </div>
              <div className="grid grid-cols-8 gap-1">
                {mux.channels.map(ch => {
                  const cfg = STATE_CFG[ch.state];
                  return (
                    <div key={ch.channel} className={cn('rounded border border-border/20 p-1.5 text-center', cfg.bg)}>
                      <div className="text-[8px] font-mono font-bold text-foreground">CH{ch.channel}</div>
                      <div className={cn('text-[7px] font-mono font-bold', cfg.color)}>{ch.state.toUpperCase()}</div>
                      {ch.state === 'ok' && (
                        <div className="text-[6px] font-mono text-muted-foreground/40">{ch.resistance_ohms.toFixed(1)}Ω</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
