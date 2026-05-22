/**
 * SystemOverviewConsole — Binary dashboard: ShowPlan, Verification, Safety, Hardware
 * Uses centralized VerificationEngine.
 */
import { useEffect } from 'react';
import { useVerificationStore } from '@/core/verification/useVerificationStore';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { safetyStateMachine } from '@/core/safety/SafetyStateMachine';
import { powerMonitor } from '@/core/hardware/PowerMonitor';
import { cn } from '@/lib/utils';
import { Shield, Cpu, Zap, Activity, CheckCircle2, XOctagon, AlertTriangle } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

function StatusBlock({ label, icon: Icon, status, detail }: {
  label: string; icon: React.ElementType; status: 'ok' | 'warn' | 'error' | 'idle'; detail: string;
}) {
  const styles = {
    ok: 'border-emerald-500/30 bg-emerald-500/5', warn: 'border-amber-500/30 bg-amber-500/5',
    error: 'border-red-500/30 bg-red-500/5', idle: 'border-border/20 bg-muted/10',
  };
  const iconColor = { ok: 'text-emerald-400', warn: 'text-amber-400', error: 'text-red-400', idle: 'text-muted-foreground/40' };
  return (
    <div className={cn('rounded border p-4 flex flex-col gap-2 transition-all', styles[status])}>
      <div className="flex items-center gap-2">
        <Icon className={cn('w-4 h-4', iconColor[status])} />
        <span className="text-[10px] font-mono font-bold tracking-widest text-foreground uppercase">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {status === 'ok' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
        {status === 'warn' && <AlertTriangle className="w-3 h-3 text-amber-400" />}
        {status === 'error' && <XOctagon className="w-3 h-3 text-red-400" />}
        <span className={cn('text-xs font-mono', iconColor[status])}>{detail}</span>
      </div>
    </div>
  );
}

export default function SystemOverviewConsole() {
  const { level, result, runVerification } = useVerificationStore(useShallow((s) => ({ level: s.level, result: s.result, runVerification: s.runVerification })));
  const sp = showPlanManager.current;
  const safetyState = safetyStateMachine.state;
  const power = powerMonitor.getStatus();

  useEffect(() => { runVerification(); }, [runVerification]);

  const totalCues = sp.pyroCues.length + sp.dmxCues.length;
  const hasCues = totalCues > 0;
  const hwModules = sp.hardwareConfig.modules.length;

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-background/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">System Overview</span>
        </div>
        <span className={cn(
          'text-[9px] font-mono font-bold px-2 py-0.5 rounded border',
          level === 'READY_FOR_FIELD' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
          level === 'BLOCKED' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
          'bg-amber-500/15 text-amber-400 border-amber-500/30'
        )}>
          {level.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1">
        <StatusBlock label="ShowPlan" icon={Activity}
          status={hasCues ? 'ok' : 'idle'}
          detail={hasCues ? `${sp.pyroCues.length} pyro + ${sp.dmxCues.length} DMX + ${sp.dronePaths.length} drone` : 'No cues loaded'} />
        <StatusBlock label="Verification" icon={Shield}
          status={level === 'READY_FOR_FIELD' ? 'ok' : level === 'BLOCKED' ? 'error' : 'warn'}
          detail={`${result?.summary.passed ?? 0}/${result?.summary.total ?? 0} checks passed`} />
        <StatusBlock label="Safety" icon={Zap}
          status={safetyState === 'SAFE' ? 'error' : safetyState === 'ARMED' || safetyState === 'FIRING' ? 'warn' : 'ok'}
          detail={`State: ${safetyState}`} />
        <StatusBlock label="Hardware" icon={Cpu}
          status={hwModules > 0 ? 'ok' : 'idle'}
          detail={hwModules > 0 ? `${hwModules} module(s) | ${power.voltage.toFixed(1)}V` : 'No modules connected'} />
      </div>

      {result && (
        <div className="border border-border/10 rounded p-3 space-y-1">
          <span className="text-[9px] font-mono font-bold text-muted-foreground tracking-widest">VERIFICATION CHECKS</span>
          {result.issues.map(i => (
            <div key={i.id} className="flex items-center gap-2 text-[9px] font-mono">
              <span className={i.passed ? 'text-emerald-400' : i.severity === 'error' ? 'text-red-400' : 'text-amber-400'}>
                {i.passed ? '●' : '○'}
              </span>
              <span className="text-muted-foreground flex-1">{i.label}</span>
              <span className="text-muted-foreground/30 text-[7px] uppercase">{i.category}</span>
              <span className="text-muted-foreground/50">{i.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
