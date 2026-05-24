/**
 * ─── Relay Bank Monitor ────────────────────────────────────────────
 * 32-channel grid showing continuity status per relay channel.
 * Read-only diagnostic view — no relay control.
 */

import { useEffect, useState } from 'react';
import { relayBankAdapter } from '@/core/hardware/adapters/RelayBankAdapter32';
import { shouldAdapterTick } from '@/core/hardware/adapterTickGate';
import { cn } from '@/lib/utils';
import { Activity, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RelayBankState } from '@/core/hardware/types';

const CONTINUITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  ok:      { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'OK' },
  open:    { bg: 'bg-amber-500/20',   text: 'text-amber-400',   label: 'OPEN' },
  short:   { bg: 'bg-red-500/20',     text: 'text-red-400',     label: 'SHORT' },
  unknown: { bg: 'bg-muted/20',       text: 'text-muted-foreground/40', label: '?' },
};

export default function RelayBankMonitor() {
  const [state, setState] = useState<RelayBankState>(relayBankAdapter.getState());

  useEffect(() => {
    if (!shouldAdapterTick(relayBankAdapter)) return;
    const iv = setInterval(() => {
      relayBankAdapter.pollTelemetry();
      setState(relayBankAdapter.getState());
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const refresh = () => setState(relayBankAdapter.getState());

  return (
    <div className="flex flex-col h-full bg-background/80 p-3 gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">Relay Bank — 32ch</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-emerald-400">{state.healthy_channels} OK</span>
          <span className="text-[8px] font-mono text-red-400">{state.fault_channels.length} FAULT</span>
          <Button variant="ghost" size="sm" className="h-5 px-1.5" onClick={refresh}>
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-1.5 flex-1 content-start">
        {state.channel_states.map(ch => {
          const cfg = CONTINUITY_COLORS[ch.continuity];
          return (
            <div key={ch.channel}
              className={cn('rounded border border-border/20 p-1.5 flex flex-col items-center gap-0.5', cfg.bg)}>
              <span className="text-[8px] font-mono font-bold text-foreground">CH {ch.channel}</span>
              <span className={cn('text-[7px] font-mono font-bold', cfg.text)}>{cfg.label}</span>
              {ch.continuity === 'ok' && (
                <span className="text-[6px] font-mono text-muted-foreground/50">
                  {ch.resistance_ohms.toFixed(1)}Ω
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
