/**
 * AddressingConsole — Universe/fixture/channel mapping and protocol overview.
 * Consumes ShowPlan + DMXUniverseManager + FixtureAddressing data.
 */
import { useState, useCallback } from 'react';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { dmxUniverseManager } from '@/core/protocols/DMXUniverseManager';
import { fixtureAddressing } from '@/core/protocols/FixtureAddressing';
import { cn } from '@/lib/utils';
import { Map as MapIcon, RefreshCw, Radio, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AddressingConsole() {
  const [, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  const sp = showPlanManager.current;
  const universes = dmxUniverseManager.getUniverses();
  const fixtures = fixtureAddressing.getAll();

  // Compute module addressing from ShowPlan
  const moduleMap = new window.Map<number, { channels: Set<number>; cueCount: number }>();
  for (const cue of sp.pyroCues) {
    if (!moduleMap.has(cue.module)) moduleMap.set(cue.module, { channels: new Set(), cueCount: 0 });
    const m = moduleMap.get(cue.module)!;
    m.channels.add(cue.channel);
    m.cueCount++;
  }

  // DMX universe usage from ShowPlan cues
  const universeUsage = new window.Map<number, number>();
  for (const cue of sp.dmxCues) {
    universeUsage.set(cue.universe, (universeUsage.get(cue.universe) || 0) + 1);
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-background/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapIcon className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">Addressing & Protocols</span>
        </div>
        <Button size="sm" variant="outline" onClick={refresh} className="h-6 text-[9px] font-mono gap-1">
          <RefreshCw className="w-3 h-3" /> REFRESH
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Pyro Modules */}
        <div className="border border-border/10 rounded p-3 space-y-1">
          <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest flex items-center gap-1">
            <Cpu className="w-3 h-3 text-cyan-400" /> PYRO MODULES
          </span>
          <div className="text-[9px] font-mono space-y-0.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Modules</span><span className="text-foreground/70">{moduleMap.size}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total Cues</span><span className="text-foreground/70">{sp.pyroCues.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">HW Config</span><span className="text-foreground/70">{sp.hardwareConfig.modules.length} modules</span></div>
          </div>
        </div>

        {/* DMX Universes */}
        <div className="border border-border/10 rounded p-3 space-y-1">
          <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest flex items-center gap-1">
            <Radio className="w-3 h-3 text-blue-400" /> DMX UNIVERSES
          </span>
          <div className="text-[9px] font-mono space-y-0.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Active</span><span className="text-foreground/70">{universes.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Used by Cues</span><span className="text-foreground/70">{universeUsage.size}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">DMX Cues</span><span className="text-foreground/70">{sp.dmxCues.length}</span></div>
          </div>
        </div>

        {/* Fixtures */}
        <div className="border border-border/10 rounded p-3 space-y-1">
          <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest flex items-center gap-1">
            <Map className="w-3 h-3 text-violet-400" /> FIXTURES
          </span>
          <div className="text-[9px] font-mono space-y-0.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Patched</span><span className="text-foreground/70">{fixtures.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Drone Paths</span><span className="text-foreground/70">{sp.dronePaths.length}</span></div>
          </div>
        </div>
      </div>

      {/* Module address table */}
      <div className="flex-1 overflow-hidden flex flex-col gap-2">
        <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest">MODULE ADDRESS MAP</span>
        <ScrollArea className="flex-1 border border-border/10 rounded p-2">
          {moduleMap.size === 0 ? (
            <p className="text-[9px] font-mono text-muted-foreground/40">No pyro modules in ShowPlan</p>
          ) : (
            <div className="space-y-1">
              {Array.from(moduleMap.entries()).sort((a, b) => a[0] - b[0]).map(([mod, data]) => {
                const hwMod = sp.hardwareConfig.modules.find(m => m.address === mod);
                return (
                  <div key={mod} className="flex items-center gap-3 text-[9px] font-mono">
                    <span className="text-cyan-400/70 w-12">M{mod}</span>
                    <span className="text-muted-foreground/50 w-20">{hwMod?.label ?? 'unassigned'}</span>
                    <span className="text-foreground/70 w-16">{data.channels.size}/32 ch</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', data.channels.size > 32 ? 'bg-red-400/60' : 'bg-cyan-400/40')}
                        style={{ width: `${Math.min(100, (data.channels.size / 32) * 100)}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground/40 w-12 text-right">{data.cueCount} cues</span>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Universe usage */}
        <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest">DMX UNIVERSE USAGE</span>
        <ScrollArea className="flex-1 border border-border/10 rounded p-2">
          {universeUsage.size === 0 && universes.length === 0 ? (
            <p className="text-[9px] font-mono text-muted-foreground/40">No DMX universes active</p>
          ) : (
            <div className="space-y-1">
              {universes.map(u => {
                const buf = dmxUniverseManager.getBuffer(u.id);
                const active = buf ? Array.from(buf).filter(v => v > 0).length : 0;
                const cueCount = universeUsage.get(u.id) ?? 0;
                return (
                  <div key={u.id} className="flex items-center gap-3 text-[9px] font-mono">
                    <span className="text-blue-400/70 w-12">U{u.id}</span>
                    <span className="text-muted-foreground/50 w-20">{u.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                      <div className="h-full bg-blue-400/40 rounded-full" style={{ width: `${(active / 512) * 100}%` }} />
                    </div>
                    <span className="text-muted-foreground/40 w-16 text-right">{active}/512</span>
                    <span className="text-muted-foreground/40 w-12 text-right">{cueCount} cues</span>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
