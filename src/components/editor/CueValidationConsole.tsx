/**
 * CueValidationConsole — Timeline conflicts, channel collisions, timing gaps.
 * Consumes ShowPlan data directly from ShowPlanManager.
 */
import { useState, useCallback, useMemo } from 'react';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { useVerificationStore } from '@/core/verification/useVerificationStore';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, RefreshCw, Clock, Zap, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ValidationIssue {
  id: string;
  type: 'conflict' | 'gap' | 'overlap' | 'orphan' | 'limit';
  severity: 'error' | 'warning' | 'info';
  message: string;
  cueIds: string[];
}

export default function CueValidationConsole() {
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [lastRun, setLastRun] = useState<number>(0);
  const level = useVerificationStore(s => s.level);

  const runValidation = useCallback(() => {
    const sp = showPlanManager.current;
    const found: ValidationIssue[] = [];

    // 1. Channel conflicts (same module:channel < 0.5s apart)
    const channelMap = new Map<string, typeof sp.pyroCues>();
    for (const cue of sp.pyroCues) {
      const key = `${cue.module}:${cue.channel}`;
      if (!channelMap.has(key)) channelMap.set(key, []);
      channelMap.get(key)!.push(cue);
    }
    for (const [key, cues] of channelMap) {
      if (cues.length < 2) continue;
      const sorted = [...cues].sort((a, b) => a.time - b.time);
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i].time - sorted[i - 1].time;
        if (gap < 0.5) {
          found.push({
            id: `conflict-${key}-${i}`,
            type: 'conflict',
            severity: 'error',
            message: `Channel ${key}: ${gap.toFixed(3)}s gap (min 0.5s) at T${sorted[i - 1].time.toFixed(1)}s`,
            cueIds: [sorted[i - 1].id, sorted[i].id],
          });
        }
      }
    }

    // 2. Orphan cues (no valid position)
    const posIds = new Set(sp.positions.map(p => p.id));
    for (const cue of sp.pyroCues) {
      if (!posIds.has(cue.positionId)) {
        found.push({
          id: `orphan-${cue.id}`,
          type: 'orphan',
          severity: 'warning',
          message: `Cue ${cue.id} references missing position ${cue.positionId}`,
          cueIds: [cue.id],
        });
      }
    }

    // 3. Module channel limits
    const moduleChannels = new Map<number, Set<number>>();
    for (const cue of sp.pyroCues) {
      if (!moduleChannels.has(cue.module)) moduleChannels.set(cue.module, new Set());
      moduleChannels.get(cue.module)!.add(cue.channel);
    }
    for (const [mod, chs] of moduleChannels) {
      if (chs.size > 32) {
        found.push({
          id: `limit-mod-${mod}`,
          type: 'limit',
          severity: 'error',
          message: `Module ${mod}: ${chs.size} channels (max 32)`,
          cueIds: [],
        });
      }
    }

    // 4. Large timing gaps (>30s between consecutive cues)
    if (sp.pyroCues.length > 1) {
      const sorted = [...sp.pyroCues].sort((a, b) => a.time - b.time);
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i].time - sorted[i - 1].time;
        if (gap > 30) {
          found.push({
            id: `gap-${i}`,
            type: 'gap',
            severity: 'info',
            message: `${gap.toFixed(1)}s gap between T${sorted[i - 1].time.toFixed(1)}s and T${sorted[i].time.toFixed(1)}s`,
            cueIds: [sorted[i - 1].id, sorted[i].id],
          });
        }
      }
    }

    setIssues(found);
    setLastRun(Date.now());
  }, []);

  const sp = showPlanManager.current;
  const counts = useMemo(() => ({
    errors: issues.filter(i => i.severity === 'error').length,
    warnings: issues.filter(i => i.severity === 'warning').length,
    info: issues.filter(i => i.severity === 'info').length,
  }), [issues]);

  const severityIcon = (s: string) => {
    if (s === 'error') return <AlertTriangle className="w-3 h-3 text-red-400" />;
    if (s === 'warning') return <AlertTriangle className="w-3 h-3 text-amber-400" />;
    return <Clock className="w-3 h-3 text-blue-400" />;
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-background/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">Cue Validation</span>
        </div>
        <Button size="sm" variant="outline" onClick={runValidation} className="h-6 text-[9px] font-mono gap-1">
          <RefreshCw className="w-3 h-3" /> VALIDATE
        </Button>
      </div>

      {/* Summary stats */}
      <div className="flex items-center gap-4 text-[9px] font-mono text-muted-foreground">
        <span>Pyro: <span className="text-foreground">{sp.pyroCues.length}</span></span>
        <span>DMX: <span className="text-foreground">{sp.dmxCues.length}</span></span>
        <span>Drones: <span className="text-foreground">{sp.dronePaths.length}</span></span>
        <span className={cn('flex items-center gap-1',
          level === 'BLOCKED' ? 'text-red-400' :
          level === 'READY_FOR_FIELD' ? 'text-emerald-400' : 'text-amber-400'
        )}>
          {level === 'BLOCKED' ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
          {level.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Issue counters */}
      {lastRun > 0 && (
        <div className="flex items-center gap-3 text-[9px] font-mono">
          <span className={cn('px-1.5 py-0.5 rounded', counts.errors > 0 ? 'bg-red-500/15 text-red-400' : 'bg-muted/20 text-muted-foreground/50')}>
            {counts.errors} ERRORS
          </span>
          <span className={cn('px-1.5 py-0.5 rounded', counts.warnings > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-muted/20 text-muted-foreground/50')}>
            {counts.warnings} WARNINGS
          </span>
          <span className="px-1.5 py-0.5 rounded bg-muted/20 text-muted-foreground/50">
            {counts.info} INFO
          </span>
        </div>
      )}

      {/* Issue list */}
      <ScrollArea className="flex-1 border border-border/10 rounded">
        {issues.length === 0 && lastRun === 0 ? (
          <div className="p-4 text-center text-[9px] font-mono text-muted-foreground/40">
            Click VALIDATE to run cue validation checks
          </div>
        ) : issues.length === 0 ? (
          <div className="p-4 text-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <span className="text-[9px] font-mono text-emerald-400">ALL CHECKS PASSED</span>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {issues.map(issue => (
              <div key={issue.id} className={cn(
                'flex items-start gap-2 p-2 rounded border text-[9px] font-mono',
                issue.severity === 'error' ? 'border-red-500/20 bg-red-500/5' :
                issue.severity === 'warning' ? 'border-amber-500/20 bg-amber-500/5' :
                'border-border/10 bg-muted/5'
              )}>
                {severityIcon(issue.severity)}
                <div className="flex-1">
                  <span className="text-foreground/80">{issue.message}</span>
                  {issue.cueIds.length > 0 && (
                    <div className="text-muted-foreground/40 mt-0.5">
                      Cues: {issue.cueIds.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
