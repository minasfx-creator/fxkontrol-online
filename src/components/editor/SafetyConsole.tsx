/**
 * SafetyConsole — Real-time safety state machine monitor + interlock status.
 */
import { useState, useEffect, useCallback } from 'react';
import { safetyStateMachine, type SafetyState } from '@/core/safety/SafetyStateMachine';
import { safetyAuditTrail, type AuditEntry } from '@/core/safety/SafetyAuditTrail';
import { cn } from '@/lib/utils';
import { Shield, Lock, Unlock, AlertOctagon, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STATE_STYLES: Record<SafetyState, { bg: string; text: string; glow: string }> = {
  IDLE:     { bg: 'bg-muted/20', text: 'text-muted-foreground', glow: '' },
  LOCKED:   { bg: 'bg-amber-500/10', text: 'text-amber-400', glow: '' },
  ARMED:    { bg: 'bg-red-500/15', text: 'text-red-400', glow: 'shadow-[0_0_20px_hsl(0_85%_48%/0.15)]' },
  FIRING:   { bg: 'bg-red-500/25', text: 'text-red-300', glow: 'shadow-[0_0_30px_hsl(0_85%_48%/0.3)]' },
  COOLDOWN: { bg: 'bg-amber-500/15', text: 'text-amber-400', glow: '' },
  SAFE:     { bg: 'bg-emerald-500/10', text: 'text-emerald-400', glow: '' },
};

const STATES_ORDER: SafetyState[] = ['IDLE', 'LOCKED', 'ARMED', 'FIRING', 'COOLDOWN', 'SAFE'];

export default function SafetyConsole() {
  const [state, setState] = useState<SafetyState>(safetyStateMachine.state);
  const [entries, setEntries] = useState<readonly AuditEntry[]>(safetyAuditTrail.getAll());
  const conditions = safetyStateMachine.getConditions();

  useEffect(() => {
    const unsub = safetyStateMachine.onTransition((result) => {
      setState(result.to as SafetyState);
      setEntries([...safetyAuditTrail.getAll()]);
    });
    return unsub;
  }, []);

  const handleTransition = useCallback((t: string) => {
    safetyStateMachine.transition(t as any);
    setState(safetyStateMachine.state);
    setEntries([...safetyAuditTrail.getAll()]);
  }, []);

  const style = STATE_STYLES[state];

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-background/80">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-red-400" />
        <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">Safety Console</span>
      </div>

      {/* State chain visualization */}
      <div className="flex items-center gap-1">
        {STATES_ORDER.map(s => (
          <div key={s} className={cn(
            'flex-1 text-center py-2 rounded border text-[8px] font-mono font-bold tracking-wider transition-all',
            s === state
              ? `${STATE_STYLES[s].bg} ${STATE_STYLES[s].text} border-current/30 ${STATE_STYLES[s].glow}`
              : 'bg-muted/5 border-border/10 text-muted-foreground/20'
          )}>
            {s}
          </div>
        ))}
      </div>

      {/* Interlock conditions */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'LINK', ok: conditions.linkStable },
          { label: 'VALIDATION', ok: conditions.validationPassed },
          { label: 'CONTINUITY', ok: conditions.continuityOk },
          { label: 'DRY RUN', ok: conditions.isDryRun },
        ].map(c => (
          <div key={c.label} className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded border text-[9px] font-mono',
            c.ok ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400' : 'border-red-500/20 bg-red-500/5 text-red-400'
          )}>
            <span>{c.ok ? '●' : '○'}</span>
            <span className="font-bold tracking-widest">{c.label}</span>
            <span className="ml-auto text-[8px]">{c.ok ? 'PASS' : 'FAIL'}</span>
          </div>
        ))}
      </div>

      {/* Control buttons */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => handleTransition('LOCK_STATE')} className="text-[9px] font-mono gap-1 h-7">
          <Lock className="w-3 h-3" /> LOCK
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleTransition('ARM_SYSTEM')} className="text-[9px] font-mono gap-1 h-7 text-red-400 border-red-500/20">
          <AlertOctagon className="w-3 h-3" /> ARM
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleTransition('DISARM_SYSTEM')} className="text-[9px] font-mono gap-1 h-7">
          <Unlock className="w-3 h-3" /> DISARM
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleTransition('E_STOP')} className="text-[9px] font-mono gap-1 h-7 text-destructive border-destructive/30">
          <AlertOctagon className="w-3 h-3" /> E-STOP
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleTransition('RESET_SAFETY')} className="text-[9px] font-mono gap-1 h-7">
          <RotateCcw className="w-3 h-3" /> RESET
        </Button>
      </div>

      {/* Recent audit entries */}
      <div className="flex-1 overflow-auto border border-border/10 rounded p-2 space-y-0.5">
        <span className="text-[8px] font-mono text-muted-foreground/50 tracking-widest">AUDIT LOG (LAST 20)</span>
        {entries.slice(-20).reverse().map((e, i) => (
          <div key={i} className="flex items-center gap-2 text-[8px] font-mono text-muted-foreground">
            <span className="text-muted-foreground/30">{new Date(e.timestamp).toLocaleTimeString()}</span>
            <span className={cn(
              'font-bold',
              e.event === 'E_STOP' || e.event === 'VIOLATION' ? 'text-red-400' :
              e.event === 'ARM' || e.event === 'FIRE' ? 'text-amber-400' : 'text-muted-foreground/60'
            )}>{e.event}</span>
            <span className="text-muted-foreground/40 truncate flex-1">{e.detail}</span>
          </div>
        ))}
        {entries.length === 0 && <span className="text-[9px] text-muted-foreground/30">No audit events recorded</span>}
      </div>
    </div>
  );
}
