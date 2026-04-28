/**
 * ─── Real Discovery Probe ──────────────────────────────────────────
 * Public diagnostic page that runs the unified discovery pipeline in a
 * loop and renders, in real time, every device the browser actually
 * sees. Zero simulations, zero synthetic events:
 *
 *   • Uses ONLY `unifiedDiscovery.scanLight()` — no prompts, no UDP poll.
 *   • Subscribes to the discovery event stream (discovered/updated/lost).
 *   • Surfaces the support matrix per transport (Web Serial / WebUSB /
 *     WebBLE / Art-Net) so an operator instantly sees what the runtime
 *     is even capable of.
 *   • Reports `realOnlyGate` stats so it's obvious that no fake data
 *     is reaching the UI while the page runs.
 *
 * Route: /dev/real-discovery — public (mounted outside ProtectedRoute).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { unifiedDiscovery } from '@/core/discovery/UnifiedDiscoveryService';
import type { DiscoveredDevice, DiscoveryEvent, DiscoveryTransport } from '@/core/discovery/types';
import { realOnlyGate } from '@/core/hardware/realOnlyGate';
import { isRealOnlyMode, isHardwareSimulatorEnabled } from '@/lib/featureFlags';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, RefreshCw, Radio, Usb, Bluetooth, Network, ShieldCheck, ShieldAlert } from 'lucide-react';

const TRANSPORTS: { id: DiscoveryTransport; label: string; icon: typeof Usb }[] = [
  { id: 'webserial', label: 'Web Serial', icon: Usb },
  { id: 'webusb', label: 'WebUSB', icon: Usb },
  { id: 'webble', label: 'Web Bluetooth', icon: Bluetooth },
  { id: 'mdns-artnet', label: 'Art-Net (mDNS)', icon: Network },
];

interface LogLine {
  id: number;
  at: number;
  type: DiscoveryEvent['type'];
  deviceId: string;
  label: string;
  transport: DiscoveryTransport;
}

export default function RealDiscoveryProbe() {
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [log, setLog] = useState<LogLine[]>([]);
  const [scanning, setScanning] = useState(false);
  const [autoLoop, setAutoLoop] = useState(true);
  const [intervalMs, setIntervalMs] = useState(3000);
  const [tick, setTick] = useState(0); // forces gate-stats refresh
  const logIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const support = useMemo(() => unifiedDiscovery.supportMatrix(), []);
  const realOnly = isRealOnlyMode();
  const simulatorOn = isHardwareSimulatorEnabled();

  // ── Subscribe to live discovery events ──────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    setDevices(unifiedDiscovery.getDevices());

    const off = unifiedDiscovery.watch((ev) => {
      if (!mountedRef.current) return;
      setDevices(unifiedDiscovery.getDevices());
      setLog((prev) => {
        const next: LogLine = {
          id: ++logIdRef.current,
          at: Date.now(),
          type: ev.type,
          deviceId: ev.device.id,
          label: ev.device.label,
          transport: ev.device.transport,
        };
        const merged = [next, ...prev];
        return merged.length > 80 ? merged.slice(0, 80) : merged;
      });
    });
    return () => {
      mountedRef.current = false;
      off();
    };
  }, []);

  // ── Loop scanner ────────────────────────────────────────────────
  useEffect(() => {
    if (!autoLoop) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    const run = async () => {
      if (!mountedRef.current) return;
      setScanning(true);
      try {
        await unifiedDiscovery.scanLight();
      } catch {
        // swallow — scanLight already logs internally
      } finally {
        if (mountedRef.current) {
          setScanning(false);
          setTick((t) => t + 1); // refresh gate stats
        }
      }
    };
    void run();
    timerRef.current = setInterval(run, Math.max(500, intervalMs));
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoLoop, intervalMs]);

  const gateStats = realOnlyGate.getStats();
  // gateStats reads change over time; tick is intentionally referenced
  // to trigger a re-render after each loop iteration.
  void tick;

  const grouped = useMemo(() => {
    const m: Record<DiscoveryTransport, DiscoveredDevice[]> = {
      webserial: [],
      webusb: [],
      webble: [],
      'mdns-artnet': [],
    };
    for (const d of devices) m[d.transport]?.push(d);
    return m;
  }, [devices]);

  const triggerOnce = async () => {
    setScanning(true);
    try { await unifiedDiscovery.scanLight(); } finally {
      setScanning(false);
      setTick((t) => t + 1);
    }
  };

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/" aria-label="Back to app">
            <Button size="sm" variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Real Discovery Probe
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant={realOnly ? 'default' : 'secondary'} className="gap-1">
              {realOnly ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
              Real-Only: {realOnly ? 'ON' : 'OFF'}
            </Badge>
            <Badge variant={simulatorOn ? 'destructive' : 'outline'}>
              Simulator: {simulatorOn ? 'ON' : 'OFF'}
            </Badge>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* ── Controls ───────────────────────────────────────── */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="auto-loop" checked={autoLoop} onCheckedChange={setAutoLoop} />
              <label htmlFor="auto-loop" className="text-sm font-medium cursor-pointer">
                Auto loop ({(intervalMs / 1000).toFixed(1)}s)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="interval" className="text-xs text-muted-foreground">
                Interval (ms)
              </label>
              <input
                id="interval"
                type="number"
                min={500}
                step={500}
                value={intervalMs}
                onChange={(e) => setIntervalMs(Math.max(500, Number(e.target.value) || 3000))}
                className="w-24 h-8 rounded-md border border-input bg-background px-2 text-sm"
              />
            </div>
            <Button size="sm" variant="outline" onClick={triggerOnce} disabled={scanning} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
              Scan now
            </Button>
            <div className="ml-auto text-xs text-muted-foreground">
              {scanning ? 'Scanning…' : 'Idle'} · {devices.length} device(s) seen
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            This page calls <code className="font-mono">unifiedDiscovery.scanLight()</code> in a loop. It uses
            only <code>getPorts()</code> / <code>getDevices()</code> APIs — no permission prompts and no synthetic
            data. Devices appear here ONLY if the browser already has authorization for them or if they hot-plug into
            an authorized port.
          </p>
        </Card>

        {/* ── Support Matrix ─────────────────────────────────── */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Transport support matrix</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TRANSPORTS.map(({ id, label, icon: Icon }) => {
              const ok = support[id];
              const count = grouped[id]?.length ?? 0;
              return (
                <div
                  key={id}
                  className={`rounded-lg border p-3 ${
                    ok ? 'border-border bg-card' : 'border-destructive/30 bg-destructive/5'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <Badge variant={ok ? 'default' : 'destructive'} className="text-[10px]">
                      {ok ? 'Supported' : 'Unavailable'}
                    </Badge>
                    <span className="text-muted-foreground">{count} found</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Devices by transport ───────────────────────────── */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Live devices ({devices.length})</h2>
          {devices.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              No real device detected yet.
              <br />
              <span className="text-xs">
                Plug in hardware and authorize it once via <Link to="/pairing/usb" className="underline">/pairing/usb</Link>.
                After that, this loop will see it on every scan.
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              {TRANSPORTS.map(({ id, label }) => {
                const list = grouped[id] ?? [];
                if (list.length === 0) return null;
                return (
                  <section key={id}>
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                      {label} · {list.length}
                    </h3>
                    <div className="grid gap-2">
                      {list.map((d) => (
                        <div
                          key={d.id}
                          className="rounded-md border border-border bg-card/50 p-3 text-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{d.label}</div>
                              <div className="text-xs text-muted-foreground font-mono truncate">
                                {d.id}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <Badge variant={d.online ? 'default' : 'secondary'} className="text-[10px]">
                                {d.online ? 'online' : 'offline'}
                              </Badge>
                              {d.authorized && (
                                <Badge variant="outline" className="text-[10px]">authorized</Badge>
                              )}
                              {d.recognized && (
                                <Badge variant="outline" className="text-[10px]">recognized</Badge>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                            {typeof d.vendorId === 'number' && (
                              <span>VID: <code className="font-mono">0x{d.vendorId.toString(16).padStart(4, '0')}</code></span>
                            )}
                            {typeof d.productId === 'number' && (
                              <span>PID: <code className="font-mono">0x{d.productId.toString(16).padStart(4, '0')}</code></span>
                            )}
                            {d.host && <span>host: {d.host}</span>}
                            {d.family && <span>family: {d.family}</span>}
                            <span>last seen: {new Date(d.lastSeen).toLocaleTimeString()}</span>
                          </div>
                          {d.lastError && (
                            <div className="mt-2 text-[11px] text-destructive">
                              ⚠ {d.lastError.message}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── Real-Only Gate Stats ──────────────────────────── */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Real-Only emission gate</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Snapshots accepted" value={gateStats.acceptedSnapshots} tone="ok" />
            <Stat label="Snapshots rejected" value={gateStats.rejectedSnapshots} tone="warn" />
            <Stat label="Events accepted" value={gateStats.acceptedEvents} tone="ok" />
            <Stat label="Events rejected" value={gateStats.rejectedEvents} tone="warn" />
          </div>
          {gateStats.lastRejectedDeviceId && (
            <div className="mt-3 text-xs text-muted-foreground">
              Last rejection: <code className="font-mono">{gateStats.lastRejectedDeviceId}</code>{' '}
              at {new Date(gateStats.lastRejectedAt).toLocaleTimeString()}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Rejected counters confirm that telemetry from <code>not_integrated</code> adapters is being
            blocked at the gate. With no real hardware connected, all four counters should remain at zero.
          </p>
        </Card>

        {/* ── Event log ──────────────────────────────────────── */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Discovery event log (most recent first)</h2>
          {log.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">
              No events yet — events appear here as devices appear, change or disappear.
            </div>
          ) : (
            <ol className="space-y-1 max-h-80 overflow-auto pr-2 text-xs font-mono">
              {log.map((l) => (
                <li key={l.id} className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0 w-20">
                    {new Date(l.at).toLocaleTimeString()}
                  </span>
                  <Badge
                    variant={l.type === 'lost' ? 'destructive' : l.type === 'updated' ? 'secondary' : 'default'}
                    className="text-[10px] w-20 justify-center shrink-0"
                  >
                    {l.type}
                  </Badge>
                  <span className="text-muted-foreground shrink-0 w-24">{l.transport}</span>
                  <span className="truncate">{l.label}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'warn' }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${tone === 'warn' && value > 0 ? 'text-amber-500' : 'text-foreground'}`}>
        {value}
      </div>
    </div>
  );
}
