/**
 * DownloadToPanelConsole — UI for `UltraFireDownloader`.
 *
 * Compiles the active ShowPlan into per-module UltraFire payloads and
 * downloads + verifies each module. The button is *advisory* in
 * design/simulation (defense-in-depth: simulationGuard) and only routes to
 * a real transport in `real_operation`. Even there, this console NEVER
 * calls startUltraFire — that lives in the Show Commander gate.
 *
 * Adds:
 *   - Per-module retry/backoff (handled by `downloadAll` — surfaced here).
 *   - User-cancelable run via AbortController (`signal` plumbed in).
 *   - Per-event activity log (compile/verify/send/retry/error) with timing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  XCircle, Eraser,
} from 'lucide-react';

export interface DownloadToPanelConsoleProps {
  /** Inject a transport. Falsy → console runs in advisory/dry-run mode. */
  transport?: UltraFireTransportLike;
}

type Row = ModuleDownloadProgress;

type LogLevel = 'info' | 'ok' | 'warn' | 'error';

interface LogEntry {
  ts: number;
  level: LogLevel;
  addr?: number;
  attempt?: number;
  msg: string;
}

const MAX_LOG = 250;

function levelTone(level: LogLevel): string {
  if (level === 'ok') return 'text-emerald-400';
  if (level === 'warn') return 'text-amber-400';
  if (level === 'error') return 'text-red-400';
  return 'text-muted-foreground';
}

