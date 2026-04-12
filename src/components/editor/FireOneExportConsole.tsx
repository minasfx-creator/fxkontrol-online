/**
 * FireOneExportConsole — FireOne .fir script preview and export.
 * Consumes data from FireOneExporter (ShowPlan → Export pipeline).
 */
import { useState, useCallback } from 'react';
import { generateFireOneScript, downloadFireOneScript } from '@/core/export/FireOneExporter';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { cn } from '@/lib/utils';
import { FileOutput, Download, CheckCircle2, XOctagon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function FireOneExportConsole() {
  const [preview, setPreview] = useState<string>('');
  const [validated, setValidated] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const sp = showPlanManager.current;

  const generatePreview = useCallback(() => {
    const result = generateFireOneScript();
    setPreview(result.script);
    setErrors(result.errors);
    setValidated(result.errors.length === 0 && result.cueCount > 0);
  }, []);

  const handleExport = useCallback(() => {
    downloadFireOneScript();
  }, []);

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-background/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileOutput className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">FireOne Export</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={generatePreview} className="h-6 text-[9px] font-mono gap-1">
            <RefreshCw className="w-3 h-3" /> PREVIEW
          </Button>
          <Button size="sm" onClick={handleExport} disabled={validated !== true}
            className="h-6 text-[9px] font-mono gap-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30">
            <Download className="w-3 h-3" /> EXPORT .FIR
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 text-[9px] font-mono text-muted-foreground">
        <span>Pyro Cues: <span className="text-foreground">{sp.pyroCues.length}</span></span>
        <span>Modules: <span className="text-foreground">{sp.hardwareConfig.modules.length}</span></span>
        <span>Duration: <span className="text-foreground">{sp.metadata.duration.toFixed(1)}s</span></span>
        {validated !== null && (
          <span className={cn('flex items-center gap-1', validated ? 'text-emerald-400' : 'text-red-400')}>
            {validated ? <CheckCircle2 className="w-3 h-3" /> : <XOctagon className="w-3 h-3" />}
            {validated ? 'VALID' : `${errors.length} ERROR(S)`}
          </span>
        )}
      </div>

      {errors.length > 0 && (
        <div className="border border-red-500/20 rounded p-2 bg-red-500/5 space-y-0.5">
          {errors.map((e, i) => (
            <div key={i} className="text-[8px] font-mono text-red-400">● {e}</div>
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
