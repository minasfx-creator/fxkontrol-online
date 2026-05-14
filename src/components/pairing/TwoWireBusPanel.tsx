/**
 * TwoWireBusPanel — Pair + scan the 2-Wire CDS bus, surfacing live
 * telemetry, last sweep timing, and per-address sweep progress.
 *
 * Honest hardware layer: nothing is synthesised. State starts disconnected
 * and the scan list is empty until IDENTIFY replies arrive. The "Test
 * continuity sweep" button is Hold-to-Confirm 800ms and is a *read-only*
 * IDENTIFY ping — it NEVER fires, energises or arms anything.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TwoWireTransport, type TwoWireLinkHealth } from '@/lib/twoWireTransport';
import {
  scanBus,
  type TwoWireDiscoveredModule,
  type ScanBusProgress,
} from '@/lib/twoWireBusDiscovery';
import { useWorkMode } from '@/lib/workMode';
import {
  appendScanHistory,
  clearScanHistory,
  diffScans,
  loadScanHistory,
  type ScanHistoryEntry,
} from '@/lib/twoWireScanHistory';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Cable, Search, Zap, AlertTriangle, CheckCircle2, Activity, XCircle, History, Trash2, Server } from 'lucide-react';

type SerialApi = { requestPort: (opts?: unknown) => Promise<unknown> };

const HOLD_MS = 800;

function provenanceFor(workMode: string, connected: boolean): {
  label: string; tone: 'sync' | 'ok' | 'warn';
} {
  if (!connected) return { label: 'NO HARDWARE', tone: 'warn' };
  if (workMode === 'real_operation') return { label: 'LIVE', tone: 'ok' };
  return { label: 'LIVE READ-ONLY', tone: 'sync' };
}

function toneClasses(tone: 'sync' | 'ok' | 'warn'): string {
  if (tone === 'ok') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (tone === 'warn') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
}

function moduleHealthTone(m: TwoWireDiscoveredModule, ageMs: number | null):
  'ok' | 'warn' | 'fail' | 'idle' {
  if (m.status === 'collision') return 'fail';
  if (m.status === 'unseen') return 'idle';
  if (ageMs == null) return 'ok';
  if (ageMs > 30_000) return 'warn';
  return 'ok';
}

function fmtAge(ts: number | undefined, now: number): string {
  if (!ts) return '—';
  const s = Math.round((now - ts) / 1000);
  if (s < 1) return 'now';
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

export interface TwoWireBusPanelProps {
  /** Test injection. Default = real WebSerial. */
  transportFactory?: () => TwoWireTransport;
  /** Test injection. Default = `navigator.serial`. */
  serialApi?: SerialApi;
  /** Test injection. Default = real `scanBus`. */
  scan?: typeof scanBus;
}

interface LastSweep {
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  liveCount: number;
  unseenCount: number;
}

