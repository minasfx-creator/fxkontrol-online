/**
 * FieldDiagnosticsConsole — Hardware diagnostics: power, shift registers, mux, relays.
 */
import { useState, useCallback } from 'react';
import { powerMonitor } from '@/core/hardware/PowerMonitor';
import { shiftRegisterDriver } from '@/core/hardware/ShiftRegisterDriver';
import { muxReader } from '@/core/hardware/MuxReader';
import { relayBankController } from '@/core/hardware/RelayBankController';
import { cn } from '@/lib/utils';
import { Cpu, Battery, Zap, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

function DiagBlock({ label, items }: { label: string; items: { k: string; v: string; ok?: boolean }[] }) {
  return (
    <div className="border border-border/10 rounded p-3 space-y-1">
      <span className="text-[8px] font-mono font-bold text-muted-foreground/60 tracking-widest">{label}</span>
      {items.map(i => (
        <div key={i.k} className="flex items-center justify-between text-[9px] font-mono">
          <span className="text-muted-foreground">{i.k}</span>
          <span className={i.ok === false ? 'text-red-400' : i.ok === true ? 'text-emerald-400' : 'text-foreground/70'}>{i.v}</span>
        </div>
      ))}
    </div>
  );
}

export default function FieldDiagnosticsConsole() {
  const [, setTick] = useState(0);

  const refresh = useCallback(() => {
    powerMonitor.update(Date.now());
    setTick(t => t + 1);
  }, []);

  const power = powerMonitor.getTelemetry();
  const sr = shiftRegisterDriver;
  const relays = relayBankController;

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-background/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">Field Diagnostics</span>
        </div>
        <Button size="sm" variant="outline" onClick={refresh} className="h-6 text-[9px] font-mono gap-1">
          <RefreshCw className="w-3 h-3" /> REFRESH
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1">
        <DiagBlock label="POWER — 12V BATTERY" items={[
          { k: 'Voltage', v: `${power.voltage.toFixed(1)}V`, ok: power.voltage > 11.0 },
          { k: 'Current', v: `${power.current.toFixed(2)}A` },
          { k: 'SOC', v: `${power.soc.toFixed(0)}%`, ok: power.soc > 20 },
          { k: 'Status', v: power.charging ? 'CHARGING' : power.lowVoltage ? 'LOW VOLTAGE' : 'OK', ok: !power.lowVoltage },
        ]} />

        <DiagBlock label="74HC595 SHIFT REGISTER" items={[
          { k: 'Chips', v: `${sr.chipCount} (${sr.chipCount * 8} outputs)` },
          { k: 'Mode', v: sr.mode },
          { k: 'Active Bits', v: `${sr.getActiveBitCount()}/${sr.chipCount * 8}` },
        ]} />

        <DiagBlock label="CD4051 MUX READER" items={[
          { k: 'Channels', v: `${muxReader.channelCount}` },
          { k: 'Mode', v: muxReader.mode },
          { k: 'Last Read', v: muxReader.lastReadTime > 0 ? `${((Date.now() - muxReader.lastReadTime) / 1000).toFixed(1)}s ago` : 'Never' },
        ]} />

        <DiagBlock label="32-CHANNEL RELAY BANK" items={[
          { k: 'Total', v: `${relays.channelCount} channels` },
          { k: 'Armed', v: `${relays.getArmedCount()}` },
          { k: 'Fired', v: `${relays.getFiredCount()}` },
          { k: 'Mode', v: relays.mode },
        ]} />
      </div>

      {/* Relay state grid */}
      <div className="border border-border/10 rounded p-3">
        <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest">RELAY BANK STATUS</span>
        <div className="grid grid-cols-16 gap-0.5 mt-2">
          {Array.from({ length: 32 }, (_, i) => {
            const st = relays.getChannelState(i);
            return (
              <div key={i} className={cn(
                'w-full aspect-square rounded-sm flex items-center justify-center text-[6px] font-mono font-bold',
                st === 'fired' ? 'bg-red-500/30 text-red-400' :
                st === 'armed' ? 'bg-amber-500/20 text-amber-400' :
                'bg-muted/20 text-muted-foreground/30'
              )}>
                {i}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
