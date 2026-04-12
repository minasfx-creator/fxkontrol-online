/**
 * FireOneExportConsole — FireOne .fir script preview and pre-export validation.
 */
import { useState, useCallback } from 'react';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { exportFireOneScript } from '@/core/export/exportEngine';
import { cn } from '@/lib/utils';
import { FileOutput, Download, CheckCircle2, XOctagon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function FireOneExportConsole() {
  const [preview, setPreview] = useState<string>('');
  const [validated, setValidated] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const sp = showPlanManager.current;

  const generatePreview = useCallback(() => {
    const lines: string[] = [];
    lines.push('; FireOne Script — FX KONTROL Export');
    lines.push(`; Show: ${sp.metadata.name}`);
    lines.push(`; Venue: ${sp.metadata.venue || 'N/A'}`);
    lines.push(`; Date: ${new Date().toISOString().split('T')[0]}`);
    lines.push(`; Cues: ${sp.pyroCues.length}`);
    lines.push('');
    lines.push('MODULE,PIN,TIME,PREFIRE,DESCRIPTION,CALIBER,ELEVATION');

    const errs: string[] = [];
    sp.pyroCues.forEach((cue, idx) => {
      if (cue.module < 0) errs.push(`Cue ${idx + 1}: invalid module ${cue.module}`);
      if (cue.channel < 0 || cue.channel > 31) errs.push(`Cue ${idx + 1}: channel ${cue.channel} out of range 0-31`);
      lines.push(
        `${cue.module},${cue.channel},${cue.time.toFixed(3)},${cue.fuseDelay},${cue.effectId},${cue.caliber},${cue.elevation}`
      );
    });

    setPreview(lines.join('\n'));
    setErrors(errs);
    setValidated(errs.length === 0 && sp.pyroCues.length > 0);
  }, [sp]);

  const handleExport = useCallback(() => {
    exportFireOneScript(sp);
  }, [sp]);

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-background/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileOutput className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">FireOne Export</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={generatePreview} className="h-6 text-[9px] font-mono gap-1">
            PREVIEW
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
        <span>Duration: <span className="text-foreground">{sp.metadata.duration}s</span></span>
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
          {preview || '; Click PREVIEW to generate FireOne script'}
        </pre>
      </ScrollArea>
    </div>
  );
}
