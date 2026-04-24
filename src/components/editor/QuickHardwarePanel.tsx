/**
 * QuickHardwarePanel — Mobile-first bottom sheet for instant hardware overview
 * Groups all detected devices by transport type with status, signal, and battery info
 */
import { useState, useCallback, useMemo, lazy, Suspense } from 'react';
import {
  Radio, Usb, Wifi, Bluetooth, Globe, Cpu, Cable,
  Signal, SignalLow, SignalMedium, SignalHigh, SignalZero,
  Battery, BatteryLow, BatteryMedium, BatteryFull, BatteryWarning,
  ChevronDown, ChevronRight, Search, Zap, X, ToggleLeft, ToggleRight,
  Shield, ShieldAlert, HardDrive
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { Badge } from '@/components/ui/badge';
import { useUSBDeviceStore } from '@/store/useUSBDeviceStore';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { usePBusHardware } from '@/hooks/usePBusHardware';
import type { OTATarget } from '@/lib/otaFirmwareEngine';

const OTAFirmwareDialog = lazy(() => import('@/components/editor/OTAFirmwareDialog'));

// ── Transport type definitions ──
type TransportGroup = 'ble' | 'usb' | 'artnet' | 'pbus' | 'wifi' | 'radio';

interface HWDevice {
  id: string;
  name: string;
  transport: TransportGroup;
  status: 'online' | 'offline' | 'connecting';
  rssi?: number;
  battery?: number;
  latencyMs?: number;
  channelCount?: number;
  label?: string;
  addr?: number; // hardware address for actions
  armed?: boolean;
  source?: 'fireone' | 'pbus' | 'usb' | 'sim';
}

const TRANSPORT_META: Record<TransportGroup, { icon: typeof Radio; label: string; color: string }> = {
  ble:    { icon: Bluetooth, label: 'Bluetooth',  color: 'hsl(var(--primary))' },
  usb:    { icon: Usb,       label: 'USB/Serial',  color: 'hsl(var(--success))' },
  artnet: { icon: Globe,     label: 'Art-Net',     color: 'hsl(210 100% 60%)' },
  pbus:   { icon: Cable,     label: 'PBUS',        color: 'hsl(var(--warning))' },
  wifi:   { icon: Wifi,      label: 'Wi-Fi Direct', color: 'hsl(var(--accent))' },
  radio:  { icon: Radio,     label: 'Radio 433/868', color: 'hsl(var(--destructive))' },
};

function RSSIBars({ rssi }: { rssi?: number }) {
  if (rssi === undefined) return <SignalZero className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground)/0.4)]" />;
  if (rssi > -50) return <SignalHigh className="w-3.5 h-3.5 text-[hsl(var(--success))]" />;
  if (rssi > -70) return <SignalMedium className="w-3.5 h-3.5 text-[hsl(var(--warning))]" />;
  if (rssi > -85) return <SignalLow className="w-3.5 h-3.5 text-[hsl(var(--warning))]" />;
  return <Signal className="w-3.5 h-3.5 text-[hsl(var(--destructive))]" />;
}

function BatteryIcon({ level }: { level?: number }) {
  if (level === undefined) return <Battery className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground)/0.4)]" />;
  if (level > 70) return <BatteryFull className="w-3.5 h-3.5 text-[hsl(var(--success))]" />;
  if (level > 30) return <BatteryMedium className="w-3.5 h-3.5 text-[hsl(var(--warning))]" />;
  if (level > 10) return <BatteryLow className="w-3.5 h-3.5 text-[hsl(var(--destructive))]" />;
  return <BatteryWarning className="w-3.5 h-3.5 text-[hsl(var(--destructive))] animate-pulse" />;
}

interface QuickHardwarePanelProps {
  open?: boolean;
  onClose?: () => void;
  /** Render as full-screen embedded panel (no overlay/sheet) */
  fs?: boolean;
}

