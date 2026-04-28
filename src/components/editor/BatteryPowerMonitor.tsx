/**
 * ─── Battery & Power Monitor ───────────────────────────────────────
 * Real-time battery voltage and power state monitoring.
 * Shows voltage graph simulation and alarm status.
 */

import { useEffect, useState } from 'react';
import { batteryMonitorAdapter } from '@/core/hardware/adapters/BatteryMonitorAdapter';
import { shouldAdapterTick } from '@/core/hardware/adapterTickGate';
import { cn } from '@/lib/utils';
import { Battery, AlertTriangle, Zap } from 'lucide-react';
import type { BatteryState } from '@/core/hardware/types';

export default function BatteryPowerMonitor() {
  const [state, setState] = useState<BatteryState>(batteryMonitorAdapter.getState());
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    // Honest-hardware: don't even schedule a tick if there's no device
    // OR the synthetic simulator is OFF. Prevents stray Math.random() and
    // wasted timers when the panel is opened on an empty fleet.
    if (!shouldAdapterTick(batteryMonitorAdapter)) return;
    const iv = setInterval(() => {
      batteryMonitorAdapter.pollTelemetry();
      const s = batteryMonitorAdapter.getState();
      setState(s);
      if (s.voltage > 0) setHistory(h => [...h.slice(-59), s.voltage]);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const connected = batteryMonitorAdapter.getConnectionState() === 'connected';
  const barColor = state.low_battery_alarm ? 'bg-red-500' : state.percentage < 30 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="flex flex-col h-full bg-background/80 p-3 gap-3">
      <div className="flex items-center gap-2">
        <Battery className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">Battery & Power</span>
      </div>

      {!connected ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[10px] font-mono text-muted-foreground/40">No battery monitor connected</span>
        </div>
      ) : (
        <>
          {/* Main voltage display */}
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <div className={cn('text-4xl font-mono font-black tabular-nums', state.low_battery_alarm ? 'text-red-400' : 'text-emerald-400')}>
                {state.voltage.toFixed(1)}V
              </div>
              <div className="text-[8px] font-mono text-muted-foreground/50 uppercase">{state.source}</div>
            </div>
            <div className="text-center">
              <div className={cn('text-2xl font-mono font-bold', state.percentage < 20 ? 'text-red-400' : 'text-foreground')}>
                {state.percentage.toFixed(0)}%
              </div>
              <div className="text-[8px] font-mono text-muted-foreground/50">CAPACITY</div>
            </div>
          </div>

          {/* Battery bar */}
          <div className="h-3 rounded-full bg-muted/20 border border-border/20 overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', barColor)}
              style={{ width: `${Math.max(2, state.percentage)}%` }} />
          </div>

          {/* Alarm */}
          {state.low_battery_alarm && (
            <div className="flex items-center gap-2 p-2 rounded border border-red-500/30 bg-red-500/10">
              <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
              <span className="text-[9px] font-mono font-bold text-red-400">LOW BATTERY ALARM — Hardware sync blocked</span>
            </div>
          )}

          {state.charging && (
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-amber-400" />
              <span className="text-[8px] font-mono text-amber-400">Charging</span>
            </div>
          )}

          {/* Voltage history sparkline */}
          {history.length > 2 && (
            <div className="mt-auto">
              <span className="text-[7px] font-mono text-muted-foreground/40 uppercase">Voltage History</span>
              <div className="h-16 border border-border/10 rounded bg-card/20 p-1 flex items-end gap-px">
                {history.map((v, i) => {
                  const h = Math.max(2, ((v - 10) / 3) * 100);
                  return (
                    <div key={i} className={cn('flex-1 rounded-t', v < 11 ? 'bg-red-500/60' : v < 11.5 ? 'bg-amber-500/60' : 'bg-emerald-500/40')}
                      style={{ height: `${h}%` }} />
                  );
                })}
              </div>
              <div className="flex justify-between text-[6px] font-mono text-muted-foreground/30">
                <span>10V</span><span>13V</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
