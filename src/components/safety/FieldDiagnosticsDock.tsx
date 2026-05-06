/**
 * ─── FieldDiagnosticsDock — Read-only multi-transport panel ────────
 * Sticky surface mounted under the GlobalSafetyBar. Renders one row
 * per active PhysicalDevice with: kind / label / transports[] (online
 * dot + last latency) / heartbeat age / provenance badge.
 *
 * STRICT RULES:
 *   • Read-only. NO uiCommandGateway / fieldBus / executor /
 *     SafetyStateMachine.transition / workMode.set imports.
 *   • Hidden in /command and /pairing/* (modal focus paths).
 *   • Default collapsed; operator opens via chevron.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, ChevronUp, Activity, RadioTower } from 'lucide-react';
import { cn } from '@/lib/utils';
import { deviceAggregator } from '@/core/discovery/DeviceAggregator';
import type { PhysicalDevice, DiscoveryTransport } from '@/core/discovery/types';
import { resolveControllerProfile } from '@/core/discovery/controllerRegistry';
import ProvenanceBadge from '@/components/safety/ProvenanceBadge';

const HIDDEN_PREFIXES = ['/command', '/pairing'];

const TRANSPORT_LABEL: Record<DiscoveryTransport, string> = {
  webserial: 'SER',
  webusb: 'USB',
  webble: 'BLE',
  'mdns-artnet': 'ART',
};

function ageLabel(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return '<1s';
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  return `${Math.floor(ms / 3_600_000)}h`;
}

interface DeviceRow {
  device: PhysicalDevice;
  kindLabel: string;
  provMode: 'live_read_only' | 'simulated' | 'replay' | 'not_integrated';
}

function buildRows(devices: PhysicalDevice[]): DeviceRow[] {
  return devices.map(d => {
    const profile = resolveControllerProfile(d);
    const anyLink = Object.values(d.links).find(Boolean);
    // Provenance heuristic: if any link is online → live_read_only,
    // otherwise not_integrated. We do not invent simulated here.
    const provMode: DeviceRow['provMode'] = d.online ? 'live_read_only' : 'not_integrated';
    return {
      device: d,
      kindLabel: profile?.label ?? anyLink?.family ?? 'Unknown device',
      provMode,
    };
  });
}

export default function FieldDiagnosticsDock() {
  const { pathname } = useLocation();
  const hidden = HIDDEN_PREFIXES.some(p => pathname.startsWith(p));
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [devices, setDevices] = useState<PhysicalDevice[]>(() => {
    try { return deviceAggregator.getDevices?.() ?? []; } catch { return []; }
  });

  useEffect(() => {
    if (hidden) return;
    let unsub: (() => void) | undefined;
    try {
      unsub = deviceAggregator.watch?.(() => {
        setDevices(deviceAggregator.getDevices?.() ?? []);
      });
    } catch { /* tests without aggregator */ }
    const id = setInterval(() => setTick(n => n + 1), 1000);
    return () => { unsub?.(); clearInterval(id); };
  }, [hidden]);

  const rows = useMemo(() => buildRows(devices), [devices, tick]);
  if (hidden) return null;

  const onlineCount = rows.filter(r => r.device.online).length;

  return (
    <div className="border-b border-border/40 bg-background/85 backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-1 text-[10px] font-mono uppercase',
          'tracking-widest text-muted-foreground hover:text-foreground transition-colors',
        )}
      >
        <Activity className="w-3 h-3" />
        <span>Field Diagnostics</span>
        <span className="ds-status-mute px-1.5 rounded">{onlineCount}/{rows.length} online</span>
        <span className="ml-auto inline-flex items-center gap-1">
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-2">
          {rows.length === 0 ? (
            <div className="py-3 text-center text-[10px] font-mono text-muted-foreground/60">
              No physical devices detected. Pair hardware via /pairing/usb or /pairing/ble.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {rows.map(({ device, kindLabel, provMode }) => {
                const links = Object.entries(device.links) as Array<
                  [DiscoveryTransport, NonNullable<PhysicalDevice['links'][DiscoveryTransport]>]
                >;
                const age = device.lastSeen ? Date.now() - device.lastSeen : -1;
                return (
                  <div
                    key={device.aggregateId}
                    className="flex items-center gap-2 px-2 py-1 rounded border border-border/30 bg-background/60 text-[10px] font-mono"
                  >
                    <RadioTower className={cn(
                      'w-3 h-3 shrink-0',
                      device.online ? 'text-emerald-400' : 'text-muted-foreground/40',
                    )} />
                    <span className="truncate w-44 text-foreground" title={device.label}>
                      {device.label || kindLabel}
                    </span>
                    <span className="text-muted-foreground/60 truncate w-32" title={kindLabel}>
                      {kindLabel}
                    </span>
                    <div className="flex items-center gap-1">
                      {links.map(([t, link]) => (
                        <span
                          key={t}
                          title={`${t}${link.family ? ` · ${link.family}` : ''}`}
                          className={cn(
                            'px-1.5 py-0.5 rounded border',
                            t === device.activeTransport
                              ? 'border-emerald-400/40 text-emerald-300'
                              : 'border-border/40 text-muted-foreground/70',
                          )}
                        >
                          {TRANSPORT_LABEL[t] ?? t.toUpperCase()}
                        </span>
                      ))}
                    </div>
                    <span className="ml-auto text-muted-foreground/60">
                      seen {ageLabel(age)} ago
                    </span>
                    <ProvenanceBadge mode={provMode} compact />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
