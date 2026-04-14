/**
 * ─── Readiness Dashboard ───────────────────────────────────────────
 * Unified readiness evaluation display. Shows status, allowed/blocked
 * operations, all issues categorized by source.
 */

import { useEffect } from 'react';
import { useHardwareRegistry } from '@/core/hardware/useHardwareRegistry';
import { cn } from '@/lib/utils';
import { Shield, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  BLOCKED:                  { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/30' },
  READY_FOR_SIMULATION:     { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/30' },
  READY_FOR_EXPORT:         { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/30' },
  READY_FOR_HARDWARE_SYNC:  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
};

export default function ReadinessDashboard() {
  const { readiness, evaluateReadiness, refresh } = useHardwareRegistry();

  useEffect(() => {
    refresh();
    evaluateReadiness();
  }, []);

  const st = readiness?.status ?? 'BLOCKED';
  const style = STATUS_STYLES[st] ?? STATUS_STYLES.BLOCKED;

  return (
    <div className="flex flex-col h-full bg-background/80 p-3 gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">Readiness Dashboard</span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[8px] font-mono"
          onClick={() => { refresh(); evaluateReadiness(); }}>
          <RefreshCw className="w-3 h-3 mr-1" /> EVALUATE
        </Button>
      </div>

      {/* Status banner */}
      <div className={cn('p-3 rounded border text-center', style.bg, style.border)}>
        <div className={cn('text-lg font-mono font-black tracking-widest', style.text)}>
          {st.replace(/_/g, ' ')}
        </div>
        {readiness && (
          <div className="text-[8px] font-mono text-muted-foreground mt-1">
            Mode: {readiness.mode} | {readiness.issues.length} issue(s) | {readiness.warnings.length} warning(s)
          </div>
        )}
      </div>

      {/* Operations */}
      {readiness && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-border/20 bg-card/20 p-2">
            <span className="text-[7px] font-mono text-emerald-400/60 uppercase">Allowed Operations</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {readiness.allowed_operations.map(op => (
                <span key={op} className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" />{op}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded border border-border/20 bg-card/20 p-2">
            <span className="text-[7px] font-mono text-red-400/60 uppercase">Blocked Operations</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {readiness.blocked_operations.map(op => (
                <span key={op} className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-red-500/10 text-red-400/50 border border-red-500/10 flex items-center gap-1">
                  <XCircle className="w-2.5 h-2.5" />{op}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Issues */}
      {readiness && readiness.issues.length > 0 && (
        <ScrollArea className="flex-1">
          <div className="space-y-1">
            {readiness.issues.map((issue, i) => (
              <div key={i} className={cn('flex items-start gap-2 p-1.5 rounded border border-border/10', {
                'bg-red-500/5': issue.severity === 'error',
                'bg-amber-500/5': issue.severity === 'warning',
              })}>
                {issue.severity === 'error' ? <XCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" /> :
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />}
                <div>
                  <span className="text-[8px] font-mono text-muted-foreground/50">[{issue.source}]</span>{' '}
                  <span className="text-[9px] font-mono text-foreground">{issue.message}</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
