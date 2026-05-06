/**
 * FireOneExportConsole — UltraFire CSV (oficial) + audit.txt (anexo).
 * Consome ShowPlan canônico via FireOneCsvExporter / FireOneExporter.
 */
import { useState, useCallback } from 'react';
import { generateFireOneCsv } from '@/core/export/FireOneCsvExporter';
import { downloadFireOneImportPackage } from '@/core/export/fireOneImportPackage';
import { downloadFireOneScript } from '@/core/export/FireOneExporter';
import { useVerificationStore } from '@/core/verification/useVerificationStore';
import { isSimulating } from '@/core/safety/simulationGuard';
import { useShowPlanProjection } from '@/hooks/useShowPlanProjection';
import { useConsoleProvenance } from '@/hooks/useConsoleProvenance';
import { ProvenanceBadge } from '@/components/safety/ProvenanceBadge';
import { cn } from '@/lib/utils';
import { FileOutput, Download, CheckCircle2, XOctagon, RefreshCw, AlertTriangle, Package, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useShallow } from 'zustand/react/shallow';

export default function FireOneExportConsole() {
  const [preview, setPreview] = useState<string>('');
  const [exportErrors, setExportErrors] = useState<string[]>([]);
  const [exportWarnings, setExportWarnings] = useState<string[]>([]);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const { level, result, runVerification } = useVerificationStore(
    useShallow((s) => ({ level: s.level, result: s.result, runVerification: s.runVerification })),
  );
  const sp = showPlanManager.current;
  const sim = isSimulating();

  const refresh = useCallback(() => {
    runVerification();
    const r = generateFireOneCsv();
    setPreview(r.csv);
    setExportErrors(r.errors);
    setExportWarnings(r.warnings);
    setVerified(!r.blocked && r.cueCount > 0);
  }, [runVerification]);

  const handleZip = useCallback(async () => {
    setBusy(true);
    try { await downloadFireOneImportPackage(); }
    finally { setBusy(false); }
  }, []);

  const handleAudit = useCallback(() => {
    downloadFireOneScript();
  }, []);

  const passed = result?.summary.passed ?? 0;
  const total = result?.summary.total ?? 0;
  const blockedHard = !sim && exportErrors.length > 0;
  const badgeLabel = blockedHard ? 'BLOCKED' : sim ? 'SIM · ADVISORY' : level.replace(/_/g, ' ');
  const badgeClass = blockedHard
    ? 'bg-red-500/15 text-red-400 border-red-500/30'
    : sim
    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

  const noCues = sp.pyroCues.length === 0;
  const disableExport = busy || noCues || blockedHard;

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-background/80">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileOutput className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">FireOne Export · UltraFire CSV</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border', badgeClass)}>
            {badgeLabel}
          </span>
          <Button size="sm" variant="outline" onClick={refresh} className="h-6 text-[9px] font-mono gap-1">
            <RefreshCw className="w-3 h-3" /> PREVIEW
          </Button>
          <Button size="sm" onClick={handleZip} disabled={disableExport}
            className="h-6 text-[9px] font-mono gap-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-30">
            <Package className="w-3 h-3" /> EXPORT CSV (ULTRAFIRE)
          </Button>
          <Button size="sm" variant="outline" onClick={handleAudit} disabled={noCues}
            className="h-6 text-[9px] font-mono gap-1">
            <FileText className="w-3 h-3" /> AUDIT.TXT
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 text-[9px] font-mono text-muted-foreground flex-wrap">
        <span>Pyro Cues: <span className="text-foreground">{sp.pyroCues.length}</span></span>
        <span>Modules: <span className="text-foreground">{sp.hardwareConfig.modules.length}</span></span>
        <span>Duration: <span className="text-foreground">{sp.metadata.duration.toFixed(1)}s</span></span>
        <span>Checks: <span className="text-foreground">{passed}/{total}</span></span>
        {verified !== null && (
          <span className={cn('flex items-center gap-1', verified ? 'text-emerald-400' : 'text-red-400')}>
            {verified ? <CheckCircle2 className="w-3 h-3" /> : <XOctagon className="w-3 h-3" />}
            {verified ? 'VALID' : blockedHard ? 'BLOCKED' : 'ADVISORY'}
          </span>
        )}
      </div>

      {exportErrors.length > 0 && (
        <div className="border border-red-500/20 rounded p-2 bg-red-500/5 space-y-0.5 max-h-24 overflow-y-auto">
          {exportErrors.map((e, i) => (
            <div key={i} className="text-[8px] font-mono text-red-400 flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {e}
            </div>
          ))}
        </div>
      )}
      {exportWarnings.length > 0 && (
        <div className="border border-amber-500/20 rounded p-2 bg-amber-500/5 space-y-0.5 max-h-20 overflow-y-auto">
          {exportWarnings.map((w, i) => (
            <div key={i} className="text-[8px] font-mono text-amber-400 flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {w}
            </div>
          ))}
        </div>
      )}

      <ScrollArea className="flex-1 border border-border/10 rounded">
        <pre className="p-3 text-[9px] font-mono text-muted-foreground whitespace-pre leading-relaxed">
          {preview || 'Click PREVIEW to generate UltraFire CSV from ShowPlan'}
        </pre>
      </ScrollArea>
    </div>
  );
}
