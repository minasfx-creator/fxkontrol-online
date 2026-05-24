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
  const [saving, setSaving] = useState(false);
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

  const handleSaveToHistory = useCallback(async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Login required to save reports'); return; }
      const { error } = await supabase.from('executive_reports' as never).insert({
        user_id: user.id,
        report_data: report as unknown as Record<string, unknown>,
        show_name: report.show.name,
        verification_level: report.verification.level,
        readiness_status: report.readiness.status,
      } as never);
      if (error) throw error;
      toast.success('Report saved to history');
    } catch (e: unknown) {
      toast.error(`Save failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }, [report]);

  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const w = doc.internal.pageSize.getWidth();
    let y = 15;
    const lm = 15;

    // Header
    doc.setFillColor(15, 15, 20);
    doc.rect(0, 0, w, 35, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 165, 0);
    doc.text('FX KONTROL — EXECUTIVE REPORT', lm, y + 5);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(new Date(report.timestamp).toLocaleString(), lm, y + 12);
    doc.text(`Show: ${report.show.name}`, lm, y + 17);
    y = 42;

    const sectionTitle = (title: string) => {
      doc.setFillColor(25, 25, 35);
      doc.rect(lm - 2, y - 4, w - 2 * lm + 4, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 165, 0);
      doc.text(title, lm, y);
      y += 8;
    };

    const row = (label: string, value: string) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(180, 180, 180);
      doc.text(label, lm, y);
      doc.setTextColor(240, 240, 240);
      doc.text(value, lm + 55, y);
      y += 5;
    };

    // Show Summary
    sectionTitle('SHOW SUMMARY');
    row('Pyro Cues', String(report.show.pyroCues));
    row('DMX Cues', String(report.show.dmxCues));
    row('Drone Paths', String(report.show.dronePaths));
    row('Duration', `${report.show.duration}s`);
    y += 3;

    // Verification
    sectionTitle('VERIFICATION PASS');
    row('Level', report.verification.level);
    row('Checks Passed', `${report.verification.passed}/${report.verification.totalChecks}`);
    report.verification.categories.forEach(c => row(`  ${c.name.toUpperCase()}`, `${c.passed}/${c.total}`));
    y += 3;

    // Readiness
    sectionTitle('READINESS STATUS');
    row('Status', report.readiness.status);
    row('Mode', report.readiness.mode);
    row('Allowed', report.readiness.allowedOps.join(', ') || 'None');
    row('Blocked', report.readiness.blockedOps.join(', ') || 'None');
    y += 3;

    // Hardware
    sectionTitle('HARDWARE HEALTH');
    row('Online', String(report.hardware.online));
    row('Degraded', String(report.hardware.degraded));
    row('Offline', String(report.hardware.offline));
    row('Errors / Warnings', `${report.hardware.errors} / ${report.hardware.warnings}`);
    row('Simulated', `${report.hardware.simulatedCount}/${report.hardware.totalAdapters}`);
    y += 3;

    // Issues
    sectionTitle(`OPEN ISSUES (${report.issues.errors + report.issues.warnings + report.issues.info})`);
    report.issuesList.slice(0, 15).forEach(issue => {
      if (y > 270) { doc.addPage(); y = 15; }
      const prefix = issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '⚠' : 'ℹ';
      row(`${prefix} [${issue.source}]`, issue.message);
    });

    // Footer
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.text('Generated by FX KONTROL — Phase 5 Executive Consolidation', lm, 290);

    doc.save(`fxk-exec-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('PDF report exported');
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
          <Button variant="outline" size="sm" onClick={handleSaveToHistory} disabled={saving} className="h-6 text-[8px] font-mono gap-1">
            <Save className="w-3 h-3" /> {saving ? 'SAVING...' : 'SAVE TO HISTORY'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-6 text-[8px] font-mono gap-1">
            <FileText className="w-3 h-3" /> EXPORT PDF
          </Button>
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
