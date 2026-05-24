/**
 * AuditBlackBoxConsole — View safety audit trail and blackbox recordings.
 */
import { useState, useCallback } from 'react';
import { safetyAuditTrail, type AuditEntry } from '@/core/safety/SafetyAuditTrail';
import { blackbox } from '@/core/reliability/blackBoxRecorder';
import { cn } from '@/lib/utils';
import { FileText, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const EVENT_COLORS: Record<string, string> = {
  ARM: 'text-amber-400', DISARM: 'text-muted-foreground', FIRE: 'text-red-400',
  E_STOP: 'text-red-400', VIOLATION: 'text-red-400', STATE_CHANGE: 'text-cyan-400',
  LOCK: 'text-amber-400', UNLOCK: 'text-muted-foreground', RESET: 'text-emerald-400',
  CONTINUITY_CHECK: 'text-cyan-400',
};

export default function AuditBlackBoxConsole() {
  const [entries, setEntries] = useState<readonly AuditEntry[]>(safetyAuditTrail.getAll());
  const [tab, setTab] = useState<'audit' | 'blackbox'>('audit');

  const refresh = useCallback(() => {
    setEntries([...safetyAuditTrail.getAll()]);
  }, []);

  const exportAudit = useCallback(() => {
    const json = safetyAuditTrail.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `fxk_audit_${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportBlackbox = useCallback(() => {
    const blob = blackbox.exportBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `fxk_blackbox_${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-background/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">Audit / BlackBox</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={refresh} className="h-6 text-[9px] font-mono gap-1">
            <RefreshCw className="w-3 h-3" /> REFRESH
          </Button>
          <Button size="sm" variant="outline" onClick={tab === 'audit' ? exportAudit : exportBlackbox} className="h-6 text-[9px] font-mono gap-1">
            <Download className="w-3 h-3" /> EXPORT
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button onClick={() => setTab('audit')} className={cn(
          'px-3 py-1 rounded text-[9px] font-mono font-bold tracking-widest transition-all',
          tab === 'audit' ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30' : 'text-muted-foreground/40 hover:text-muted-foreground/60'
        )}>SAFETY AUDIT</button>
        <button onClick={() => setTab('blackbox')} className={cn(
          'px-3 py-1 rounded text-[9px] font-mono font-bold tracking-widest transition-all',
          tab === 'blackbox' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30' : 'text-muted-foreground/40 hover:text-muted-foreground/60'
        )}>BLACK BOX</button>
        <span className="ml-auto text-[8px] font-mono text-muted-foreground/40">
          {tab === 'audit' ? `${entries.length} entries` : `${blackbox.getEntryCount()} records`}
        </span>
      </div>

      <ScrollArea className="flex-1 border border-border/10 rounded">
        <div className="p-2 space-y-0.5">
          {tab === 'audit' ? (
            entries.length === 0 ? (
              <span className="text-[9px] font-mono text-muted-foreground/30">No audit events recorded</span>
            ) : (
              entries.slice().reverse().map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-[8px] font-mono py-0.5">
                  <span className="text-muted-foreground/30 w-16 shrink-0">{new Date(e.timestamp).toLocaleTimeString()}</span>
                  <span className={cn('font-bold w-20 shrink-0', EVENT_COLORS[e.event] ?? 'text-muted-foreground/50')}>{e.event}</span>
                  <span className="text-muted-foreground/40 w-16 shrink-0">{e.from} → {e.to}</span>
                  <span className="text-muted-foreground/50 truncate">{e.detail}</span>
                </div>
              ))
            )
          ) : (
            blackbox.getEntryCount() === 0 ? (
              <span className="text-[9px] font-mono text-muted-foreground/30">No blackbox records</span>
            ) : (
              <div className="space-y-0.5">
                {blackbox.export().slice(-50).reverse().map((e, i) => (
                  <div key={i} className="flex items-center gap-2 text-[8px] font-mono py-0.5">
                    <span className="text-muted-foreground/30 w-16 shrink-0">{(e.t / 1000).toFixed(1)}s</span>
                    <span className="text-cyan-400/70 font-bold w-12 shrink-0">{e.cat}</span>
                    <span className="text-muted-foreground/50 truncate">{e.msg}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
