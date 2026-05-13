/**
 * TwoWireBusPanel — Pair + scan the 2-Wire CDS bus.
 *
 * Honest hardware layer: nothing is synthesised. State starts disconnected
 * and the scan list is empty until IDENTIFY replies arrive. The "Test
 * continuity sweep" button is Hold-to-Confirm 800ms and is a *read-only*
 * IDENTIFY ping — it NEVER fires, energises or arms anything.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { TwoWireTransport, type TwoWireLinkHealth } from '@/lib/twoWireTransport';
import { scanBus, type TwoWireDiscoveredModule } from '@/lib/twoWireBusDiscovery';
import { useWorkMode } from '@/lib/workMode';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Cable, Search, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';

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

export interface TwoWireBusPanelProps {
  /** Test injection. Default = real WebSerial. */
  transportFactory?: () => TwoWireTransport;
  /** Test injection. Default = `navigator.serial`. */
  serialApi?: SerialApi;
  /** Test injection. Default = real `scanBus`. */
  scan?: typeof scanBus;
}

export default function TwoWireBusPanel({
  transportFactory,
  serialApi,
  scan = scanBus,
}: TwoWireBusPanelProps = {}) {
  const workMode = useWorkMode();
  const transportRef = useRef<TwoWireTransport | null>(null);
  const [health, setHealth] = useState<TwoWireLinkHealth | null>(null);
  const [modules, setModules] = useState<TwoWireDiscoveredModule[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdStartRef = useRef<number | null>(null);
  const holdRafRef = useRef<number | null>(null);

  // Cleanup transport on unmount
  useEffect(() => {
    return () => {
      const t = transportRef.current;
      if (t) void t.close();
      if (holdRafRef.current != null) cancelAnimationFrame(holdRafRef.current);
    };
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
    const t = transportRef.current;
    if (!t) return;
    await t.close();
    transportRef.current = null;
    setHealth(null);
    setModules([]);
  }, []);

  const handleScan = useCallback(async () => {
    const t = transportRef.current;
    if (!t) return;
    setScanning(true);
    setError(null);
    try {
      const result = await scan(t);
      setModules(result.modules);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }, [scan]);

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

  return (
    <div
      className="flex flex-col h-full p-4 gap-4 bg-background/80 text-foreground"
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
        <span className="text-[9px] font-mono text-muted-foreground ml-auto">
          tx {health?.txOk ?? 0} ok · {health?.txErr ?? 0} err
          {' · '}crc {((health?.crcErrorRate60s ?? 0) * 100).toFixed(1)}%
        </span>
      </div>

      {error && (
        <div className="border border-red-500/30 rounded p-2 bg-red-500/5 text-[9px] font-mono text-red-400 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground">
        <span>Modules live: <span className="text-emerald-400">{live.length}</span></span>
        <span>Unseen: <span className="text-foreground">{unseen}</span></span>
      </div>

      <ScrollArea className="flex-1 border border-border/10 rounded">
        <table className="w-full text-[10px] font-mono">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="text-left p-2 w-12">Addr</th>
              <th className="text-left p-2 w-20">Status</th>
              <th className="text-left p-2 w-24">Type</th>
              <th className="text-left p-2 w-24">FW</th>
              <th className="text-left p-2">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {modules.length === 0 ? (
              <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">
                {connected ? 'Hold the sweep button to discover modules.' : 'Not connected.'}
              </td></tr>
            ) : modules.map(m => (
              <tr key={m.addr} className="border-t border-border/10">
                <td className="p-2">{m.addr}</td>
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
                <td className="p-2 text-muted-foreground">
                  {m.lastSeenTs ? `${Math.round((Date.now() - m.lastSeenTs) / 1000)}s ago` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}
