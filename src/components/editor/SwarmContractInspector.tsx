/**
 * SwarmContractInspector — Validates BP_SwarmManager contract against ShowPlan.
 * Phase 5: Executive Consolidation.
 */
import { useMemo } from 'react';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { cn } from '@/lib/utils';
import { FileCode2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

type BindingStatus = 'bound' | 'unbound' | 'partial';

interface ContractVariable {
  name: string;
  type: string;
  required: boolean;
  description: string;
  hasValue: boolean;
}

interface ContractFunction {
  name: string;
  signature: string;
  status: 'implemented' | 'stub' | 'not_implemented';
  description: string;
}

interface ContractEvent {
  name: string;
  status: BindingStatus;
  description: string;
}

const BIND_CFG: Record<BindingStatus, { color: string; bg: string; label: string }> = {
  bound:   { color: 'text-emerald-400', bg: 'bg-emerald-500/15', label: 'BOUND' },
  partial: { color: 'text-amber-400',   bg: 'bg-amber-500/15',   label: 'PARTIAL' },
  unbound: { color: 'text-red-400',     bg: 'bg-red-500/15',     label: 'UNBOUND' },
};

const FUNC_CFG: Record<string, { color: string; bg: string; label: string }> = {
  implemented:     { color: 'text-emerald-400', bg: 'bg-emerald-500/15', label: 'IMPL' },
  stub:            { color: 'text-amber-400',   bg: 'bg-amber-500/15',   label: 'STUB' },
  not_implemented: { color: 'text-red-400',     bg: 'bg-red-500/15',     label: 'NONE' },
};

export default function SwarmContractInspector() {
  const sp = showPlanManager.current;
  const hasDrones = sp.dronePaths.length > 0;

  const variables = useMemo((): ContractVariable[] => [
    { name: 'DroneCount', type: 'int32', required: true, description: 'Total drones in swarm', hasValue: hasDrones },
    { name: 'Spacing', type: 'float', required: true, description: 'Inter-drone spacing (m)', hasValue: hasDrones },
    { name: 'Altitude', type: 'float', required: true, description: 'Base altitude (m AGL)', hasValue: hasDrones },
    { name: 'MoveDuration', type: 'float', required: true, description: 'Formation transition time (s)', hasValue: hasDrones },
    { name: 'BatchSize', type: 'int32', required: false, description: 'Spawn batch size', hasValue: false },
    { name: 'SpawnPattern', type: 'enum', required: true, description: 'Initial spawn formation', hasValue: false },
    { name: 'InitialPositions', type: 'FVector[]', required: true, description: 'Start positions array', hasValue: hasDrones },
    { name: 'TargetPositions', type: 'FVector[]', required: true, description: 'Target positions array', hasValue: hasDrones },
  ], [hasDrones]);

  const functions = useMemo((): ContractFunction[] => [
    { name: 'SpawnDrones', signature: '(count: int, pattern: SpawnPattern) → void', status: hasDrones ? 'stub' : 'not_implemented', description: 'Spawns drone actors in formation' },
    { name: 'ApplyFormation', signature: '(positions: FVector[], duration: float) → void', status: hasDrones ? 'stub' : 'not_implemented', description: 'Transitions to target formation' },
    { name: 'EmergencyLand', signature: '() → void', status: 'not_implemented', description: 'Emergency landing all drones' },
    { name: 'ClearDrones', signature: '() → void', status: 'not_implemented', description: 'Destroys all drone actors' },
    { name: 'ExportShowPackage', signature: '() → FShowPackage', status: 'not_implemented', description: 'Exports complete show data' },
  ], [hasDrones]);

  const events = useMemo((): ContractEvent[] => [
    { name: 'OnFormationApplied', status: 'unbound', description: 'Fired when formation transition completes' },
    { name: 'OnEmergencyAbort', status: 'unbound', description: 'Fired on emergency stop' },
    { name: 'OnContinuityFault', status: 'unbound', description: 'Fired when continuity check fails' },
    { name: 'OnFieldLinkLost', status: 'unbound', description: 'Fired when field communication drops' },
  ], []);

  const complianceScore = useMemo(() => {
    const varScore = variables.filter(v => v.hasValue).length / variables.length;
    const funcScore = functions.filter(f => f.status === 'implemented').length / functions.length;
    const eventScore = events.filter(e => e.status === 'bound').length / events.length;
    return Math.round(((varScore + funcScore + eventScore) / 3) * 100);
  }, [variables, functions, events]);

  return (
    <div className="flex flex-col h-full p-4 gap-3 bg-background/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">BP_SwarmManager Contract</span>
        </div>
        <span className={cn('text-[10px] font-mono font-bold px-2 py-0.5 rounded',
          complianceScore >= 80 ? 'bg-emerald-500/15 text-emerald-400' :
          complianceScore >= 40 ? 'bg-amber-500/15 text-amber-400' :
          'bg-red-500/15 text-red-400'
        )}>{complianceScore}% CONTRACT COMPLIANCE</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4">
          {/* Variables */}
          <div className="space-y-1">
            <div className="text-[8px] font-mono text-muted-foreground/50 tracking-widest px-2">REQUIRED VARIABLES ({variables.filter(v => v.hasValue).length}/{variables.length})</div>
            {variables.map(v => (
              <div key={v.name} className="grid grid-cols-[1fr_80px_60px_1fr] gap-1 items-center rounded border border-border/10 px-2 py-1.5 hover:bg-muted/5">
                <div>
                  <span className="text-[9px] font-mono font-medium text-foreground">{v.name}</span>
                  <span className="text-[7px] font-mono text-muted-foreground/40 ml-1">{v.type}</span>
                </div>
                <span className={cn('text-[7px] font-mono text-center', v.required ? 'text-red-400' : 'text-muted-foreground/40')}>
                  {v.required ? 'REQUIRED' : 'OPTIONAL'}
                </span>
                <div className="flex justify-center">
                  {v.hasValue
                    ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    : <XCircle className="w-3 h-3 text-red-400/60" />
                  }
                </div>
                <span className="text-[7px] font-mono text-muted-foreground/50">{v.description}</span>
              </div>
            ))}
          </div>

          {/* Functions */}
          <div className="space-y-1">
            <div className="text-[8px] font-mono text-muted-foreground/50 tracking-widest px-2">FUNCTIONS ({functions.filter(f => f.status === 'implemented').length}/{functions.length})</div>
            {functions.map(f => {
              const cfg = FUNC_CFG[f.status];
              return (
                <div key={f.name} className="grid grid-cols-[1fr_1fr_60px] gap-1 items-center rounded border border-border/10 px-2 py-1.5 hover:bg-muted/5">
                  <div>
                    <span className="text-[9px] font-mono font-medium text-foreground">{f.name}</span>
                    <div className="text-[6px] font-mono text-muted-foreground/40">{f.signature}</div>
                  </div>
                  <span className="text-[7px] font-mono text-muted-foreground/50">{f.description}</span>
                  <span className={cn('text-[7px] font-mono px-1.5 py-0.5 rounded text-center', cfg.bg, cfg.color)}>{cfg.label}</span>
                </div>
              );
            })}
          </div>

          {/* Events */}
          <div className="space-y-1">
            <div className="text-[8px] font-mono text-muted-foreground/50 tracking-widest px-2">EVENTS ({events.filter(e => e.status === 'bound').length}/{events.length})</div>
            {events.map(e => {
              const cfg = BIND_CFG[e.status];
              return (
                <div key={e.name} className="grid grid-cols-[1fr_1fr_60px] gap-1 items-center rounded border border-border/10 px-2 py-1.5 hover:bg-muted/5">
                  <span className="text-[9px] font-mono font-medium text-foreground">{e.name}</span>
                  <span className="text-[7px] font-mono text-muted-foreground/50">{e.description}</span>
                  <span className={cn('text-[7px] font-mono px-1.5 py-0.5 rounded text-center', cfg.bg, cfg.color)}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
