/**
 * ─── Real Discovery Probe ──────────────────────────────────────────
 * Public diagnostic page that runs the unified discovery pipeline in a
 * loop and renders, in real time, every device the browser actually
 * sees. Zero simulations, zero synthetic events.
 *
 * Now powered by the `deviceAggregator` so each physical device is shown
 * once with chips for every transport it's reachable on (Web Serial,
 * WebUSB, BLE, Art-Net). Operator can pin a preferred transport per
 * device; automatic fallback is surfaced when the active link drops.
 *
 * Route: /dev/real-discovery — public (mounted outside ProtectedRoute).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { unifiedDiscovery } from '@/core/discovery/UnifiedDiscoveryService';
import { deviceAggregator } from '@/core/discovery/DeviceAggregator';
import { multiTransportRegistry } from '@/core/discovery/multiTransportRegistry';
import type {
  DiscoveryEvent,
  DiscoveryTransport,
  LinkMode,
  MultiTransportLinkSnapshot,
  PhysicalDevice,
  PhysicalDeviceEvent,
} from '@/core/discovery/types';
import { realOnlyGate } from '@/core/hardware/realOnlyGate';
import { isRealOnlyMode, isHardwareSimulatorEnabled } from '@/lib/featureFlags';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  ArrowLeft, RefreshCw, Radio, Usb, Bluetooth, Network,
  ShieldCheck, ShieldAlert, Pin, PinOff, ArrowRightLeft, Send, Layers,
} from 'lucide-react';

const TRANSPORTS: { id: DiscoveryTransport; label: string; short: string; icon: typeof Usb }[] = [
  { id: 'webserial', label: 'Web Serial', short: 'Serial', icon: Usb },
  { id: 'webusb', label: 'WebUSB', short: 'USB', icon: Usb },
  { id: 'webble', label: 'Web Bluetooth', short: 'BLE', icon: Bluetooth },
  { id: 'mdns-artnet', label: 'Art-Net (mDNS)', short: 'Art-Net', icon: Network },
];

const TRANSPORT_LABEL: Record<DiscoveryTransport, string> = {
  webserial: 'Serial',
  webusb: 'USB',
  webble: 'BLE',
  'mdns-artnet': 'Art-Net',
};

interface LogLine {
  id: number;
  at: number;
  type: DiscoveryEvent['type'] | PhysicalDeviceEvent['type'];
  label: string;
  detail: string;
}

export default function RealDiscoveryProbe() {
  const [physicals, setPhysicals] = useState<PhysicalDevice[]>([]);
  const [log, setLog] = useState<LogLine[]>([]);
  const [scanning, setScanning] = useState(false);
  const [autoLoop, setAutoLoop] = useState(true);
  const [intervalMs, setIntervalMs] = useState(3000);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshMs, setRefreshMs] = useState(1000);
  const [tick, setTick] = useState(0);
  const logIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const support = useMemo(() => unifiedDiscovery.supportMatrix(), []);
  const realOnly = isRealOnlyMode();
  const simulatorOn = isHardwareSimulatorEnabled();

  const refreshDevices = () => {
    if (!mountedRef.current) return;
    setPhysicals(deviceAggregator.getDevices());
  };

  // ── Subscribe to aggregator stream ──────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    setPhysicals(deviceAggregator.getDevices());

    const off = deviceAggregator.watch((ev) => {
      if (!mountedRef.current) return;
      refreshDevices();
      setLog((prev) => {
        const detail =
          ev.type === 'promoted'
            ? `${ev.previousActive ?? '∅'} → ${ev.transport ?? '?'}`
            : ev.transport
              ? TRANSPORT_LABEL[ev.transport]
              : `${Object.keys(ev.device.links).length} link(s)`;
        const next: LogLine = {
          id: ++logIdRef.current,
          at: Date.now(),
          type: ev.type,
          label: ev.device.label,
          detail,
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
        /* swallow — scanLight already logs internally */
      } finally {
        if (mountedRef.current) {
          setScanning(false);
          setTick((t) => t + 1);
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

  // ── Auto-refresh: pulls fresh aggregator state + metrics WITHOUT
  // re-running discovery scans. Lightweight UI tick only.
  useEffect(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (!autoRefresh) return;
    const pull = () => {
      if (!mountedRef.current) return;
      refreshDevices();
      setTick((t) => t + 1);
    };
    refreshTimerRef.current = setInterval(pull, Math.max(250, refreshMs));
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [autoRefresh, refreshMs]);

  const gateStats = realOnlyGate.getStats();
  void tick;

  const totalLinks = useMemo(
    () => physicals.reduce((sum, p) => sum + Object.keys(p.links).length, 0),
    [physicals],
  );

  // ── Multi-transport aggregation breakdown ──────────────────────
  // Buckets devices by how many distinct transports reach them, and
  // singles out the ones that are reachable on 2+ links — that's the
  // exact case the aggregator is designed to surface.
  const aggregationStats = useMemo(() => {
    const byLinkCount = new Map<number, number>(); // linkCount → device count
    let multi = 0;
    let multiOnline = 0;
    for (const p of physicals) {
      const n = Object.keys(p.links).length;
      byLinkCount.set(n, (byLinkCount.get(n) ?? 0) + 1);
      if (n >= 2) {
        multi += 1;
        const onlineCount = Object.values(p.links).filter((l) => l?.online).length;
        if (onlineCount >= 2) multiOnline += 1;
      }
    }
    return { byLinkCount, multi, multiOnline };
  }, [physicals]);

  // Multi-transport devices first (2+ links), then by lastSeen desc.
  const sortedPhysicals = useMemo(() => {
    return [...physicals].sort((a, b) => {
      const al = Object.keys(a.links).length;
      const bl = Object.keys(b.links).length;
      if (al !== bl) return bl - al;
      return b.lastSeen - a.lastSeen;
    });
  }, [physicals]);

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
              {scanning ? 'Scanning…' : 'Idle'} · {physicals.length} physical · {totalLinks} link(s)
              {aggregationStats.multi > 0 && (
                <> · <span className="text-primary font-medium">{aggregationStats.multi} multi-transport</span>
                {aggregationStats.multiOnline > 0 && (
                  <span className="text-muted-foreground"> ({aggregationStats.multiOnline} online)</span>
                )}</>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Devices are aggregated across transports — the same controller seen on Web Serial AND WebUSB
            (or BLE + USB) appears as a single card with one chip per transport. Click a chip to pin the
            preferred transport; automatic fallback kicks in if the active link drops.
          </p>
        </Card>

        {/* ── Support Matrix ─────────────────────────────────── */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Transport support matrix</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TRANSPORTS.map(({ id, label, icon: Icon }) => {
              const ok = support[id];
              const count = physicals.reduce((n, p) => n + (p.links[id] ? 1 : 0), 0);
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
                    <span className="text-muted-foreground">{count} link(s)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Multi-transport aggregation breakdown ─────────── */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="text-sm font-semibold inline-flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Multi-transport aggregation
            </h2>
            <span className="text-[11px] text-muted-foreground">
              real-only · no synthetic events
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Single-link devices" value={aggregationStats.byLinkCount.get(1) ?? 0} tone="ok" />
            <Stat label="Multi-transport (2+)" value={aggregationStats.multi} tone="ok" />
            <Stat label="Multi online (≥2 online)" value={aggregationStats.multiOnline} tone="ok" />
            <Stat label="Total physical devices" value={physicals.length} tone="ok" />
          </div>
          {aggregationStats.multi > 0 ? (
            <div className="mt-3 space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Devices reachable on multiple transports
              </div>
              {sortedPhysicals
                .filter((p) => Object.keys(p.links).length >= 2)
                .map((p) => {
                  const links = TRANSPORTS.filter((t) => p.links[t.id]);
                  return (
                    <div
                      key={p.aggregateId}
                      className="flex items-center gap-2 text-xs border border-border rounded-md px-2 py-1.5 bg-card/30"
                    >
                      <span className="truncate font-medium flex-1 min-w-0">{p.label}</span>
                      <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[200px]">
                        {p.aggregateId}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        {links.map(({ id, short, icon: Icon }) => {
                          const l = p.links[id]!;
                          const isActive = p.activeTransport === id;
                          return (
                            <span
                              key={id}
                              className={[
                                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] border',
                                isActive
                                  ? 'border-primary bg-primary/15 text-primary'
                                  : l.online
                                    ? 'border-border bg-muted/30'
                                    : 'border-destructive/30 bg-destructive/5 text-muted-foreground',
                              ].join(' ')}
                              title={`${short} · ${l.online ? 'online' : 'offline'}${
                                isActive ? ' · active' : ''
                              }`}
                            >
                              <Icon className="h-2.5 w-2.5" />
                              {short}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              No physical device is currently reachable on more than one transport. Plug the same
              controller on Web Serial AND WebUSB (or expose it on Art-Net + USB) to see aggregation here.
            </p>
          )}
        </Card>

        {/* ── Physical devices ───────────────────────────────── */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">
            Physical devices ({physicals.length})
            {aggregationStats.multi > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                — multi-transport listed first
              </span>
            )}
          </h2>
          {physicals.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              No real device detected yet.
              <br />
              <span className="text-xs">
                Plug in hardware and authorize it once via{' '}
                <Link to="/pairing/usb" className="underline">/pairing/usb</Link>.
                After that, this loop will see it on every scan.
              </span>
            </div>
          ) : (
            <div className="grid gap-3">
              {sortedPhysicals.map((dev) => (
                <PhysicalDeviceCard key={dev.aggregateId} device={dev} />
              ))}
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
        </Card>

        {/* ── Event log ──────────────────────────────────────── */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Aggregator event log</h2>
          {log.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">
              No events yet — events appear here as devices appear, change, are promoted or disappear.
            </div>
          ) : (
            <ol className="space-y-1 max-h-80 overflow-auto pr-2 text-xs font-mono">
              {log.map((l) => (
                <li key={l.id} className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0 w-20">
                    {new Date(l.at).toLocaleTimeString()}
                  </span>
                  <Badge
                    variant={
                      l.type === 'lost' || l.type === 'link-lost' || l.type === 'removed'
                        ? 'destructive'
                        : l.type === 'promoted'
                          ? 'default'
                          : 'secondary'
                    }
                    className="text-[10px] w-24 justify-center shrink-0"
                  >
                    {l.type}
                  </Badge>
                  <span className="text-muted-foreground shrink-0 w-24">{l.detail}</span>
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

function PhysicalDeviceCard({ device }: { device: PhysicalDevice }) {
  const linkEntries = TRANSPORTS.filter((t) => device.links[t.id]);
  const promoted = device.lastPromotion;

  // Multi-transport coordinator for this device.
  const link = useMemo(
    () => multiTransportRegistry.getOrCreate(device.aggregateId),
    [device.aggregateId],
  );
  const [snap, setSnap] = useState<MultiTransportLinkSnapshot>(() => link.getSnapshot());
  const [pinging, setPinging] = useState(false);

  useEffect(() => {
    setSnap(link.getSnapshot());
    return link.watch(() => setSnap(link.getSnapshot()));
  }, [link]);

  const handlePin = (t: DiscoveryTransport) => {
    if (device.preferredTransport === t) {
      deviceAggregator.clearPreferredTransport(device.aggregateId);
    } else {
      deviceAggregator.setPreferredTransport(device.aggregateId, t);
    }
  };

  const handleMode = (mode: LinkMode) => link.setMode(mode);

  const handlePing = async () => {
    setPinging(true);
    try {
      await link.dispatch({ kind: 'ping', meta: { source: 'real-discovery-probe' } });
    } finally {
      setPinging(false);
    }
  };

  return (
    <div className="rounded-md border border-border bg-card/50 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium truncate">{device.label}</div>
          <div className="text-xs text-muted-foreground font-mono truncate">
            {device.aggregateId}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge variant={device.online ? 'default' : 'secondary'} className="text-[10px]">
            {device.online ? 'online' : 'offline'}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {linkEntries.length} transport(s)
          </span>
        </div>
      </div>

      {/* Transport chips with per-link health */}
      <div className="mt-3 flex flex-wrap gap-2">
        {linkEntries.map(({ id, short, icon: Icon }) => {
          const linkData = device.links[id]!;
          const isActive = device.activeTransport === id;
          const isPreferred = device.preferredTransport === id;
          const isParticipant = snap.participants.includes(id);
          const health = snap.health[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => handlePin(id)}
              className={[
                'inline-flex flex-col items-start gap-1 px-2.5 py-1.5 rounded-md border text-xs transition-colors min-w-[120px]',
                isActive
                  ? 'border-primary bg-primary/15 text-primary'
                  : isParticipant
                    ? 'border-primary/40 bg-primary/5'
                    : linkData.online
                      ? 'border-border bg-muted/30 hover:bg-muted/60'
                      : 'border-destructive/30 bg-destructive/5 text-muted-foreground',
              ].join(' ')}
              title={
                isPreferred
                  ? `Preferred: ${short}. Click to clear.`
                  : `Pin ${short} as preferred transport.`
              }
            >
              <span className="inline-flex items-center gap-1.5">
                <Icon className="h-3 w-3" />
                <span className="font-medium">{short}</span>
                {isActive && <Badge variant="outline" className="text-[9px]">active</Badge>}
                {isParticipant && !isActive && (
                  <Badge variant="outline" className="text-[9px]">tx</Badge>
                )}
                {isPreferred ? (
                  <Pin className="h-3 w-3 text-primary" />
                ) : (
                  <PinOff className="h-3 w-3 opacity-30" />
                )}
                {!linkData.online && <span className="text-[9px] uppercase">offline</span>}
              </span>
              {health && (health.txOk > 0 || health.txErr > 0) && (
                <span className="text-[10px] font-mono text-muted-foreground">
                  ok {health.txOk} · err {health.txErr} · {health.latencyMs.toFixed(1)}ms
                  {health.status === 'fail' && <span className="text-destructive"> ⚠</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Concurrency mode + ping */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Layers className="h-3 w-3" /> Mode:
        </span>
        {(['single', 'dual', 'broadcast'] as LinkMode[]).map((m) => (
          <Button
            key={m}
            type="button"
            size="sm"
            variant={snap.mode === m ? 'default' : 'outline'}
            className="h-6 px-2 text-[11px] capitalize"
            onClick={() => handleMode(m)}
          >
            {m}
          </Button>
        ))}
        <span className="text-[11px] text-muted-foreground ml-1">
          → {snap.participants.length} participant(s)
        </span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="ml-auto h-6 px-2 text-[11px] gap-1"
          onClick={handlePing}
          disabled={pinging || snap.participants.length === 0}
        >
          <Send className={`h-3 w-3 ${pinging ? 'animate-pulse' : ''}`} />
          Send test ping
        </Button>
      </div>

      {snap.lastDispatch && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          Last dispatch:{' '}
          <span className={snap.lastDispatch.failCount > 0 ? 'text-amber-500' : 'text-primary'}>
            {snap.lastDispatch.okCount}/{snap.lastDispatch.okCount + snap.lastDispatch.failCount} OK
          </span>{' '}
          · {snap.lastDispatch.avgLatencyMs.toFixed(1)}ms avg ·{' '}
          {new Date(snap.lastDispatch.at).toLocaleTimeString()}
        </div>
      )}

      {/* Per-transport metrics table */}
      <TransportMetricsTable device={device} snap={snap} />

      {/* Identity row */}
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {typeof device.vendorId === 'number' && (
          <span>VID: <code className="font-mono">0x{device.vendorId.toString(16).padStart(4, '0')}</code></span>
        )}
        {typeof device.productId === 'number' && (
          <span>PID: <code className="font-mono">0x{device.productId.toString(16).padStart(4, '0')}</code></span>
        )}
        {device.serialNumber && <span>S/N: <code className="font-mono">{device.serialNumber}</code></span>}
        {device.host && <span>host: {device.host}</span>}
        <span>last seen: {new Date(device.lastSeen).toLocaleTimeString()}</span>
      </div>

      {/* Promotion banner */}
      {promoted && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-primary">
          <ArrowRightLeft className="h-3 w-3" />
          <span>
            Promoted <code className="font-mono">{promoted.from ?? '∅'}</code> →{' '}
            <code className="font-mono">{promoted.to}</code> ({promoted.reason}) at{' '}
            {new Date(promoted.at).toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
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

function TransportMetricsTable({
  device,
  snap,
}: {
  device: PhysicalDevice;
  snap: MultiTransportLinkSnapshot;
}) {
  const rows = TRANSPORTS.filter((t) => device.links[t.id] || snap.health[t.id]);
  if (rows.length === 0) return null;

  const fmtAgo = (ts: number) => {
    if (!ts) return '—';
    const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    return `${Math.floor(sec / 3600)}h ago`;
  };

  return (
    <div className="mt-3 rounded-md border border-border overflow-hidden">
      <div className="bg-muted/30 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground grid grid-cols-12 gap-2">
        <div className="col-span-2">Transport</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-1 text-right">OK</div>
        <div className="col-span-1 text-right">Timeout</div>
        <div className="col-span-1 text-right">Errors</div>
        <div className="col-span-2 text-right">Latency (ema/max)</div>
        <div className="col-span-3">Last event</div>
      </div>
      <div className="divide-y divide-border">
        {rows.map(({ id, short, icon: Icon }) => {
          const linkData = device.links[id];
          const h = snap.health[id];
          const isParticipant = snap.participants.includes(id);
          const isActive = device.activeTransport === id;
          // Connection state derived from link presence + health.online flag.
          const connState: 'connected' | 'offline' | 'unseen' =
            !linkData ? 'unseen' : linkData.online ? 'connected' : 'offline';
          const lastFail = h?.lastFailAt ?? 0;
          const lastOk = h?.lastOkAt ?? 0;
          return (
            <div
              key={id}
              className={`px-2 py-1.5 text-[11px] grid grid-cols-12 gap-2 items-center ${
                isActive ? 'bg-primary/5' : ''
              }`}
            >
              <div className="col-span-2 inline-flex items-center gap-1.5 font-medium">
                <Icon className="h-3 w-3" />
                {short}
                {isActive && <Badge variant="outline" className="text-[9px]">active</Badge>}
                {isParticipant && !isActive && (
                  <Badge variant="outline" className="text-[9px]">tx</Badge>
                )}
                {device.quarantinedTransports?.[id] && (
                  <Badge
                    variant="outline"
                    className="text-[9px] border-amber-500/60 text-amber-500"
                    title={device.quarantinedTransports[id]?.reason}
                  >
                    quarantined
                  </Badge>
                )}
              </div>
              <div className="col-span-2">
                <span
                  className={
                    connState === 'connected'
                      ? 'inline-flex items-center gap-1 text-primary'
                      : connState === 'offline'
                        ? 'inline-flex items-center gap-1 text-destructive'
                        : 'inline-flex items-center gap-1 text-muted-foreground'
                  }
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      connState === 'connected'
                        ? 'bg-primary'
                        : connState === 'offline'
                          ? 'bg-destructive'
                          : 'bg-muted-foreground/50'
                    }`}
                    aria-hidden
                  />
                  {connState}
                </span>
              </div>
              <div className="col-span-1 text-right font-mono text-primary">
                {h?.txOk ?? 0}
              </div>
              <div className={`col-span-1 text-right font-mono ${
                (h?.txTimeout ?? 0) > 0 ? 'text-amber-500' : 'text-muted-foreground'
              }`}>
                {h?.txTimeout ?? 0}
              </div>
              <div className={`col-span-1 text-right font-mono ${
                (h?.txErr ?? 0) > 0 ? 'text-destructive' : 'text-muted-foreground'
              }`}>
                {h?.txErr ?? 0}
              </div>
              <div className="col-span-2 text-right font-mono text-muted-foreground">
                {h && (h.txOk + h.txErr + h.txTimeout) > 0
                  ? `${h.latencyMs.toFixed(1)} / ${h.maxLatencyMs.toFixed(1)}ms`
                  : '—'}
              </div>
              <div className="col-span-3 text-muted-foreground inline-flex items-center gap-2">
                {device.quarantinedTransports?.[id] ? (
                  <>
                    <span className="text-amber-500 truncate" title={device.quarantinedTransports[id]?.reason}>
                      ⏸ quarantined ({device.quarantinedTransports[id]?.consecutiveFailures}× fail)
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-5 px-1.5 text-[10px] ml-auto"
                      onClick={() => deviceAggregator.clearQuarantine(device.aggregateId, id)}
                    >
                      retry
                    </Button>
                  </>
                ) : h?.lastError ? (
                  <span className="text-destructive truncate inline-block max-w-full" title={h.lastError}>
                    ⚠ {h.lastError}
                  </span>
                ) : lastOk ? (
                  <span>OK · {fmtAgo(lastOk)}</span>
                ) : lastFail ? (
                  <span className="text-amber-500">fail · {fmtAgo(lastFail)}</span>
                ) : linkData?.lastSeen ? (
                  <span>seen · {fmtAgo(linkData.lastSeen)}</span>
                ) : (
                  '—'
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
