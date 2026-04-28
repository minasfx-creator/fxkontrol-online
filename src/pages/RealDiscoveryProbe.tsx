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
  const [tick, setTick] = useState(0);
  const logIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  const gateStats = realOnlyGate.getStats();
  void tick;

  const totalLinks = useMemo(
    () => physicals.reduce((sum, p) => sum + Object.keys(p.links).length, 0),
    [physicals],
  );

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

        {/* ── Physical devices ───────────────────────────────── */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">
            Physical devices ({physicals.length})
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
              {physicals.map((dev) => (
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
