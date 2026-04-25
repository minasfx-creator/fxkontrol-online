/**
 * FireOneExportConsole — FireOne .fir script preview and export.
 * Consumes data from FireOneExporter (ShowPlan → VerificationEngine → Export).
 */
import { useState, useCallback } from 'react';
import { generateFireOneScript, downloadFireOneScript } from '@/core/export/FireOneExporter';
import { useVerificationStore } from '@/core/verification/useVerificationStore';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { cn } from '@/lib/utils';
import { FileOutput, Download, CheckCircle2, XOctagon, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function FireOneExportConsole() {
  const [preview, setPreview] = useState<string>('');
  const [exportErrors, setExportErrors] = useState<string[]>([]);
  const [verified, setVerified] = useState<boolean | null>(null);
  const { level, result, runVerification } = useVerificationStore();
  const sp = showPlanManager.current;
  const canExport = level === 'READY_FOR_EXPORT' || level === 'READY_FOR_FIELD';

  const generatePreview = useCallback(() => {
    runVerification();
    const r = generateFireOneScript();
    setPreview(r.script);
    setExportErrors(r.errors);
    setVerified(r.verified && r.errors.length === 0 && r.cueCount > 0);
  }, [runVerification]);

  const handleExport = useCallback(() => {
    downloadFireOneScript();
  }, []);

  const passed = result?.summary.passed ?? 0;
  const total = result?.summary.total ?? 0;

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-background/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileOutput className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">FireOne Export</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border',
            canExport ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
            'bg-red-500/15 text-red-400 border-red-500/30'
          )}>
            {level.replace(/_/g, ' ')}
          </span>
          <Button size="sm" variant="outline" onClick={generatePreview} className="h-6 text-[9px] font-mono gap-1">
            <RefreshCw className="w-3 h-3" /> PREVIEW
          </Button>
          <Button size="sm" onClick={handleExport} disabled={!canExport || sp.pyroCues.length === 0}
            className="h-6 text-[9px] font-mono gap-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-30">
            <Download className="w-3 h-3" /> EXPORT .FIR
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 text-[9px] font-mono text-muted-foreground">
        <span>Pyro Cues: <span className="text-foreground">{sp.pyroCues.length}</span></span>
        <span>Modules: <span className="text-foreground">{sp.hardwareConfig.modules.length}</span></span>
        <span>Duration: <span className="text-foreground">{sp.metadata.duration.toFixed(1)}s</span></span>
        <span>Checks: <span className="text-foreground">{passed}/{total}</span></span>
        {verified !== null && (
          <span className={cn('flex items-center gap-1', verified ? 'text-emerald-400' : 'text-red-400')}>
            {verified ? <CheckCircle2 className="w-3 h-3" /> : <XOctagon className="w-3 h-3" />}
            {verified ? 'VALID' : 'BLOCKED'}
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

      <ScrollArea className="flex-1 border border-border/10 rounded">
        <pre className="p-3 text-[9px] font-mono text-muted-foreground whitespace-pre leading-relaxed">
          {preview || '; Click PREVIEW to generate FireOne script from ShowPlan'}
        </pre>
      </ScrollArea>
    </div>
  );
}
