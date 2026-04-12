/**
 * CurrentStateMatrix — Visual matrix showing system readiness across all subsystems.
 * Four columns: Exists | Partial | Placeholder | Absent
 */
import { useMemo } from 'react';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { useVerificationEngine } from '@/core/verification/useVerificationEngine';
import { safetyStateMachine } from '@/core/safety/SafetyStateMachine';
import { continuityCheckService } from '@/core/safety/ContinuityCheckService';
import { cn } from '@/lib/utils';
import {
  Activity, CheckCircle2, AlertTriangle, MinusCircle, XCircle,
} from 'lucide-react';

type MatrixStatus = 'exists' | 'partial' | 'placeholder' | 'absent';

interface MatrixRow {
  label: string;
  status: MatrixStatus;
  detail: string;
}

const STATUS_CONFIG: Record<MatrixStatus, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  exists:      { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/15', label: 'EXISTS' },
  partial:     { icon: AlertTriangle, color: 'text-amber-400',   bg: 'bg-amber-500/15',   label: 'PARTIAL' },
  placeholder: { icon: MinusCircle,   color: 'text-cyan-400',    bg: 'bg-cyan-500/15',     label: 'PLACEHOLDER' },
  absent:      { icon: XCircle,       color: 'text-red-400',     bg: 'bg-red-500/15',      label: 'ABSENT' },
};

export default function CurrentStateMatrix() {
  const sp = showPlanManager.current;
  const { level } = useVerificationEngine();
  const safetyState = safetyStateMachine.state;
  const continuityReport = continuityCheckService.getReport();

  const rows = useMemo((): MatrixRow[] => {
    const hasContent = sp.pyroCues.length > 0 || sp.dmxCues.length > 0 || sp.dronePaths.length > 0;
    const hasHw = sp.hardwareConfig.modules.length > 0;
    const hasContinuity = continuityReport.ok > 0 || continuityReport.open > 0;

    return [
      {
        label: 'ShowPlan',
        status: hasContent ? 'exists' : 'absent',
        detail: hasContent ? `${sp.pyroCues.length}P + ${sp.dmxCues.length}D + ${sp.dronePaths.length}Dr` : 'No content loaded',
      },
      {
        label: 'DMX / Art-Net Export',
        status: sp.dmxCues.length > 0 ? 'exists' : 'absent',
        detail: sp.dmxCues.length > 0 ? `${sp.dmxCues.length} cues ready` : 'No DMX cues',
      },
      {
        label: 'FireOne Export',
        status: sp.pyroCues.length > 0 ? 'exists' : 'absent',
        detail: sp.pyroCues.length > 0 ? `${sp.pyroCues.length} pyro cues ready` : 'No pyro cues',
      },
      {
        label: 'VerificationPass',
        status: level !== 'BLOCKED' ? 'exists' : hasContent ? 'partial' : 'absent',
        detail: level.replace(/_/g, ' '),
      },
      {
        label: 'SafetyStateMachine',
        status: 'exists',
        detail: `State: ${safetyState}`,
      },
      {
        label: 'ContinuityCheck',
        status: hasContinuity ? 'exists' : 'placeholder',
        detail: hasContinuity ? `OK:${continuityReport.ok} Open:${continuityReport.open}` : 'Awaiting hardware connection',
      },
      {
        label: 'Hardware Diagnostics',
        status: hasHw ? 'exists' : 'placeholder',
        detail: hasHw ? `${sp.hardwareConfig.modules.length} module(s)` : 'No hardware connected',
      },
      {
        label: 'AuditTrail',
        status: 'exists',
        detail: 'SafetyAuditTrail + BlackBox active',
      },
      {
        label: 'BP_SwarmManager Contract',
        status: sp.dronePaths.length > 0 ? 'partial' : 'placeholder',
        detail: sp.dronePaths.length > 0 ? `${sp.dronePaths.length} paths defined` : 'Awaiting Unreal handshake',
      },
      {
        label: 'Unreal Integration',
        status: 'placeholder',
        detail: 'Contract defined, runtime pending',
      },
    ];
  }, [sp, level, safetyState, continuityReport]);

  const statusCounts = useMemo(() => {
    const counts = { exists: 0, partial: 0, placeholder: 0, absent: 0 };
    rows.forEach(r => counts[r.status]++);
    return counts;
  }, [rows]);

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-background/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">Current State Matrix</span>
        </div>
        <div className="flex items-center gap-2 text-[8px] font-mono">
          {(Object.entries(statusCounts) as [MatrixStatus, number][]).map(([status, count]) => {
            const cfg = STATUS_CONFIG[status];
            return (
              <span key={status} className={cn('px-1.5 py-0.5 rounded', cfg.bg, cfg.color)}>
                {count} {cfg.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Matrix header */}
      <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-1 text-[7px] font-mono text-muted-foreground/50 tracking-widest px-2">
        <span>SUBSYSTEM</span>
        <span className="text-center">EXISTS</span>
        <span className="text-center">PARTIAL</span>
        <span className="text-center">PLACEHOLDER</span>
        <span className="text-center">ABSENT</span>
      </div>

      {/* Matrix rows */}
      <div className="flex-1 space-y-1 overflow-y-auto">
        {rows.map(row => {
          const cfg = STATUS_CONFIG[row.status];
          return (
            <div key={row.label}
              className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-1 items-center rounded border border-border/10 px-2 py-2 hover:bg-muted/5 transition-colors">
              <div>
                <div className="text-[10px] font-mono font-medium text-foreground">{row.label}</div>
                <div className="text-[8px] font-mono text-muted-foreground/50">{row.detail}</div>
              </div>
              {(['exists', 'partial', 'placeholder', 'absent'] as MatrixStatus[]).map(col => {
                const isActive = row.status === col;
                const colCfg = STATUS_CONFIG[col];
                return (
                  <div key={col} className="flex justify-center">
                    {isActive ? (
                      <cfg.icon className={cn('w-4 h-4', cfg.color)} />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-border/10" />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
