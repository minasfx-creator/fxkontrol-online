/**
 * ExecutionStatusConsole — Real-time execution bridge stats, cue queue, executor states.
 * Consumes ShowPlan + ExecutionBridge + PyroExecutor + DroneExecutor.
 */
import { useState, useCallback, useEffect } from 'react';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { executionBridge } from '@/core/execution/ExecutionBridge';
import { pyroExecutor } from '@/core/execution/PyroExecutor';
import { droneExecutor } from '@/core/execution/DroneExecutor';
import { safetyStateMachine } from '@/core/safety/SafetyStateMachine';
import { useVerificationStore } from '@/core/verification/useVerificationStore';
import { cn } from '@/lib/utils';
import { Activity, Zap, Layers, Shield, RefreshCw, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ExecutionStatusConsole() {
  const [, setTick] = useState(0);
  const level = useVerificationStore(s => s.level);

  // Auto-refresh at 2Hz
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(iv);
  }, []);

  const sp = showPlanManager.current;
  const bridgeStats = executionBridge.getStats();
  const pyroStats = pyroExecutor.getStats();
  const droneStats = droneExecutor.getStats();
  const safetyState = safetyStateMachine.getState();

  const safetyColor = safetyState === 'ARMED' || safetyState === 'FIRING'
    ? 'text-red-400' : safetyState === 'LOCKED'
    ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-background/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">Execution Status</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border', safetyColor,
            safetyState === 'ARMED' ? 'bg-red-500/15 border-red-500/30' :
            safetyState === 'FIRING' ? 'bg-red-500/15 border-red-500/30 animate-pulse' :
            safetyState === 'LOCKED' ? 'bg-amber-500/15 border-amber-500/30' :
            'bg-emerald-500/15 border-emerald-500/30'
          )}>
            {safetyState}
          </span>
          <span className={cn('text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border',
            level === 'BLOCKED' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
            level === 'READY_FOR_FIELD' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
            'bg-amber-500/15 text-amber-400 border-amber-500/30'
          )}>
            {level.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Bridge stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-border/10 rounded p-3 space-y-1">
          <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest flex items-center gap-1">
            <Activity className="w-3 h-3 text-emerald-400" /> BRIDGE
          </span>
          <div className="text-[9px] font-mono space-y-0.5">
            <div className="flex justify-between"><span className="text-muted-foreground">State</span><span className="text-foreground/70">{bridgeStats.state}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Commands TX</span><span className="text-foreground/70">{bridgeStats.commandsSent}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Uptime</span><span className="text-foreground/70">{bridgeStats.uptime}s</span></div>
          </div>
        </div>

        <div className="border border-border/10 rounded p-3 space-y-1">
          <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest flex items-center gap-1">
            <Zap className="w-3 h-3 text-red-400" /> PYRO EXECUTOR
          </span>
          <div className="text-[9px] font-mono space-y-0.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Fired</span><span className="text-foreground/70">{pyroStats.fired}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Queued</span><span className="text-foreground/70">{pyroStats.queued}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Errors</span><span className={cn("text-foreground/70", pyroStats.errors > 0 && "text-red-400")}>{pyroStats.errors}</span></div>
          </div>
        </div>

        <div className="border border-border/10 rounded p-3 space-y-1">
          <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest flex items-center gap-1">
            <Layers className="w-3 h-3 text-teal-400" /> DRONE EXECUTOR
          </span>
          <div className="text-[9px] font-mono space-y-0.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Active</span><span className="text-foreground/70">{droneStats.active}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Landed</span><span className="text-foreground/70">{droneStats.landed}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Aborted</span><span className={cn("text-foreground/70", droneStats.aborted > 0 && "text-red-400")}>{droneStats.aborted}</span></div>
          </div>
        </div>
      </div>

      {/* ShowPlan execution summary */}
      <div className="border border-border/10 rounded p-3">
        <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest">SHOW SUMMARY</span>
        <div className="grid grid-cols-4 gap-4 mt-2 text-[9px] font-mono">
          <div>
            <span className="text-muted-foreground/50">Duration</span>
            <div className="text-foreground font-bold">{sp.metadata.duration.toFixed(1)}s</div>
          </div>
          <div>
            <span className="text-muted-foreground/50">Pyro Cues</span>
            <div className="text-red-400 font-bold">{sp.pyroCues.length}</div>
          </div>
          <div>
            <span className="text-muted-foreground/50">DMX Cues</span>
            <div className="text-blue-400 font-bold">{sp.dmxCues.length}</div>
          </div>
          <div>
            <span className="text-muted-foreground/50">Drone Paths</span>
            <div className="text-teal-400 font-bold">{sp.dronePaths.length}</div>
          </div>
        </div>
      </div>

      {/* Cue queue (next 10 cues by time) */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest mb-1">CUE QUEUE (NEXT 10)</span>
        <ScrollArea className="flex-1 border border-border/10 rounded p-2">
          {sp.pyroCues.length === 0 ? (
            <p className="text-[9px] font-mono text-muted-foreground/40">No cues in ShowPlan</p>
          ) : (
            <div className="space-y-0.5">
              {[...sp.pyroCues].sort((a, b) => a.time - b.time).slice(0, 10).map(cue => (
                <div key={cue.id} className="flex items-center gap-3 text-[9px] font-mono">
                  <span className="text-red-400/70 w-16">T{cue.time.toFixed(2)}s</span>
                  <span className="text-foreground/70 w-16">M{cue.module}:CH{cue.channel}</span>
                  <span className="text-muted-foreground/50 flex-1">{cue.effectId}</span>
                  <span className="text-muted-foreground/40">{cue.caliber}mm</span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