export default function QuickHardwarePanel({ open, onClose, fs }: QuickHardwarePanelProps) {
  const [simMode, setSimMode] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<TransportGroup>>(new Set(['ble', 'usb', 'artnet', 'pbus', 'radio']));
  const [scanning, setScanning] = useState(false);
  const [otaOpen, setOtaOpen] = useState(false);
  const [otaDevice, setOtaDevice] = useState<{ name: string; addr?: number; target?: OTATarget } | null>(null);
  const usbDevices = useUSBDeviceStore(s => s.dmxDevices);
  const fireone = useFireOneHardware();
  const pbus = usePBusHardware();

  // Active transmission mode indicator
  const activeTransport = useMemo(() => {
    const modes: { label: string; color: string }[] = [];
    if (fireone.isConnected) {
      const path = fireone.connectionPath;
      if (path === 'serial') modes.push({ label: 'WIRED', color: 'var(--success)' });
      else if (path === 'radio') modes.push({ label: 'RADIO', color: 'var(--destructive)' });
      else if (path === 'wifi' || path === 'wifi_direct') modes.push({ label: 'WI-FI', color: 'var(--accent)' });
      else if (path === 'artnet') modes.push({ label: 'ART-NET', color: '210 100% 60%' });
      else if (path === 'cellular') modes.push({ label: 'CELLULAR', color: 'var(--warning)' });
      else if (path !== 'none') modes.push({ label: 'CONNECTED', color: 'var(--primary)' });
    }
    if (pbus.isConnected) {
      const path = pbus.connectionPath;
      if (path === 'wired') modes.push({ label: 'PBUS WIRED', color: 'var(--warning)' });
      else if (path === 'radio') modes.push({ label: 'PBUS RADIO', color: 'var(--destructive)' });
    }
    return modes;
  }, [fireone.isConnected, fireone.connectionPath, pbus.isConnected, pbus.connectionPath]);

  // Build unified device list from real hooks + USB store + SIM fallback
  const devices = useMemo((): HWDevice[] => {
    const list: HWDevice[] = [];

    // Real FireOne modules
    fireone.modules.forEach((mod, addr) => {
      const isOnline = Date.now() - mod.lastSeen < 10000;
      list.push({
        id: `fireone-${addr}`,
        name: `FireOne Module #${addr}`,
        transport: 'usb',
        status: isOnline ? 'online' : 'offline',
        rssi: mod.rssiDbm ?? (mod.signalStrength > 0 ? -100 + mod.signalStrength : undefined),
        battery: Math.round(Math.min(100, Math.max(0, (mod.batteryVoltage - 3.0) / 1.2 * 100))),
        channelCount: mod.igniters.length || 32,
        label: mod.armed ? 'ARMED' : 'SAFE',
        addr,
        armed: mod.armed,
        source: 'fireone',
      });
    });

    // Real PBUS devices
    pbus.devices.forEach((dev, addr) => {
      const bestRssi = Math.max(dev.rssi433, dev.rssi868);
      const isOnline = Date.now() - dev.lastSeen < 10000;
      list.push({
        id: `pbus-${addr}`,
        name: `PBUS ${dev.type} #${addr}`,
        transport: 'pbus',
        status: isOnline ? 'online' : 'offline',
        rssi: bestRssi > -999 ? bestRssi : undefined,
        battery: Math.round(Math.min(100, Math.max(0, (dev.batteryV - 3.0) / 1.2 * 100))),
        channelCount: dev.channels,
        label: dev.armed ? 'ARMED' : 'SAFE',
        addr,
        armed: dev.armed,
        source: 'pbus',
      });
    });

    // Real USB devices from store
    usbDevices.forEach(d => {
      // Skip if already added as fireone/pbus
      if (list.some(existing => existing.id.includes(d.id))) return;
      const transport: TransportGroup = d.type === 'radio' ? 'radio' : d.type === 'pbus' ? 'pbus' : 'usb';
      list.push({
        id: d.id,
        name: d.label,
        transport,
        status: d.state === 'connected' ? 'online' : 'offline',
        label: d.type.toUpperCase(),
      });
    });

    // SIM mode — demo devices when no real hardware
    if (simMode && list.length === 0) {
      list.push(
        { id: 'sim-ble-1', name: 'Astera AX5 TriplePAR #1', transport: 'ble', status: 'online', rssi: -52, battery: 87, latencyMs: 12 },
        { id: 'sim-ble-2', name: 'CRMX Nova TX2', transport: 'ble', status: 'online', rssi: -68, battery: 64, latencyMs: 18 },
        { id: 'sim-usb-1', name: 'ENTTEC DMX USB Pro', transport: 'usb', status: 'online', latencyMs: 2 },
        { id: 'sim-usb-2', name: 'FXK Serial Bridge', transport: 'usb', status: 'offline' },
        { id: 'sim-artnet-1', name: 'FXK-M1 Module 01', transport: 'artnet', status: 'online', rssi: -45, battery: 92, latencyMs: 4, channelCount: 32 },
        { id: 'sim-artnet-2', name: 'FXK-M1 Module 02', transport: 'artnet', status: 'online', rssi: -58, battery: 78, latencyMs: 6, channelCount: 32 },
        { id: 'sim-pbus-1', name: 'Showven C16 #1', transport: 'pbus', status: 'online', rssi: -61, battery: 81, channelCount: 16 },
        { id: 'sim-pbus-2', name: 'Showven X4 #1', transport: 'pbus', status: 'offline', battery: 23, channelCount: 4 },
        { id: 'sim-radio-1', name: 'CC1101 Dongle 433M', transport: 'radio', status: 'online', rssi: -55 },
        { id: 'sim-wifi-1', name: 'FXK Gateway AP', transport: 'wifi', status: 'online', rssi: -35, latencyMs: 3 },
      );
    }

    return list;
  }, [usbDevices, simMode, fireone.modules, pbus.devices]);

  // Group devices by transport
  const grouped = useMemo(() => {
    const map = new Map<TransportGroup, HWDevice[]>();
    devices.forEach(d => {
      const arr = map.get(d.transport) || [];
      arr.push(d);
      map.set(d.transport, arr);
    });
    return map;
  }, [devices]);

  const totalOnline = useMemo(() => devices.filter(d => d.status === 'online').length, [devices]);
  const totalDevices = devices.length;

  const toggleGroup = useCallback((g: TransportGroup) => {
    haptics.tap();
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  }, []);

  const handleArmToggle = useCallback(async (device: HWDevice) => {
    if (device.addr === undefined) return;
    haptics.tap();
    try {
      if (device.source === 'fireone') {
        if (device.armed) await fireone.disarmModule(device.addr);
        else await fireone.armModule(device.addr);
      } else if (device.source === 'pbus') {
        if (device.armed) await pbus.disarmDevice(device.addr);
        else await pbus.armDevice(device.addr);
      }
    } catch { /* ignore */ }
  }, [fireone, pbus]);

  const handleScanAll = useCallback(async () => {
    haptics.tap();
    setScanning(true);
    try {
      await Promise.allSettled([
        fireone.discoverModules?.(),
        pbus.discoverDevices?.(),
      ]);
    } catch { /* ignore */ }
    await new Promise(r => setTimeout(r, 2000));
    setScanning(false);
  }, [fireone, pbus]);

  if (!fs && !open) return null;

  // ── Embedded fullscreen mode (Command Center) ──
  if (fs) {
    return (
      <div className="flex flex-col h-full bg-background overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border)/0.15)]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[hsl(var(--primary)/0.15)]">
              <Cpu className="w-5 h-5 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight">Hardware Connect</h2>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono flex items-center gap-1.5 flex-wrap">
                <span>{totalOnline}/{totalDevices} online • {devices.filter(d => d.armed).length} armed</span>
                {activeTransport.map((t, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider"
                    style={{ background: `hsl(${t.color} / 0.15)`, color: `hsl(${t.color})` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: `hsl(${t.color})` }} />
                    {t.label}
                  </span>
                ))}
                {activeTransport.length === 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider bg-[hsl(var(--muted)/0.2)] text-[hsl(var(--muted-foreground)/0.6)]">
                    OFFLINE
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { haptics.tap(); setSimMode(!simMode); }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-bold tracking-wider transition-colors",
                simMode
                  ? "bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]"
                  : "bg-[hsl(var(--muted)/0.3)] text-[hsl(var(--muted-foreground))]"
              )}
            >
              {simMode ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
              SIM
            </button>
          </div>
        </div>

        {/* Transport Summary Bar */}
        <div className="flex gap-1.5 px-4 py-2 overflow-x-auto scrollbar-none border-b border-[hsl(var(--border)/0.08)]">
          {(['ble', 'usb', 'artnet', 'pbus', 'radio', 'wifi'] as TransportGroup[]).map(t => {
            const meta = TRANSPORT_META[t];
            const count = grouped.get(t)?.length || 0;
            const onlineCount = grouped.get(t)?.filter(d => d.status === 'online').length || 0;
            const Icon = meta.icon;
            return (
              <button
                key={t}
                onClick={() => toggleGroup(t)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all shrink-0 active:scale-95",
                  count > 0
                    ? "border-[hsl(var(--border)/0.3)] bg-[hsl(var(--surface-0)/0.5)]"
                    : "border-transparent bg-[hsl(var(--muted)/0.15)] opacity-50"
                )}
              >
                <Icon className="w-3 h-3" style={{ color: meta.color }} />
                <span className="text-[9px] font-bold text-foreground">{count}</span>
                {onlineCount > 0 && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Device List — scrollable */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
          {renderDeviceList()}
        </div>

        {/* Footer Actions */}
        {renderFooterActions()}
      </div>
    );
  }

  // ── Bottom sheet overlay mode (legacy) ──
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className="relative z-10 max-h-[85vh] flex flex-col rounded-t-3xl bg-[hsl(var(--surface-0)/0.97)] backdrop-blur-2xl border-t border-[hsl(var(--border)/0.2)] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-[hsl(var(--muted-foreground)/0.3)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[hsl(var(--primary)/0.15)]">
              <Cpu className="w-5 h-5 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight">Hardware</h2>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono">
                {totalOnline}/{totalDevices} online
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* SIM toggle */}
            <button
              onClick={() => { haptics.tap(); setSimMode(!simMode); }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-bold tracking-wider transition-colors",
                simMode
                  ? "bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]"
                  : "bg-[hsl(var(--muted)/0.3)] text-[hsl(var(--muted-foreground))]"
              )}
            >
              {simMode ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
              SIM
            </button>

            <button onClick={onClose} className="p-2 rounded-xl active:scale-90 transition-transform">
              <X className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
            </button>
          </div>
        </div>

        {/* Transport Summary Bar */}
        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-none">
          {(['ble', 'usb', 'artnet', 'pbus', 'radio', 'wifi'] as TransportGroup[]).map(t => {
            const meta = TRANSPORT_META[t];
            const count = grouped.get(t)?.length || 0;
            const onlineCount = grouped.get(t)?.filter(d => d.status === 'online').length || 0;
            const Icon = meta.icon;
            return (
              <button
                key={t}
                onClick={() => toggleGroup(t)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all shrink-0 active:scale-95",
                  count > 0
                    ? "border-[hsl(var(--border)/0.3)] bg-[hsl(var(--surface-0)/0.5)]"
                    : "border-transparent bg-[hsl(var(--muted)/0.15)] opacity-50"
                )}
              >
                <Icon className="w-3 h-3" style={{ color: meta.color }} />
                <span className="text-[9px] font-bold text-foreground">{count}</span>
                {onlineCount > 0 && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Device List */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
          {renderDeviceList()}
        </div>

        {/* Footer Actions */}
        {renderFooterActions()}
      </div>
    </div>
  );

  // ── Shared renderers ──
  function renderDeviceList() {
    return (
      <>
        {(['ble', 'usb', 'artnet', 'pbus', 'radio', 'wifi'] as TransportGroup[]).map(transport => {
          const devs = grouped.get(transport);
          if (!devs || devs.length === 0) return null;
          const meta = TRANSPORT_META[transport];
          const Icon = meta.icon;
          const isExpanded = expandedGroups.has(transport);

          return (
            <div key={transport} className="rounded-xl border border-[hsl(var(--border)/0.15)] overflow-hidden">
              <button
                onClick={() => toggleGroup(transport)}
                className="w-full flex items-center justify-between px-3 py-2.5 active:bg-[hsl(var(--muted)/0.1)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" style={{ color: meta.color }} />
                  <span className="text-[11px] font-bold text-foreground">{meta.label}</span>
                  <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-4 font-mono">
                    {devs.filter(d => d.status === 'online').length}/{devs.length}
                  </Badge>
                </div>
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-[hsl(var(--muted-foreground)/0.5)]" />
                  : <ChevronRight className="w-4 h-4 text-[hsl(var(--muted-foreground)/0.5)]" />
                }
              </button>

              {isExpanded && (
                <div className="px-2 pb-2 space-y-1">
                  {devs.map(device => (
                    <div
                      key={device.id}
                      className={cn(
                        "flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors",
                        device.status === 'online'
                          ? "bg-[hsl(var(--success)/0.06)]"
                          : device.status === 'connecting'
                          ? "bg-[hsl(var(--warning)/0.06)]"
                          : "bg-[hsl(var(--muted)/0.08)]"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          device.status === 'online' && "bg-[hsl(var(--success))]",
                          device.status === 'connecting' && "bg-[hsl(var(--warning))] animate-pulse",
                          device.status === 'offline' && "bg-[hsl(var(--muted-foreground)/0.3)]",
                        )} />
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold text-foreground truncate">{device.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {device.latencyMs !== undefined && (
                              <span className="text-[8px] font-mono text-[hsl(var(--muted-foreground))]">{device.latencyMs}ms</span>
                            )}
                            {device.channelCount !== undefined && (
                              <span className="text-[8px] font-mono text-[hsl(var(--muted-foreground))]">{device.channelCount}ch</span>
                            )}
                            {device.label && (
                              <Badge variant="outline" className={cn(
                                "text-[7px] px-1 py-0 h-3.5 font-mono",
                                device.label === 'ARMED'
                                  ? "border-[hsl(var(--destructive)/0.5)] text-[hsl(var(--destructive))]"
                                  : "border-[hsl(var(--success)/0.5)] text-[hsl(var(--success))]"
                              )}>
                                {device.label}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <RSSIBars rssi={device.rssi} />
                        <BatteryIcon level={device.battery} />
                        {device.source && (device.source === 'fireone' || device.source === 'pbus') && device.addr !== undefined && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                haptics.tap();
                                setOtaDevice({ name: device.name, addr: device.addr, target: device.source as OTATarget });
                                setOtaOpen(true);
                              }}
                              className="ml-0.5 flex items-center justify-center w-8 h-8 rounded-lg bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] transition-all active:scale-90"
                              title="Firmware Update"
                            >
                              <HardDrive className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleArmToggle(device); }}
                              className={cn(
                                "flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-90",
                                device.armed
                                  ? "bg-[hsl(var(--destructive)/0.15)] text-[hsl(var(--destructive))]"
                                  : "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]"
                              )}
                              title={device.armed ? 'Disarm' : 'Arm'}
                            >
                              {device.armed ? <ShieldAlert className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {totalDevices === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Cpu className="w-8 h-8 text-[hsl(var(--muted-foreground)/0.3)]" />
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Nenhum hardware detectado</p>
            <p className="text-[9px] text-[hsl(var(--muted-foreground)/0.6)]">Ative o modo SIM ou conecte um dispositivo</p>
          </div>
        )}
      </>
    );
  }

  function renderFooterActions() {
    return (
      <>
        <div className="flex flex-col gap-2 px-4 pt-2 pb-3 border-t border-[hsl(var(--border)/0.1)]">
          <div className="flex gap-2">
            <button
              onClick={async () => {
                haptics.tap();
                try {
                  if (fireone.isConnected) await fireone.disconnect();
                  else await fireone.connect();
                } catch { /* ignore */ }
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 h-11 rounded-xl font-bold text-[10px] transition-all active:scale-95",
                fireone.isConnected
                  ? "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] border border-[hsl(var(--success)/0.3)]"
                  : "bg-[hsl(var(--muted)/0.2)] text-foreground border border-[hsl(var(--border)/0.3)]"
              )}
            >
              <Usb className="w-3.5 h-3.5" />
              {fireone.isConnected ? 'DISCONNECT' : 'CONNECT'}
            </button>
            <button
              onClick={handleScanAll}
              disabled={scanning}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 h-11 rounded-xl font-bold text-[10px] transition-all active:scale-95",
                scanning
                  ? "bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]"
                  : "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
              )}
            >
              <Search className={cn("w-3.5 h-3.5", scanning && "animate-spin")} />
              {scanning ? 'SCANNING...' : 'SCAN ALL'}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => { haptics.tap(); await Promise.allSettled([fireone.armAll?.(), pbus.armAll?.()]); }}
              className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))] font-bold text-[10px] active:scale-95 transition-transform border border-[hsl(var(--destructive)/0.2)]"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              ARM ALL
            </button>
            <button
              onClick={async () => { haptics.tap(); await Promise.allSettled([fireone.disarmAll?.(), pbus.disarmAll?.()]); }}
              className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))] font-bold text-[10px] active:scale-95 transition-transform border border-[hsl(var(--success)/0.2)]"
            >
              <Shield className="w-3.5 h-3.5" />
              DISARM ALL
            </button>
            <button
              onClick={() => { haptics.tap(); }}
              className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border border-[hsl(var(--border)/0.3)] bg-[hsl(var(--surface-0)/0.5)] font-bold text-[10px] text-foreground active:scale-95 transition-transform"
            >
              <Zap className="w-3.5 h-3.5 text-[hsl(var(--warning))]" />
              TEST ALL
            </button>
            <button
              onClick={() => { haptics.tap(); setOtaDevice(null); setOtaOpen(true); }}
              className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.08)] font-bold text-[10px] text-[hsl(var(--primary))] active:scale-95 transition-transform"
            >
              <HardDrive className="w-3.5 h-3.5" />
              FW UPDATE
            </button>
          </div>
        </div>
        <Suspense fallback={null}>
          <OTAFirmwareDialog
            open={otaOpen}
            onClose={() => setOtaOpen(false)}
            deviceName={otaDevice?.name}
            deviceAddr={otaDevice?.addr}
            deviceTarget={otaDevice?.target}
          />
        </Suspense>
      </>
    );
  }
}
