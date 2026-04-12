/**
 * DMXArtNetConsole — Protocol monitor for Art-Net / DMX universes.
 */
import { useState, useCallback } from 'react';
import { dmxUniverseManager } from '@/core/protocols/DMXUniverseManager';
import { artNetBridge } from '@/core/protocols/ArtNetBridge';
import { linkFailoverPolicy } from '@/core/protocols/LinkFailoverPolicy';
import { cn } from '@/lib/utils';
import { Radio, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DMXArtNetConsole() {
  const [, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  const artnetState = artNetBridge.getState();
  const isConnected = artnetState === 'connected';
  const artnetStats = artNetBridge.getStats();
  const universes = dmxUniverseManager.getUniverses();
  const failover = linkFailoverPolicy.getStatus();

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-background/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">DMX / Art-Net Console</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            'flex items-center gap-1 text-[8px] font-mono px-2 py-0.5 rounded border',
            isConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
          )}>
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </div>
          <Button size="sm" variant="outline" onClick={refresh} className="h-6 text-[9px] font-mono gap-1">
            <RefreshCw className="w-3 h-3" /> REFRESH
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="border border-border/10 rounded p-3 space-y-1">
          <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest">ART-NET</span>
          <div className="text-[9px] font-mono space-y-0.5">
            <div className="flex justify-between"><span className="text-muted-foreground">State</span><span className="text-foreground/70">{artnetState}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Nodes</span><span className="text-foreground/70">{artnetStats.nodes}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">TX/RX</span><span className="text-foreground/70">{artnetStats.sent}/{artnetStats.received}</span></div>
          </div>
        </div>

        <div className="border border-border/10 rounded p-3 space-y-1">
          <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest">UNIVERSES</span>
          <div className="text-[9px] font-mono space-y-0.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Active</span><span className="text-foreground/70">{universes.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total Ch</span><span className="text-foreground/70">{universes.length * 512}</span></div>
          </div>
        </div>

        <div className="border border-border/10 rounded p-3 space-y-1">
          <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest">FAILOVER</span>
          <div className="text-[9px] font-mono space-y-0.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Active</span><span className="text-foreground/70">{failover.activeLink}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Switches</span><span className="text-foreground/70">{failover.failoverCount}</span></div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto border border-border/10 rounded p-2">
        <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest">UNIVERSE MAP</span>
        {universes.length === 0 ? (
          <p className="text-[9px] font-mono text-muted-foreground/40 mt-2">No DMX universes configured</p>
        ) : (
          <div className="mt-2 space-y-1">
            {universes.map(u => {
              const buf = dmxUniverseManager.getBuffer(u.id);
              const active = buf ? Array.from(buf).filter(v => v > 0).length : 0;
              return (
                <div key={u.id} className="flex items-center gap-3 text-[9px] font-mono">
                  <span className="text-blue-400/70 w-12">U{u.id}</span>
                  <span className="text-muted-foreground/50 w-20">{u.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                    <div className="h-full bg-blue-400/40 rounded-full" style={{ width: `${(active / 512) * 100}%` }} />
                  </div>
                  <span className="text-muted-foreground/50 w-16 text-right">{active}/512</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
