/**
 * ─── CueConflictsConsole ────────────────────────────────────────────
 * Read-only wrapper around `verificationEngine.run()` — surfaces every
 * issue grouped by category, with severity counters. Pure observer:
 * never mutates ShowPlan, never touches the safety chain.
 */
import { useEffect, useMemo, useState } from 'react';
import { verificationEngine } from '@/core/verification/VerificationEngine';
import type { VerificationIssue, VerificationResult } from '@/core/verification/types';
import { useShowPlanProjection } from '@/hooks/useShowPlanProjection';
import { ProvenanceBadge } from '@/components/safety/ProvenanceBadge';
import { useConsoleProvenance } from '@/hooks/useConsoleProvenance';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export function CueConflictsConsole() {
  const projection = useShowPlanProjection();
  const provenance = useConsoleProvenance(['fxk16', 'fireone', 'enttec', 'dmx-generic', 'artnet-node']);
  const [result, setResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    setResult(verificationEngine.run(projection.plan));
  }, [projection.updatedAt, projection.plan]);

  const grouped = useMemo(() => {
    const map = new Map<string, VerificationIssue[]>();
    if (!result) return map;
    for (const i of result.issues) {
      if (i.passed) continue;
      const key = i.category;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    }
    return map;
  }, [result]);

  const summary = result?.summary ?? { total: 0, passed: 0, errors: 0, warnings: 0 };

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-background/80">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono font-bold tracking-widest uppercase text-foreground">
            Cue Conflicts · Verification
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ProvenanceBadge mode={provenance} compact />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setResult(verificationEngine.run(projection.plan))}
            className="h-6 text-[9px] font-mono gap-1"
          >
            <RefreshCw className="w-3 h-3" /> RE-RUN
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[9px] font-mono">
        <span className={cn('px-1.5 py-0.5 rounded', summary.errors > 0 ? 'bg-red-500/15 text-red-400' : 'bg-muted/20 text-muted-foreground/50')}>
          {summary.errors} ERRORS
        </span>
        <span className={cn('px-1.5 py-0.5 rounded', summary.warnings > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-muted/20 text-muted-foreground/50')}>
          {summary.warnings} WARNINGS
        </span>
        <span className="px-1.5 py-0.5 rounded bg-muted/20 text-muted-foreground/50">
          {summary.passed}/{summary.total} CHECKS
        </span>
        <span className="text-muted-foreground/50 ml-auto">
          Pyro {projection.pyroCueCount} · DMX {projection.dmxCueCount} · Drone {projection.droneCueCount}
        </span>
      </div>

      <ScrollArea className="flex-1 border border-border/10 rounded">
        {summary.errors === 0 && summary.warnings === 0 ? (
          <div className="p-4 text-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <span className="text-[9px] font-mono text-emerald-400">NO CONFLICTS</span>
          </div>
        ) : (
          <div className="p-2 space-y-3">
            {Array.from(grouped.entries()).map(([cat, issues]) => (
              <div key={cat} className="space-y-1">
                <div className="text-[8px] font-mono tracking-widest uppercase text-muted-foreground/60">
                  {cat} · {issues.length}
                </div>
                {issues.map((i) => (
                  <div
                    key={i.id}
                    className={cn(
                      'flex items-start gap-2 p-2 rounded border text-[9px] font-mono',
                      i.severity === 'error'
                        ? 'border-red-500/20 bg-red-500/5'
                        : 'border-amber-500/20 bg-amber-500/5',
                    )}
                  >
                    <AlertTriangle
                      className={cn(
                        'w-3 h-3 shrink-0 mt-0.5',
                        i.severity === 'error' ? 'text-red-400' : 'text-amber-400',
                      )}
                    />
                    <div className="flex-1">
                      <div className="text-foreground/80">{i.label}</div>
                      <div className="text-muted-foreground/60 mt-0.5">{i.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default CueConflictsConsole;
