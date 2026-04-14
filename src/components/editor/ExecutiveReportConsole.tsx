/**
 * ExecutiveReportConsole — Auto-generates system status report.
 * Phase 5: Executive Consolidation.
 */
import { useMemo, useCallback, useState } from 'react';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { verificationEngine } from '@/core/verification/VerificationEngine';
import { readinessEvaluator } from '@/core/hardware/ReadinessEvaluator';
import { unifiedHardwareRegistry } from '@/core/hardware/UnifiedHardwareRegistry';
import { cn } from '@/lib/utils';
import { FileBarChart, Download, Clock, Shield, Cpu, Activity, AlertTriangle, CheckCircle2, XCircle, Save, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';

export default function ExecutiveReportConsole() {
  const report = useMemo(() => {
    const sp = showPlanManager.current;
    const vResult = verificationEngine.run();
    const readiness = readinessEvaluator.evaluate();
    const health = unifiedHardwareRegistry.getSystemHealth();
    const provenances = unifiedHardwareRegistry.getAllProvenances();

    const simCount = unifiedHardwareRegistry.getSimulatedCount();
    const totalAdapters = provenances.size;

    const errorCount = readiness.issues.filter(i => i.severity === 'error').length;
    const warningCount = readiness.issues.filter(i => i.severity === 'warning').length;
    const infoCount = readiness.issues.filter(i => i.severity === 'info').length;

    return {
      timestamp: new Date().toISOString(),
      show: {
        name: sp.metadata?.name || 'Untitled Show',
        pyroCues: sp.pyroCues.length,
        dmxCues: sp.dmxCues.length,
        dronePaths: sp.dronePaths.length,
        duration: sp.metadata?.duration ?? 0,
      },
      verification: {
        level: vResult.level,
        totalChecks: vResult.issues.length,
        passed: vResult.issues.filter(i => i.passed).length,
        failed: vResult.issues.filter(i => !i.passed).length,
        categories: ['pyro', 'dmx', 'drone', 'timing', 'hardware'].map(cat => ({
          name: cat,
          passed: vResult.issues.filter(i => i.category === cat && i.passed).length,
          total: vResult.issues.filter(i => i.category === cat).length,
        })),
      },
      readiness: {
        status: readiness.status,
        mode: readiness.mode,
        allowedOps: readiness.allowed_operations,
        blockedOps: readiness.blocked_operations,
      },
      hardware: {
        online: health.online,
        degraded: health.total - health.online,
        offline: health.total - health.online,
        errors: health.errors,
        warnings: health.warnings,
        simulatedCount: simCount,
        totalAdapters,
      },
      issues: { errors: errorCount, warnings: warningCount, info: infoCount },
      issuesList: readiness.issues,
    };
  }, []);

  const handleExportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fxk-exec-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Executive report exported');
  }, [report]);

  const levelColor = (level: string) => {
    if (level.includes('FIELD') || level.includes('HARDWARE_SYNC')) return 'text-emerald-400 bg-emerald-500/15';
    if (level.includes('EXPORT') || level.includes('LIVE')) return 'text-amber-400 bg-amber-500/15';
    if (level.includes('BLOCKED')) return 'text-red-400 bg-red-500/15';
    return 'text-cyan-400 bg-cyan-500/15';
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-background/80">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileBarChart className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">Executive Status Report</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[7px] font-mono text-muted-foreground/50">
            <Clock className="w-2.5 h-2.5 inline mr-1" />
            {new Date(report.timestamp).toLocaleString()}
          </span>
          <Button variant="outline" size="sm" onClick={handleExportJSON} className="h-6 text-[8px] font-mono gap-1">
            <Download className="w-3 h-3" /> EXPORT JSON
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4">
          {/* Show Summary */}
          <Section icon={Activity} title="SHOW SUMMARY">
            <div className="grid grid-cols-5 gap-2">
              <Metric label="SHOW" value={report.show.name} />
              <Metric label="PYRO CUES" value={report.show.pyroCues} />
              <Metric label="DMX CUES" value={report.show.dmxCues} />
              <Metric label="DRONE PATHS" value={report.show.dronePaths} />
              <Metric label="DURATION" value={`${report.show.duration}s`} />
            </div>
          </Section>

          {/* Verification */}
          <Section icon={Shield} title="VERIFICATION PASS">
            <div className="flex items-center gap-3 mb-2">
              <span className={cn('text-[10px] font-mono font-bold px-2 py-0.5 rounded', levelColor(report.verification.level))}>
                {report.verification.level}
              </span>
              <span className="text-[8px] font-mono text-muted-foreground">
                {report.verification.passed}/{report.verification.totalChecks} checks passed
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {report.verification.categories.map(cat => (
                <div key={cat.name} className="text-center rounded border border-border/10 p-1.5">
                  <div className="text-[7px] font-mono text-muted-foreground/50 uppercase">{cat.name}</div>
                  <div className={cn('text-[10px] font-mono font-bold',
                    cat.passed === cat.total ? 'text-emerald-400' : cat.passed > 0 ? 'text-amber-400' : 'text-red-400'
                  )}>{cat.passed}/{cat.total}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Readiness */}
          <Section icon={CheckCircle2} title="READINESS STATUS">
            <div className="flex items-center gap-3 mb-2">
              <span className={cn('text-[10px] font-mono font-bold px-2 py-0.5 rounded', levelColor(report.readiness.status))}>
                {report.readiness.status}
              </span>
              <span className="text-[8px] font-mono text-muted-foreground">Mode: {report.readiness.mode}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[7px] font-mono text-muted-foreground/50 mb-1">ALLOWED OPERATIONS</div>
                <div className="flex flex-wrap gap-1">
                  {report.readiness.allowedOps.map(op => (
                    <span key={op} className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">{op}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[7px] font-mono text-muted-foreground/50 mb-1">BLOCKED OPERATIONS</div>
                <div className="flex flex-wrap gap-1">
                  {report.readiness.blockedOps.map(op => (
                    <span key={op} className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">{op}</span>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Hardware */}
          <Section icon={Cpu} title="HARDWARE HEALTH">
            <div className="grid grid-cols-6 gap-2">
              <Metric label="ONLINE" value={report.hardware.online} color="text-emerald-400" />
              <Metric label="DEGRADED" value={report.hardware.degraded} color="text-amber-400" />
              <Metric label="OFFLINE" value={report.hardware.offline} color="text-red-400" />
              <Metric label="ERRORS" value={report.hardware.errors} color="text-red-400" />
              <Metric label="WARNINGS" value={report.hardware.warnings} color="text-amber-400" />
              <Metric label="SIMULATED" value={`${report.hardware.simulatedCount}/${report.hardware.totalAdapters}`} color="text-blue-400" />
            </div>
          </Section>

          {/* Issues */}
          <Section icon={AlertTriangle} title={`OPEN ISSUES (${report.issues.errors + report.issues.warnings + report.issues.info})`}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">{report.issues.errors} ERRORS</span>
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">{report.issues.warnings} WARNINGS</span>
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400">{report.issues.info} INFO</span>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {report.issuesList.map((issue, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1 rounded border border-border/10">
                  {issue.severity === 'error' ? <XCircle className="w-2.5 h-2.5 text-red-400 shrink-0" /> :
                   issue.severity === 'warning' ? <AlertTriangle className="w-2.5 h-2.5 text-amber-400 shrink-0" /> :
                   <CheckCircle2 className="w-2.5 h-2.5 text-cyan-400 shrink-0" />}
                  <span className="text-[7px] font-mono text-muted-foreground/60">{issue.source}</span>
                  <span className="text-[8px] font-mono text-foreground/80">{issue.message}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </ScrollArea>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Activity; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-border/20 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3 h-3 text-primary" />
        <span className="text-[8px] font-mono text-muted-foreground/50 tracking-widest">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-[7px] font-mono text-muted-foreground/50">{label}</div>
      <div className={cn('text-[10px] font-mono font-bold', color || 'text-foreground')}>{value}</div>
    </div>
  );
}
