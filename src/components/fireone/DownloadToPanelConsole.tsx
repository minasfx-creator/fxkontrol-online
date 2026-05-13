/**
 * DownloadToPanelConsole — UI for `UltraFireDownloader`.
 *
 * Compiles the active ShowPlan into per-module UltraFire payloads and
 * downloads + verifies each module. The button is *advisory* in
 * design/simulation (defense-in-depth: simulationGuard) and only routes to
 * a real transport in `real_operation`. Even there, this console NEVER
 * calls startUltraFire — that lives in the Show Commander gate.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  compileShowToModules,
  downloadAll,
  type CompiledShow,
  type ModuleDownloadProgress,
  type UltraFireTransportLike,
} from '@/core/export/UltraFireDownloader';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { useWorkMode } from '@/lib/workMode';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Download, CheckCircle2, XOctagon, RefreshCw, AlertTriangle, Cpu,
} from 'lucide-react';

export interface DownloadToPanelConsoleProps {
  /** Inject a transport. Falsy → console runs in advisory/dry-run mode. */
  transport?: UltraFireTransportLike;
}

type Row = ModuleDownloadProgress;

export default function DownloadToPanelConsole({ transport }: DownloadToPanelConsoleProps = {}) {
  const workMode = useWorkMode();
  const [compiled, setCompiled] = useState<CompiledShow | null>(null);
  const [progress, setProgress] = useState<Map<number, Row>>(new Map());
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recompile = useCallback(() => {
    const sp = showPlanManager.current;
    const c = compileShowToModules(sp.pyroCues);
    setCompiled(c);
    setProgress(new Map());
    setError(c.errors[0] ?? null);
  }, []);

  // Gating logic — advisory in design/simulation, hard in real_operation.
  const gate = useMemo(() => {
    if (!transport) {
      return { allowed: false, reason: 'NO TRANSPORT — dry-run only' };
    }
    if (workMode === 'real_operation') {
      // Real download still relies on Phase 2 grant upstream (not gated here).
      return { allowed: true, reason: '' };
    }
    return { allowed: true, reason: 'SIM · ADVISORY' };
  }, [workMode, transport]);

  const handleDownload = useCallback(async () => {
    if (!compiled) recompile();
    const c = compiled ?? compileShowToModules(showPlanManager.current.pyroCues);
    if (!transport) {
      setError('No transport connected — open /pairing/two-wire first.');
      return;
    }
    setRunning(true);
    setError(null);
    setProgress(new Map());
    try {
      await downloadAll(c, {
        transport,
        onProgress: (p) => setProgress(prev => {
          const next = new Map(prev);
          next.set(p.addr, p);
          return next;
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [compiled, recompile, transport]);

  const totals = useMemo(() => {
    if (!compiled) return { addrs: 0, cues: 0 };
    let cues = 0;
    for (const [, list] of compiled.byModule) cues += list.length;
    return { addrs: compiled.byModule.size, cues };
  }, [compiled]);

  const okCount = Array.from(progress.values()).filter(r => r.status === 'ok').length;
  const failCount = Array.from(progress.values()).filter(r => r.status === 'fail').length;

  return (
    <div className="flex flex-col h-full p-4 gap-3 bg-background/80 text-foreground">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold tracking-widest uppercase">
            Download to Panel · UltraFire
          </span>
        </div>
        {gate.reason && (
          <span
            className={cn(
              'text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border',
              workMode === 'real_operation'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30',
            )}
            data-testid="advisory-badge"
          >
            {gate.reason}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm" variant="outline" onClick={recompile}
          className="h-7 text-[10px] font-mono gap-1"
          data-testid="recompile-btn"
        >
          <RefreshCw className="w-3 h-3" /> Compile
        </Button>
        <Button
          size="sm" onClick={handleDownload}
          disabled={running || !gate.allowed}
          className={cn(
            'h-7 text-[10px] font-mono gap-1',
            'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30',
            'disabled:opacity-30',
          )}
          data-testid="download-btn"
        >
          <Download className="w-3 h-3" /> Download to Panel
        </Button>
        <span className="text-[9px] font-mono text-muted-foreground ml-auto">
          {totals.addrs} module(s) · {totals.cues} cue(s)
          {compiled && ` · verify=0x${compiled.verifyCode.toString(16).toUpperCase()}`}
        </span>
      </div>

      <div className="flex items-center gap-4 text-[9px] font-mono text-muted-foreground">
        <span>OK: <span className="text-emerald-400">{okCount}</span></span>
        <span>Fail: <span className="text-red-400">{failCount}</span></span>
        {running && <span className="text-cyan-400 animate-pulse">running…</span>}
      </div>

      {error && (
        <div className="border border-red-500/30 rounded p-2 bg-red-500/5 text-[9px] font-mono text-red-400 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <ScrollArea className="flex-1 border border-border/10 rounded">
        <table className="w-full text-[10px] font-mono">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="text-left p-2 w-12">Addr</th>
              <th className="text-left p-2 w-24">Status</th>
              <th className="text-left p-2 w-16">Try</th>
              <th className="text-left p-2 w-16">Cues</th>
              <th className="text-left p-2 w-16">Bytes</th>
              <th className="text-left p-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {compiled == null ? (
              <tr><td colSpan={6} className="p-3 text-center text-muted-foreground">
                Click COMPILE to build module payloads from the active ShowPlan.
              </td></tr>
            ) : Array.from(compiled.byModule.keys()).sort((a, b) => a - b).map(addr => {
              const r = progress.get(addr);
              return (
                <tr key={addr} className="border-t border-border/10">
                  <td className="p-2">{addr}</td>
                  <td className="p-2">
                    {r?.status === 'ok' ? (
                      <span className="text-emerald-400 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> ok
                      </span>
                    ) : r?.status === 'fail' ? (
                      <span className="text-red-400 inline-flex items-center gap-1">
                        <XOctagon className="w-3 h-3" /> fail
                      </span>
                    ) : r ? (
                      <span className="text-cyan-400">{r.status}</span>
                    ) : (
                      <span className="text-muted-foreground">idle</span>
                    )}
                  </td>
                  <td className="p-2">{r?.attempts ?? '—'}</td>
                  <td className="p-2">{compiled.byModule.get(addr)?.length ?? 0}</td>
                  <td className="p-2 text-muted-foreground">{r?.bytes ?? '—'}</td>
                  <td className="p-2 text-red-400">{r?.error ?? ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}
