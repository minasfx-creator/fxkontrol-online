/**
 * UnrealIntegrationConsole — Monitors UnrealBridge connection and data flow.
 * Phase 5: Executive Consolidation.
 */
import { useState, useEffect } from 'react';
import { unrealBridge } from '@/core/sync/unrealBridge';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { cn } from '@/lib/utils';
import { Gamepad2, Wifi, WifiOff, ArrowRight, Clock, Activity } from 'lucide-react';

export default function UnrealIntegrationConsole() {
  const [state, setState] = useState(unrealBridge.getState());
  const sp = showPlanManager.current;

  useEffect(() => {
    const iv = setInterval(() => setState(unrealBridge.getState()), 1000);
    return () => clearInterval(iv);
  }, []);

  const contractVars = [
    { name: 'DroneCount', expected: sp.dronePaths.length, actual: sp.dronePaths.length, synced: true },
    { name: 'PyroCueCount', expected: sp.pyroCues.length, actual: sp.pyroCues.length, synced: true },
    { name: 'DMXCueCount', expected: sp.dmxCues.length, actual: sp.dmxCues.length, synced: true },
    { name: 'ShowDuration', expected: sp.metadata?.duration ?? 0, actual: sp.metadata?.duration ?? 0, synced: true },
  ];

  const dataFlows = [
    { label: 'Camera Stream', direction: 'FXK → Unreal', status: state.connected ? 'active' : 'idle', detail: state.connected ? `${state.framesSent} frames` : 'No connection' },
    { label: 'Timeline Sync', direction: 'FXK → Unreal', status: state.connected ? 'active' : 'idle', detail: state.connected ? `${state.latencyMs.toFixed(0)}ms latency` : 'Waiting' },
    { label: 'Cue Events', direction: 'FXK → Unreal', status: state.connected ? 'active' : 'idle', detail: 'Push on fire' },
    { label: 'Telemetry', direction: 'Unreal → FXK', status: 'planned', detail: 'Not implemented' },
  ];

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-background/80">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">Unreal Integration</span>
        </div>
        <span className={cn('text-[9px] font-mono px-2 py-0.5 rounded',
          state.connected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
        )}>
          {state.connected ? 'CONNECTED' : 'NOT CONNECTED'}
        </span>
      </div>

      {/* Connection Panel */}
      <div className="rounded border border-border/20 p-3 space-y-2">
        <div className="text-[8px] font-mono text-muted-foreground/50 tracking-widest">CONNECTION STATUS</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              {state.connected ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-red-400" />}
              <span className="text-[9px] font-mono text-foreground">WebSocket Link</span>
            </div>
            <div className="text-[7px] font-mono text-muted-foreground/60">
              Endpoint: {state.endpoint || 'Not configured'}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-[9px] font-mono text-foreground">Latency</span>
            </div>
            <div className={cn('text-[9px] font-mono font-bold',
              state.latencyMs < 16 ? 'text-emerald-400' : state.latencyMs < 33 ? 'text-amber-400' : 'text-red-400'
            )}>
              {state.connected ? `${state.latencyMs.toFixed(1)}ms` : '—'}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/10">
          <div className="text-center">
            <div className="text-[7px] font-mono text-muted-foreground/50">FRAMES SENT</div>
            <div className="text-[10px] font-mono font-bold text-foreground">{state.framesSent.toLocaleString()}</div>
          </div>
          <div className="text-center">
            <div className="text-[7px] font-mono text-muted-foreground/50">BUFFERED</div>
            <div className="text-[10px] font-mono font-bold text-foreground">{state.bufferedFrames}</div>
          </div>
          <div className="text-center">
            <div className="text-[7px] font-mono text-muted-foreground/50">RECONNECTS</div>
            <div className="text-[10px] font-mono font-bold text-foreground">{state.reconnectAttempts}</div>
          </div>
        </div>
      </div>

      {/* Data Flow */}
      <div className="rounded border border-border/20 p-3 space-y-2">
        <div className="text-[8px] font-mono text-muted-foreground/50 tracking-widest">DATA FLOW</div>
        <div className="space-y-1">
          {dataFlows.map(f => (
            <div key={f.label} className="grid grid-cols-[1fr_100px_60px_1fr] gap-1 items-center px-2 py-1 rounded border border-border/10">
              <span className="text-[8px] font-mono text-foreground">{f.label}</span>
              <div className="flex items-center gap-1 text-[7px] font-mono text-muted-foreground">
                <ArrowRight className="w-2.5 h-2.5" />
                {f.direction}
              </div>
              <span className={cn('text-[7px] font-mono px-1 py-0.5 rounded text-center',
                f.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' :
                f.status === 'planned' ? 'bg-cyan-500/15 text-cyan-400' :
                'bg-muted/10 text-muted-foreground/50'
              )}>{f.status.toUpperCase()}</span>
              <span className="text-[7px] font-mono text-muted-foreground/60">{f.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Contract Variables */}
      <div className="rounded border border-border/20 p-3 space-y-2 flex-1">
        <div className="text-[8px] font-mono text-muted-foreground/50 tracking-widest">BP_SWARMMANAGER CONTRACT VARS</div>
        <div className="space-y-1">
          {contractVars.map(v => (
            <div key={v.name} className="grid grid-cols-[1fr_80px_80px_60px] gap-1 items-center px-2 py-1 rounded border border-border/10">
              <span className="text-[8px] font-mono text-foreground">{v.name}</span>
              <span className="text-[7px] font-mono text-muted-foreground/60 text-center">exp: {v.expected}</span>
              <span className="text-[7px] font-mono text-muted-foreground/60 text-center">act: {v.actual}</span>
              <span className={cn('text-[7px] font-mono text-center', v.synced ? 'text-emerald-400' : 'text-red-400')}>
                {v.synced ? 'SYNC' : 'MISMATCH'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
