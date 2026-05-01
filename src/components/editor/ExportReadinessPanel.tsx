/**
 * ExportReadinessPanel — Unified export view gated through ExportCoordinator.
 * Shows status for each exporter with OperationalMode badge and issue details.
 */
import { useState, useEffect } from 'react';
import { useVerificationStore } from '@/core/verification/useVerificationStore';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { exportCoordinator, type ExportTarget } from '@/core/export/ExportCoordinator';
import { operationalModeGuard } from '@/core/hardware/OperationalModeGuard';
import { isSimulating } from '@/core/safety/simulationGuard';
import { workMode } from '@/core/safety/workMode';
import { cn } from '@/lib/utils';
import {
  FileOutput, Download, CheckCircle2, XOctagon, AlertTriangle, RefreshCw,
  Flame, Radio, Layers, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { VerificationIssue } from '@/core/verification/types';
import { useShallow } from 'zustand/react/shallow';

function IssueRow({ issue }: { issue: VerificationIssue }) {
  const color = issue.passed ? 'text-emerald-400' : issue.severity === 'error' ? 'text-red-400' : issue.severity === 'warning' ? 'text-amber-400' : 'text-blue-400';
  const Icon = issue.passed ? CheckCircle2 : issue.severity === 'error' ? XOctagon : AlertTriangle;
  return (
    <div className="flex items-start gap-1.5 py-0.5">
      <Icon className={cn('w-3 h-3 shrink-0 mt-0.5', color)} />
      <div className="min-w-0 flex-1">
        <span className={cn('text-[9px] font-mono', color)}>{issue.label}</span>
        <p className="text-[8px] font-mono text-muted-foreground/50">{issue.detail}</p>
      </div>
      <span className="text-[7px] font-mono text-muted-foreground/30 uppercase shrink-0">{issue.category}</span>
    </div>
  );
}

interface ExportChannelProps {
  label: string;
  icon: React.ElementType;
  color: string;
  count: number;
  countLabel: string;
  canExport: boolean;
  target: ExportTarget;
}

function ExportChannel({ label, icon: Icon, color, count, countLabel, canExport, target }: ExportChannelProps) {
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleExport = () => {
    const result = exportCoordinator.execute(target);
    setLastResult(result.success ? '✓ Exported' : `✗ ${result.issues[0] ?? 'Failed'}`);
    setTimeout(() => setLastResult(null), 4000);
  };

  return (
    <div className={cn('border rounded p-3 space-y-2', canExport ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-border/10 bg-muted/5')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('w-4 h-4', color)} />
          <span className="text-[10px] font-mono font-bold tracking-widest text-foreground uppercase">{label}</span>
        </div>
        <span className={cn('text-[8px] font-mono font-bold px-1.5 py-0.5 rounded',
          canExport ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
        )}>
          {canExport ? 'READY' : 'BLOCKED'}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono text-muted-foreground">{count} {countLabel}</span>
        <Button size="sm" onClick={handleExport} disabled={!canExport || count === 0}
          className="h-5 text-[8px] font-mono gap-1 px-2 disabled:opacity-30">
          <Download className="w-2.5 h-2.5" /> EXPORT
        </Button>
      </div>
      {lastResult && (
        <div className={cn('text-[8px] font-mono', lastResult.startsWith('✓') ? 'text-emerald-400' : 'text-red-400')}>
          {lastResult}
        </div>
      )}
    </div>
  );
}

export default function ExportReadinessPanel() {
  const { level, result, runVerification } = useVerificationStore(useShallow((s) => ({ level: s.level, result: s.result, runVerification: s.runVerification })));
  const sp = showPlanManager.current;
  const canExport = level === 'READY_FOR_EXPORT' || level === 'READY_FOR_FIELD';
  const mode = operationalModeGuard.mode;

  useEffect(() => { runVerification(); }, [runVerification]);

  const failedIssues = result?.issues.filter(i => !i.passed) ?? [];

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-background/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileOutput className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">Export Readiness</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase">
            {mode}
          </span>
          <span className={cn(
            'text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border',
            level === 'READY_FOR_FIELD' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
            level === 'BLOCKED' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
            'bg-amber-500/15 text-amber-400 border-amber-500/30'
          )}>
            {level.replace(/_/g, ' ')}
          </span>
          <Button size="sm" variant="outline" onClick={runVerification} className="h-6 text-[9px] font-mono gap-1">
            <RefreshCw className="w-3 h-3" /> VERIFY
          </Button>
        </div>
      </div>

      {/* Summary counters */}
      <div className="flex items-center gap-4 text-[9px] font-mono text-muted-foreground">
        <span>Pyro: <span className="text-foreground">{sp.pyroCues.length}</span></span>
        <span>DMX: <span className="text-foreground">{sp.dmxCues.length}</span></span>
        <span>Drones: <span className="text-foreground">{sp.dronePaths.length}</span></span>
        {result && (
          <>
            <span className="text-emerald-400">{result.summary.passed}✓</span>
            {result.summary.errors > 0 && <span className="text-red-400">{result.summary.errors}✗</span>}
            {result.summary.warnings > 0 && <span className="text-amber-400">{result.summary.warnings}⚠</span>}
          </>
        )}
      </div>

      {/* Export channels — now routed through ExportCoordinator */}
      <div className="grid grid-cols-3 gap-3">
        <ExportChannel label="FireOne .FIR" icon={Flame} color="text-red-400"
          count={sp.pyroCues.length} countLabel="pyro cues"
          canExport={canExport} target="fireone" />
        <ExportChannel label="Art-Net CSV" icon={Radio} color="text-blue-400"
          count={sp.dmxCues.length} countLabel="DMX cues"
          canExport={canExport} target="artnet" />
        <ExportChannel label="Drone CSV" icon={Layers} color="text-teal-400"
          count={sp.dronePaths.length} countLabel="drone paths"
          canExport={canExport} target="drone" />
      </div>

      {/* Blocking issues */}
      {failedIssues.length > 0 && (
        <div className="border border-border/10 rounded p-3 space-y-1 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-3 h-3 text-muted-foreground/60" />
            <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest">
              {failedIssues.length} ISSUE(S) DETECTED
            </span>
          </div>
          <ScrollArea className="max-h-60">
            {failedIssues.map(i => <IssueRow key={i.id} issue={i} />)}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