export default function TwoWireBusPanel({
  transportFactory,
  serialApi,
  scan = scanBus,
}: TwoWireBusPanelProps = {}) {
  const workMode = useWorkMode();
  const transportRef = useRef<TwoWireTransport | null>(null);
  const [health, setHealth] = useState<TwoWireLinkHealth | null>(null);
  const [hubLabel, setHubLabel] = useState<string | null>(null);
  const [modules, setModules] = useState<TwoWireDiscoveredModule[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [scanProgress, setScanProgress] = useState<ScanBusProgress | null>(null);
  const [lastSweep, setLastSweep] = useState<LastSweep | null>(null);
  const [history, setHistory] = useState<ScanHistoryEntry[]>(() => loadScanHistory());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const holdStartRef = useRef<number | null>(null);
  const holdRafRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cleanup transport on unmount
  useEffect(() => {
    return () => {
      const t = transportRef.current;
      if (t) void t.close();
      if (holdRafRef.current != null) cancelAnimationFrame(holdRafRef.current);
      abortRef.current?.abort();
    };
  }, []);

  // Refresh "ago" labels every second.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const handleConnect = useCallback(async () => {
    setError(null);
    try {
      const factory = transportFactory ?? (() => new TwoWireTransport());
      const transport = factory();
      const unsub = transport.onHealthChange(setHealth);
      const api = serialApi ?? (navigator as unknown as { serial?: SerialApi }).serial;
      if (!api) {
        setError('WebSerial not supported on this browser.');
        unsub();
        return;
      }
      const port = await api.requestPort({}) as Parameters<TwoWireTransport['open']>[0];
      // PSK is loaded from secure storage in production; design surface uses zero-key.
      await transport.open(port, { psk: new Uint8Array(32), baudRate: 9600 });
      transportRef.current = transport;
      setHealth(transport.getHealth());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [transportFactory, serialApi]);

  const handleDisconnect = useCallback(async () => {
    abortRef.current?.abort();
    const t = transportRef.current;
    if (!t) return;
    await t.close();
    transportRef.current = null;
    setHealth(null);
    setModules([]);
    setScanProgress(null);
  }, []);

  const handleScan = useCallback(async () => {
    const t = transportRef.current;
    if (!t) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setScanning(true);
    setError(null);
    setScanProgress(null);
    try {
      const result = await scan(t, {
        signal: ac.signal,
        onProgress: (p) => setScanProgress(p),
      });
      setModules(result.modules);
      setLastSweep({
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        durationMs: result.durationMs,
        liveCount: result.modules.filter(m => m.status === 'live').length,
        unseenCount: result.modules.filter(m => m.status === 'unseen').length,
      });
    } catch (err) {
      if (!ac.signal.aborted) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setScanning(false);
      setScanProgress(null);
    }
  }, [scan]);

  const cancelScan = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Hold-to-Confirm 800ms for the read-only sweep
  const startHold = useCallback(() => {
    if (!transportRef.current) return;
    holdStartRef.current = performance.now();
    const tick = () => {
      const start = holdStartRef.current;
      if (start == null) return;
      const elapsed = performance.now() - start;
      const pct = Math.min(1, elapsed / HOLD_MS);
      setHoldProgress(pct);
      if (pct >= 1) {
        holdStartRef.current = null;
        setHoldProgress(0);
        void handleScan();
        return;
      }
      holdRafRef.current = requestAnimationFrame(tick);
    };
    holdRafRef.current = requestAnimationFrame(tick);
  }, [handleScan]);

  const cancelHold = useCallback(() => {
    holdStartRef.current = null;
    setHoldProgress(0);
    if (holdRafRef.current != null) cancelAnimationFrame(holdRafRef.current);
  }, []);

  const connected = health?.state === 'connected';
  const prov = provenanceFor(workMode, connected);
  const live = modules.filter(m => m.status === 'live');
  const unseen = modules.filter(m => m.status === 'unseen').length;
  const collisions = modules.filter(m => m.status === 'collision').length;

  const lastEventAge = useMemo(() => {
    if (!health?.lastEventTs) return null;
    return now - health.lastEventTs;
  }, [health, now]);

  const stale = connected && lastEventAge != null && lastEventAge > 1500;

  return (
    <div
      className="flex flex-col h-full p-4 gap-3 bg-background/80 text-foreground"
      data-testid="two-wire-bus-panel"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cable className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold tracking-widest uppercase">
            2-Wire CDS Bus
          </span>
        </div>
        <span
          className={cn('text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border', toneClasses(prov.tone))}
          data-testid="provenance-badge"
        >
          {prov.label}
        </span>
      </div>

      {/* Telemetry chips row */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px] font-mono"
        data-testid="telemetry-chips"
      >
        <div className="border border-border/20 rounded p-2 bg-muted/10">
          <div className="text-muted-foreground">Link</div>
          <div className={cn(
            'text-[10px] font-bold',
            connected ? (stale ? 'text-amber-400' : 'text-emerald-400') : 'text-muted-foreground',
          )}>
            {health?.state ?? 'disconnected'}{stale ? ' · stale' : ''}
          </div>
        </div>
        <div className="border border-border/20 rounded p-2 bg-muted/10">
          <div className="text-muted-foreground">TX ok / err</div>
          <div className="text-[10px] font-bold text-foreground">
            <span className="text-emerald-400">{health?.txOk ?? 0}</span>
            {' / '}
            <span className={cn((health?.txErr ?? 0) > 0 ? 'text-red-400' : 'text-muted-foreground')}>
              {health?.txErr ?? 0}
            </span>
          </div>
        </div>
        <div className="border border-border/20 rounded p-2 bg-muted/10">
          <div className="text-muted-foreground">CRC err 60s</div>
          <div className={cn(
            'text-[10px] font-bold',
            (health?.crcErrorRate60s ?? 0) > 0.01 ? 'text-amber-400' : 'text-emerald-400',
          )}>
            {((health?.crcErrorRate60s ?? 0) * 100).toFixed(2)}%
          </div>
        </div>
        <div className="border border-border/20 rounded p-2 bg-muted/10">
          <div className="text-muted-foreground">Last event</div>
          <div className="text-[10px] font-bold text-foreground">
            {lastEventAge == null ? '—' : `${Math.round(lastEventAge)}ms`}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!connected ? (
          <Button
            size="sm"
            onClick={handleConnect}
            className="h-7 text-[10px] font-mono gap-1"
            data-testid="connect-btn"
          >
            <Zap className="w-3 h-3" /> Connect 2-Wire
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={handleDisconnect}
            className="h-7 text-[10px] font-mono gap-1"
            data-testid="disconnect-btn"
          >
            Disconnect
          </Button>
        )}
        <button
          type="button"
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          disabled={!connected || scanning}
          data-testid="hold-scan-btn"
          aria-label="Hold to test continuity sweep"
          className={cn(
            'relative overflow-hidden h-7 px-3 rounded border text-[10px] font-mono inline-flex items-center gap-1',
            'border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10',
            'disabled:opacity-30 disabled:cursor-not-allowed',
          )}
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 bg-cyan-500/30"
            style={{ width: `${holdProgress * 100}%` }}
          />
          <Search className="w-3 h-3 relative z-10" />
          <span className="relative z-10">
            {scanning ? 'Scanning…' : 'Hold to Sweep'}
          </span>
        </button>
        {scanning && (
          <Button
            size="sm"
            variant="ghost"
            onClick={cancelScan}
            className="h-7 text-[10px] font-mono gap-1 text-red-400 hover:text-red-300"
            data-testid="cancel-scan-btn"
          >
            <XCircle className="w-3 h-3" /> Cancel
          </Button>
        )}
        <span className="text-[9px] font-mono text-muted-foreground ml-auto" data-testid="last-sweep">
          {lastSweep
            ? `last sweep ${fmtAge(lastSweep.finishedAt, now)} · ${lastSweep.durationMs}ms · ${lastSweep.liveCount} live`
            : 'no sweep yet'}
        </span>
      </div>

      {/* Sweep progress bar */}
      {scanning && scanProgress && (
        <div className="border border-cyan-500/20 rounded p-2 bg-cyan-500/5" data-testid="scan-progress">
          <div className="flex items-center justify-between text-[9px] font-mono mb-1">
            <span className="text-cyan-400 inline-flex items-center gap-1">
              <Activity className="w-3 h-3 animate-pulse" />
              Sweeping addr {scanProgress.addr} ({scanProgress.index + 1}/{scanProgress.total})
            </span>
            <span className="text-muted-foreground">
              {scanProgress.module.status === 'live'
                ? `→ live ${scanProgress.module.fwVersion ?? ''}`
                : `→ ${scanProgress.module.status}`}
            </span>
          </div>
          <div className="h-1 bg-muted/30 rounded overflow-hidden">
            <div
              className="h-full bg-cyan-500/60 transition-[width] duration-150"
              style={{ width: `${((scanProgress.index + 1) / scanProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div
          className="border border-red-500/30 rounded p-2 bg-red-500/5 text-[9px] font-mono text-red-400 flex items-start gap-1"
          data-testid="scan-error"
        >
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground">
        <span>Live: <span className="text-emerald-400">{live.length}</span></span>
        <span>Unseen: <span className="text-foreground">{unseen}</span></span>
        <span>Collision: <span className={cn(collisions > 0 ? 'text-red-400' : 'text-foreground')}>{collisions}</span></span>
      </div>

      <ScrollArea className="flex-1 border border-border/10 rounded">
        <table className="w-full text-[10px] font-mono">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="text-left p-2 w-12">Addr</th>
              <th className="text-left p-2 w-20">Health</th>
              <th className="text-left p-2 w-20">Status</th>
              <th className="text-left p-2 w-24">Type</th>
              <th className="text-left p-2 w-24">FW</th>
              <th className="text-left p-2">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {modules.length === 0 ? (
              <tr><td colSpan={6} className="p-3 text-center text-muted-foreground">
                {connected ? 'Hold the sweep button to discover modules.' : 'Not connected.'}
              </td></tr>
            ) : modules.map(m => {
              const ageMs = m.lastSeenTs ? now - m.lastSeenTs : null;
              const tone = moduleHealthTone(m, ageMs);
              const dotClass = tone === 'ok' ? 'bg-emerald-400'
                : tone === 'warn' ? 'bg-amber-400'
                : tone === 'fail' ? 'bg-red-400'
                : 'bg-muted-foreground/40';
              return (
                <tr key={m.addr} className="border-t border-border/10">
                  <td className="p-2">{m.addr}</td>
                  <td className="p-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn('w-1.5 h-1.5 rounded-full', dotClass)} />
                      <span className="capitalize text-muted-foreground">{tone}</span>
                    </span>
                  </td>
                  <td className="p-2">
                    {m.status === 'live' ? (
                      <span className="text-emerald-400 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> live
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{m.status}</span>
                    )}
                  </td>
                  <td className="p-2 text-foreground">{m.deviceType ?? '—'}</td>
                  <td className="p-2 text-foreground">{m.fwVersion ?? '—'}</td>
                  <td className="p-2 text-muted-foreground">{fmtAge(m.lastSeenTs, now)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}