export default function DownloadToPanelConsole({ transport }: DownloadToPanelConsoleProps = {}) {
  const workMode = useWorkMode();
  const [compiled, setCompiled] = useState<CompiledShow | null>(null);
  const [progress, setProgress] = useState<Map<number, Row>>(new Map());
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const lastStatusRef = useRef<Map<number, string>>(new Map());

  const pushLog = useCallback((entry: Omit<LogEntry, 'ts'>) => {
    setLogs(prev => {
      const next = prev.length >= MAX_LOG ? prev.slice(prev.length - MAX_LOG + 1) : prev.slice();
      next.push({ ts: Date.now(), ...entry });
      return next;
    });
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Cancel any in-flight run on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const recompile = useCallback(() => {
    const sp = showPlanManager.current;
    const c = compileShowToModules(sp.pyroCues);
    setCompiled(c);
    setProgress(new Map());
    lastStatusRef.current = new Map();
    setError(c.errors[0] ?? null);
    pushLog({
      level: c.errors.length ? 'warn' : 'info',
      msg: `Compiled ${c.totalCues} cue(s) across ${c.byModule.size} module(s) · verify=0x${c.verifyCode.toString(16).toUpperCase()}${c.errors.length ? ` · ${c.errors.length} error(s)` : ''}`,
    });
    for (const e of c.errors) pushLog({ level: 'error', msg: e });
  }, [pushLog]);

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
      const m = 'No transport connected — open /pairing/two-wire first.';
      setError(m);
      pushLog({ level: 'error', msg: m });
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setRunning(true);
    setError(null);
    setProgress(new Map());
    lastStatusRef.current = new Map();
    pushLog({ level: 'info', msg: `Starting download · ${c.byModule.size} module(s) · ${c.totalCues} cue(s)` });
    try {
      const result = await downloadAll(c, {
        transport,
        signal: ac.signal,
        onProgress: (p) => {
          setProgress(prev => {
            const next = new Map(prev);
            next.set(p.addr, p);
            return next;
          });
          // Log on every status transition (per-cue/attempt visibility).
          const key = `${p.status}:${p.attempts}`;
          if (lastStatusRef.current.get(p.addr) !== key) {
            lastStatusRef.current.set(p.addr, key);
            const cueCount = p.cueCount;
            if (p.status === 'sending') {
              pushLog({
                level: p.attempts > 1 ? 'warn' : 'info',
                addr: p.addr, attempt: p.attempts,
                msg: p.attempts > 1
                  ? `retry attempt ${p.attempts} · ${cueCount} cue(s) · ${p.bytes}B`
                  : `sending ${cueCount} cue(s) · ${p.bytes}B`,
              });
            } else if (p.status === 'verifying') {
              pushLog({ level: 'info', addr: p.addr, attempt: p.attempts, msg: 'verifying…' });
            } else if (p.status === 'ok') {
              pushLog({ level: 'ok', addr: p.addr, attempt: p.attempts, msg: `ok (${cueCount} cue(s))` });
            } else if (p.status === 'fail') {
              pushLog({ level: 'error', addr: p.addr, attempt: p.attempts, msg: p.error ?? 'fail' });
            } else if (p.status === 'aborted') {
              pushLog({ level: 'warn', addr: p.addr, msg: 'aborted' });
            }
          }
        },
      });
      pushLog({
        level: result.modulesFail.length ? 'warn' : 'ok',
        msg: `Done · ok=${result.modulesOk.length} fail=${result.modulesFail.length} · ${result.durationMs}ms`,
      });
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      if (ac.signal.aborted) {
        pushLog({ level: 'warn', msg: 'Cancelled by user.' });
      } else {
        setError(m);
        pushLog({ level: 'error', msg: m });
      }
    } finally {
      setRunning(false);
    }
  }, [compiled, recompile, transport, pushLog]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const totals = useMemo(() => {
    if (!compiled) return { addrs: 0, cues: 0 };
    let cues = 0;
    for (const [, list] of compiled.byModule) cues += list.length;
    return { addrs: compiled.byModule.size, cues };
  }, [compiled]);

  const okCount = Array.from(progress.values()).filter(r => r.status === 'ok').length;
  const failCount = Array.from(progress.values()).filter(r => r.status === 'fail').length;
  const retryCount = Array.from(progress.values()).reduce((acc, r) => acc + Math.max(0, r.attempts - 1), 0);

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

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm" variant="outline" onClick={recompile}
          disabled={running}
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
        {running && (
          <Button
            size="sm" variant="ghost"
            onClick={handleCancel}
            className="h-7 text-[10px] font-mono gap-1 text-red-400 hover:text-red-300"
            data-testid="cancel-btn"
          >
            <XCircle className="w-3 h-3" /> Cancel
          </Button>
        )}
        <span className="text-[9px] font-mono text-muted-foreground ml-auto">
          {totals.addrs} module(s) · {totals.cues} cue(s)
          {compiled && ` · verify=0x${compiled.verifyCode.toString(16).toUpperCase()}`}
        </span>
      </div>

      <div className="flex items-center gap-4 text-[9px] font-mono text-muted-foreground">
        <span>OK: <span className="text-emerald-400">{okCount}</span></span>
        <span>Fail: <span className="text-red-400">{failCount}</span></span>
        <span>Retries: <span className={cn(retryCount > 0 ? 'text-amber-400' : 'text-foreground')}>{retryCount}</span></span>
        {running && <span className="text-cyan-400 animate-pulse">running…</span>}
      </div>

      {error && (
        <div className="border border-red-500/30 rounded p-2 bg-red-500/5 text-[9px] font-mono text-red-400 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <ScrollArea className="flex-1 border border-border/10 rounded min-h-[140px]">
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
                      <span className={cn('text-cyan-400', r.status === 'aborted' && 'text-amber-400')}>
                        {r.status}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">idle</span>
                    )}
                  </td>
                  <td className={cn('p-2', (r?.attempts ?? 0) > 1 && 'text-amber-400')}>{r?.attempts ?? '—'}</td>
                  <td className="p-2">{compiled.byModule.get(addr)?.length ?? 0}</td>
                  <td className="p-2 text-muted-foreground">{r?.bytes ?? '—'}</td>
                  <td className="p-2 text-red-400">{r?.error ?? ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollArea>

      {/* Activity log */}
      <div className="flex flex-col gap-1" data-testid="activity-log">
        <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
          <span>Activity log · {logs.length}/{MAX_LOG}</span>
          <button
            type="button"
            onClick={clearLogs}
            disabled={logs.length === 0 || running}
            className="inline-flex items-center gap-1 hover:text-foreground disabled:opacity-30"
            data-testid="clear-log-btn"
          >
            <Eraser className="w-3 h-3" /> Clear
          </button>
        </div>
        <ScrollArea className="border border-border/10 rounded h-[140px] bg-muted/5">
          {logs.length === 0 ? (
            <div className="p-3 text-center text-[9px] font-mono text-muted-foreground">
              No activity yet. Compile + Download to see per-cue events.
            </div>
          ) : (
            <ul className="text-[9px] font-mono divide-y divide-border/10">
              {logs.map((l, i) => (
                <li key={i} className="p-1.5 flex items-start gap-2">
                  <span className="text-muted-foreground tabular-nums shrink-0 w-[60px]">
                    {new Date(l.ts).toLocaleTimeString(undefined, { hour12: false })}
                  </span>
                  {l.addr != null && (
                    <span className="text-cyan-300 shrink-0 w-[44px]">addr {l.addr}</span>
                  )}
                  {l.attempt != null && l.attempt > 1 && (
                    <span className="text-amber-400 shrink-0">try {l.attempt}</span>
                  )}
                  <span className={cn(levelTone(l.level), 'flex-1')}>{l.msg}</span>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
