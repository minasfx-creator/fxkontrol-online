/**
 * CommandCenter — FXK 2.0 Execution Hub
 * Intelligent routing: Fire modes get full chrome, Hardware/Network get direct rendering
 * Each console has unique accent identity
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ambientSound } from '@/lib/ambientSound';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { usePBusHardware } from '@/hooks/usePBusHardware';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import { cn } from '@/lib/utils';
import {
  Zap, Lightbulb, Hand, Flame, Timer, Check, Cpu, Cable,
  Gauge, Wifi, Globe, Plug, Radio, Map, Smartphone, Settings,
  Shield, ChevronRight, AlertOctagon, Layers
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import LiveFiringPanel from '@/components/editor/LiveFiringPanel';

// Direct-render components for non-fire modes (no ARM/CUE/PANIC chrome)
import VirtualControllerHub from '@/components/editor/VirtualControllerHub';
import PBusMonitorPanel from '@/components/editor/live-firing/PBusMonitorPanel';
import MA3ControlPanel from '@/components/editor/MA3ControlPanel';
import VirtualIFMx32QPanel from '@/components/editor/live-firing/VirtualIFMx32QPanel';
import WiFiDirectControlPanel from '@/components/editor/live-firing/WiFiDirectControlPanel';
import FXKNetPanel from '@/components/editor/live-firing/FXKNetPanel';
import ConnectionManagerPanel from '@/components/editor/ConnectionManagerPanel';
import RadioControlPanel from '@/components/editor/RadioControlPanel';
import FieldMap2D from '@/components/editor/FieldMap2D';
import MobileLinkMode from '@/components/editor/live-firing/MobileLinkMode';
import SettingsPanel from '@/components/editor/live-firing/SettingsPanel';
import DroneCommandPanel from '@/components/editor/DroneCommandPanel';

// ── Types ──
type CommandMode =
  | 'super_dmx' | 'simple_dmx' | 'manual_fire' | 'pyro_fire' | 'check_slave'
  | 'controllers' | 'pbus' | 'ma3' | 'wifi_direct'
  | 'artnet_modules' | 'connections' | 'radio' | 'field_map'
  | 'mobile_link' | 'settings' | 'drone_ops';

// Fire modes get full LiveFiringPanel chrome (ARM, CUE keys, PANIC)
const FIRE_MODES: CommandMode[] = [
  'super_dmx', 'simple_dmx', 'manual_fire', 'pyro_fire', 'check_slave',
];

const isFireMode = (m: CommandMode) => FIRE_MODES.includes(m);

// ── Console Accent Config — Tactical ──
const CONSOLE_ACCENTS: Record<string, { color: string; glow: string; label: string; badge: string }> = {
  super_dmx:   { color: 'hsl(200 80% 48%)', glow: 'hsl(200 80% 48% / 0.1)', label: 'FXK-DMX',   badge: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  simple_dmx:  { color: 'hsl(120 70% 38%)', glow: 'hsl(120 70% 38% / 0.1)', label: 'FXK-DMX LITE',  badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  manual_fire: { color: 'hsl(32 100% 50%)',  glow: 'hsl(32 100% 50% / 0.1)',  label: 'MANUAL FIRE', badge: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
  pyro_fire:   { color: 'hsl(0 85% 48%)',   glow: 'hsl(0 85% 48% / 0.1)',   label: 'FXK-PYRO',    badge: 'bg-red-500/15 text-red-400 border-red-500/20' },
  auto_fire:   { color: 'hsl(45 100% 50%)',  glow: 'hsl(45 100% 50% / 0.1)',  label: 'AUTO FIRE',   badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  check_slave: { color: 'hsl(165 100% 42%)', glow: 'hsl(165 100% 42% / 0.1)', label: 'DIAGNOSTICS', badge: 'bg-teal-500/15 text-teal-400 border-teal-500/20' },
  controllers: { color: 'hsl(270 60% 50%)', glow: 'hsl(270 60% 50% / 0.08)', label: 'CONTROLLERS', badge: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
  pbus:        { color: 'hsl(38 100% 50%)',  glow: 'hsl(38 100% 50% / 0.08)',  label: 'P-BUS',       badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  ma3:         { color: 'hsl(240 50% 52%)', glow: 'hsl(240 50% 52% / 0.08)', label: 'FXK-LIGHT',    badge: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20' },
  module:      { color: 'hsl(165 100% 42%)', glow: 'hsl(165 100% 42% / 0.08)', label: 'FXK MODULE',    badge: 'bg-teal-500/15 text-teal-400 border-teal-500/20' },
  wifi_direct: { color: 'hsl(200 80% 48%)', glow: 'hsl(200 80% 48% / 0.08)', label: 'WIFI DIRECT', badge: 'bg-sky-500/15 text-sky-400 border-sky-500/20' },
  artnet_modules: { color: 'hsl(270 60% 50%)', glow: 'hsl(270 60% 50% / 0.08)', label: 'FXK-NET', badge: 'bg-violet-500/15 text-violet-400 border-violet-500/20' },
  connections: { color: 'hsl(165 100% 42%)', glow: 'hsl(165 100% 42% / 0.08)', label: 'CONNECTIONS', badge: 'bg-teal-500/15 text-teal-400 border-teal-500/20' },
  radio:       { color: 'hsl(340 80% 50%)', glow: 'hsl(340 80% 50% / 0.08)', label: 'RF COMMS',    badge: 'bg-pink-500/15 text-pink-400 border-pink-500/20' },
  field_map:   { color: 'hsl(120 70% 38%)', glow: 'hsl(120 70% 38% / 0.08)', label: 'FIELD MAP',   badge: 'bg-green-500/15 text-green-400 border-green-500/20' },
  mobile_link: { color: 'hsl(240 50% 52%)', glow: 'hsl(240 50% 52% / 0.08)', label: 'FXK-LINK', badge: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20' },
  settings:    { color: 'hsl(200 8% 50%)', glow: 'hsl(200 8% 50% / 0.06)', label: 'SETTINGS',    badge: 'bg-muted/30 text-muted-foreground border-border/15' },
  drone_ops:   { color: 'hsl(165 100% 42%)', glow: 'hsl(165 100% 42% / 0.08)', label: 'FXK-DRONES', badge: 'bg-teal-500/15 text-teal-400 border-teal-500/20' },
};

// ── Sidebar Sections ──
const MODE_SECTIONS = [
  {
    label: 'FIRE CONTROL',
    accent: 'text-red-400',
    modes: [
      { key: 'super_dmx' as CommandMode, label: 'FXK-DMX', icon: Zap },
      { key: 'simple_dmx' as CommandMode, label: 'Simple DMX', icon: Lightbulb },
      { key: 'manual_fire' as CommandMode, label: 'Manual', icon: Hand },
      { key: 'pyro_fire' as CommandMode, label: 'FXK-PYRO', icon: Flame },
      { key: 'auto_fire' as CommandMode, label: 'Auto Fire', icon: Timer },
      { key: 'check_slave' as CommandMode, label: 'Check', icon: Check },
    ],
  },
  {
    label: 'HARDWARE',
    accent: 'text-amber-400',
    modes: [
      { key: 'controllers' as CommandMode, label: 'Controllers', icon: Cpu },
      { key: 'pbus' as CommandMode, label: 'P-BUS', icon: Cable },
      { key: 'ma3' as CommandMode, label: 'FXK-LIGHT', icon: Gauge },
      { key: 'module' as CommandMode, label: 'FXK Module', icon: Cpu },
      { key: 'wifi_direct' as CommandMode, label: 'WiFi Direct', icon: Wifi },
      { key: 'drone_ops' as CommandMode, label: 'FXK-DRONES', icon: Layers },
    ],
  },
  {
    label: 'NETWORK',
    accent: 'text-primary',
    modes: [
      { key: 'artnet_modules' as CommandMode, label: 'FXK-NET', icon: Globe },
      { key: 'connections' as CommandMode, label: 'Connections', icon: Plug },
      { key: 'radio' as CommandMode, label: 'Radio', icon: Radio },
      { key: 'field_map' as CommandMode, label: 'Field Map', icon: Map },
    ],
  },
  {
    label: 'SYSTEM',
    accent: 'text-muted-foreground',
    modes: [
      { key: 'mobile_link' as CommandMode, label: 'FXK-LINK', icon: Smartphone },
      { key: 'settings' as CommandMode, label: 'Settings', icon: Settings },
    ],
  },
];

const MOBILE_CATEGORIES = [
  { label: 'Fire', icon: Flame, section: 0 },
  { label: 'HW', icon: Cpu, section: 1 },
  { label: 'Net', icon: Globe, section: 2 },
  { label: 'Sys', icon: Settings, section: 3 },
];

export default function CommandCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = (searchParams.get('mode') as CommandMode) || 'super_dmx';
  const [activeMode, setActiveMode] = useState<CommandMode>(initialMode);
  const [swapPhase, setSwapPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileCategory, setMobileCategory] = useState(0);
  const isMobile = useIsMobile();
  const fireone = useFireOneHardware();
  const pbus = usePBusHardware();
  const activeEffects = useLiveSfxStore(s => s.activeEffects);
  const isArmed = activeEffects.length > 0;

  const accent = CONSOLE_ACCENTS[activeMode] ?? CONSOLE_ACCENTS.settings;

  const connectedCount = useMemo(() => {
    let c = 0;
    if (fireone.isConnected) c++;
    if (pbus.isConnected) c += pbus.deviceCount;
    return c;
  }, [fireone.isConnected, pbus.isConnected, pbus.deviceCount]);

  const handleModeChange = useCallback((mode: CommandMode) => {
    if (mode === activeMode) return;
    ambientSound.play('boot');
    setSwapPhase('out');
    setTimeout(() => {
      setActiveMode(mode);
      setSearchParams({ mode }, { replace: true });
      setSwapPhase('in');
      setTimeout(() => setSwapPhase('idle'), 300);
    }, 200);
  }, [setSearchParams, activeMode]);

  // ── Direct-render for non-fire modes (no ARM/CUE/PANIC chrome) ──
  const renderDirectPanel = useCallback((mode: CommandMode) => {
    switch (mode) {
      case 'controllers': return <VirtualControllerHub fs onSelectMode={(m) => handleModeChange(m as CommandMode)} />;
      case 'pbus': return <PBusMonitorPanel />;
      case 'ma3': return <MA3ControlPanel fs />;
      case 'module': return <VirtualIFMx32QPanel fs />;
      case 'wifi_direct': return <WiFiDirectControlPanel fs />;
      case 'artnet_modules': return <ArtNetModulePanel fs />;
      case 'connections': return <ConnectionManagerPanel fs />;
      case 'radio': return <RadioControlPanel fs />;
      case 'field_map': return <FieldMap2D fs />;
      case 'mobile_link': return <MobileLinkMode fs fireChannel={() => {}} channels={[]} artNetConnected={false} relayConnected={false} />;
      case 'settings': return <SettingsPanel fs settings={{ language: 'pt', wirelessDmxEnabled: false, wirelessDmxId: 1, globalSafetyChannel: 0, globalSafetyValue: 0, pyroArmRequired: true, deleteConfirm: true, backlight: 80, tcpPort: 8000, artNetIp: '2.0.0.1', artNetPort: 6454, networkIp: '192.168.1.100', networkMask: '255.255.255.0', networkGateway: '192.168.1.1' }} onSettingsChange={() => {}} relayConnected={false} relayUrl="" onRelayUrlChange={() => {}} onConnectRelay={() => {}} onDisconnectRelay={() => {}} />;
      case 'drone_ops': return <DroneCommandPanel fs />;
      default: return null;
    }
  }, [handleModeChange]);

  // ══════════════════════════════════════════════════════
  // MOBILE LAYOUT
  // ══════════════════════════════════════════════════════
  if (isMobile) {
    const categoryModes = MODE_SECTIONS[mobileCategory]?.modes ?? [];

    return (
      <div className="h-[100dvh] w-screen flex flex-col bg-background">
        {/* ── Tactical HUD — Mobile ── */}
        <div className="shrink-0 px-2 pt-1.5 pb-1" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div
            className={cn(
              "flex items-center justify-between px-3 py-2 rounded border transition-all",
              isArmed
                ? "border-destructive/30 glow-danger"
                : "border-primary/10"
            )}
            style={{ background: 'hsl(220 22% 3% / 0.95)', backdropFilter: 'blur(24px)' }}
          >
            <div className="flex items-center gap-2">
              <div
                className={cn("h-2 w-2 shrink-0", connectedCount > 0 ? "animate-pulse" : "")}
                style={{ backgroundColor: connectedCount > 0 ? accent.color : 'hsl(var(--muted-foreground) / 0.2)', boxShadow: connectedCount > 0 ? `0 0 6px ${accent.color}` : 'none' }}
              />
              <span className="text-[8px] font-bold text-foreground font-mono tracking-[0.15em]">
                {connectedCount > 0 ? `${connectedCount} LINK` : 'NO LINK'}
              </span>
            </div>

            <Badge variant="outline" className={cn("text-[7px] h-4.5 px-2 font-black border font-mono tracking-[0.15em] rounded-sm", accent.badge)}>
              {accent.label}
            </Badge>

            <div className="flex items-center gap-1">
              {fireone.isConnected && (
                <Badge variant="outline" className="text-[6px] h-3.5 px-1 border-red-500/15 text-red-400 font-mono rounded-sm">FO</Badge>
              )}
              {pbus.isConnected && (
                <Badge variant="outline" className="text-[6px] h-3.5 px-1 border-amber-500/15 text-amber-400 font-mono rounded-sm">PB</Badge>
              )}
              {isArmed && (
                <Badge variant="destructive" className="text-[6px] h-3.5 px-1 animate-pulse font-mono rounded-sm">ARM</Badge>
              )}
            </div>
          </div>
        </div>

        {/* ── Mode Selector — Tactical Pills ── */}
        <div className="shrink-0 px-2 py-1">
          <ScrollArea className="w-full">
            <div className="flex gap-1 pb-1">
              {categoryModes.map(mode => {
                const isActive = activeMode === mode.key;
                const mAccent = CONSOLE_ACCENTS[mode.key];
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.key}
                    onClick={() => handleModeChange(mode.key)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2.5 whitespace-nowrap transition-all",
                      "text-[10px] font-bold border min-h-[48px] font-mono tracking-wider uppercase rounded-sm",
                      isActive
                        ? "text-foreground"
                        : "border-border/10 text-muted-foreground/50 active:scale-95"
                    )}
                    style={{
                      background: isActive ? mAccent?.glow : 'hsl(220 18% 5% / 0.6)',
                      borderColor: isActive ? mAccent?.color + '33' : undefined,
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-hidden">
          {isFireMode(activeMode) ? (
            <LiveFiringPanel initialMode={activeMode} standalone />
          ) : (
            <ScrollArea className="h-full">
              <div className="h-full surface-0">
                {renderDirectPanel(activeMode)}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* ── Bottom Nav — Tactical ── */}
        <div
          className="shrink-0"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom)',
            background: 'hsl(220 22% 3% / 0.95)',
            backdropFilter: 'blur(32px)',
            borderTop: '1px solid hsl(var(--primary) / 0.08)',
          }}
        >
          <nav className="flex items-center justify-around py-1.5">
            {MOBILE_CATEGORIES.map((cat, idx) => {
              const isActive = mobileCategory === idx;
              const Icon = cat.icon;
              return (
                <button
                  key={cat.label}
                  onClick={() => setMobileCategory(idx)}
                  className="flex flex-col items-center gap-0.5 py-2 px-4 min-h-[48px] min-w-[48px] transition-all active:scale-90"
                >
                  <Icon className={cn("w-5.5 h-5.5 transition-colors", isActive ? "text-primary" : "text-muted-foreground/40")} style={isActive ? { filter: 'drop-shadow(0 0 4px hsl(var(--primary) / 0.5))' } : undefined} />
                  <span className={cn("text-[8px] font-bold font-mono tracking-[0.15em] transition-colors uppercase", isActive ? "text-primary" : "text-muted-foreground/35")}>
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════
  // DESKTOP LAYOUT
  // ══════════════════════════════════════════════════════
  return (
    <div className="h-[calc(100vh-3rem)] flex overflow-hidden">
      {/* ── Sidebar — Tactical Command ── */}
      <div
        className={cn(
          "shrink-0 flex flex-col border-r transition-all duration-200",
          sidebarCollapsed ? "w-14" : "w-52"
        )}
        style={{
          background: 'hsl(220 22% 3%)',
          borderColor: 'hsl(var(--primary) / 0.06)',
        }}
      >
        {/* Tactical Status Header */}
        <div className="px-2 pt-3 pb-2">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={cn(
              "w-full rounded border transition-all duration-200",
              "hover:border-primary/15",
              sidebarCollapsed ? "p-2" : "px-3 py-2"
            )}
            style={{
              background: accent.glow,
              borderColor: accent.color + '15',
            }}
          >
            {sidebarCollapsed ? (
              <div className="flex flex-col items-center gap-1">
                <div className="h-2 w-2" style={{ backgroundColor: connectedCount > 0 ? accent.color : 'hsl(var(--muted-foreground) / 0.2)' }} />
                <span className="text-[7px] font-mono text-muted-foreground font-bold">{connectedCount}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 shrink-0" style={{ backgroundColor: connectedCount > 0 ? accent.color : 'hsl(var(--muted-foreground) / 0.2)', boxShadow: connectedCount > 0 ? `0 0 6px ${accent.color}` : 'none' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] font-bold text-foreground font-mono tracking-[0.2em] truncate">FXK COMMAND</p>
                  <p className="text-[7px] text-muted-foreground/50 font-mono tracking-wider">{connectedCount} LINKS</p>
                </div>
                {fireone.isConnected && (
                  <Badge variant="outline" className="text-[6px] h-3.5 px-1 border-red-500/15 text-red-400 shrink-0 font-mono rounded-sm">FO</Badge>
                )}
                {pbus.isConnected && (
                  <Badge variant="outline" className="text-[6px] h-3.5 px-1 border-amber-500/15 text-amber-400 shrink-0 font-mono rounded-sm">PB</Badge>
                )}
              </div>
            )}
          </button>
        </div>

        {/* Mode List — Tactical */}
        <ScrollArea className="flex-1 px-1">
          <div className="space-y-3 pb-3">
            {MODE_SECTIONS.map(section => (
              <div key={section.label}>
                {!sidebarCollapsed && (
                  <div className="flex items-center gap-1.5 px-2 mb-1">
                    <div className="h-[1px] w-2 bg-current opacity-30" />
                    <p className={cn("text-[7px] font-bold tracking-[0.3em] font-mono shrink-0", section.accent)}>
                      {section.label}
                    </p>
                    <div className="h-[1px] flex-1" style={{ background: 'hsl(var(--primary) / 0.06)' }} />
                  </div>
                )}
                <div className="space-y-px">
                  {section.modes.map(mode => {
                    const isActive = activeMode === mode.key;
                    const mAccent = CONSOLE_ACCENTS[mode.key];
                    return (
                      <button
                        key={mode.key}
                        onClick={() => handleModeChange(mode.key)}
                        className={cn(
                          "w-full flex items-center gap-2 rounded-sm transition-all duration-150",
                          sidebarCollapsed ? "justify-center p-2.5" : "px-2.5 py-2.5 min-h-[40px]",
                          isActive
                            ? "text-foreground border-l-2"
                            : "text-muted-foreground/50 hover:bg-primary/3 hover:text-foreground/60 border-l-2 border-transparent"
                        )}
                        style={isActive ? {
                          background: mAccent?.glow,
                          borderLeftColor: mAccent?.color,
                        } : undefined}
                        title={sidebarCollapsed ? mode.label : undefined}
                      >
                        <mode.icon className={cn("shrink-0", sidebarCollapsed ? "w-4 h-4" : "w-3.5 h-3.5")} />
                        {!sidebarCollapsed && (
                          <span className="text-[9px] font-bold truncate font-mono tracking-wider uppercase">{mode.label}</span>
                        )}
                        {!sidebarCollapsed && isActive && (
                          <div className="ml-auto h-1 w-1 animate-pulse shrink-0" style={{ backgroundColor: mAccent?.color, boxShadow: `0 0 4px ${mAccent?.color}` }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Safety Footer — Tactical */}
        {!sidebarCollapsed && (
          <div className="p-2 border-t" style={{ borderColor: 'hsl(var(--destructive) / 0.08)' }}>
            <div className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-sm border transition-all",
              isArmed
                ? "danger-stripe border-destructive/20"
                : "bg-destructive/3 border-destructive/8"
            )}>
              <Shield className="h-3 w-3 text-destructive/40 shrink-0" />
              <span className="text-[7px] text-destructive/50 font-bold font-mono tracking-[0.15em]">
                {isArmed ? `ARMED // ${activeEffects.length} HOT` : 'SAFETY INTERLOCK'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Breadcrumb — Tactical Command Bar */}
        <div
          className="h-10 shrink-0 flex items-center justify-between px-4 border-b"
          style={{
            background: `linear-gradient(90deg, ${accent.glow} 0%, hsl(220 22% 3% / 0.9) 40%)`,
            borderColor: 'hsl(var(--primary) / 0.05)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <Badge variant="outline" className={cn("text-[7px] h-4.5 px-2 font-black border font-mono tracking-[0.15em] rounded-sm", accent.badge)}>
              {accent.label}
            </Badge>
            <div className="h-3 w-[1px]" style={{ background: 'hsl(var(--primary) / 0.1)' }} />
            <span className="text-[8px] text-muted-foreground/30 font-mono tracking-[0.2em]">
              {isFireMode(activeMode) ? 'FIRE CONTROL' : 'SYS PANEL'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {isArmed && (
              <Badge variant="destructive" className="text-[7px] h-4.5 animate-pulse font-mono tracking-wider rounded-sm">
                ARMED // {activeEffects.length}
              </Badge>
            )}
            {connectedCount > 0 && (
              <Badge variant="outline" className="text-[7px] h-4.5 border-primary/12 text-primary font-mono tracking-wider rounded-sm">
                {connectedCount} ONLINE
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-hidden transition-all duration-200 ${swapPhase === 'out' ? 'swap-out' : swapPhase === 'in' ? 'swap-in' : ''}`}>
          {isFireMode(activeMode) ? (
            <LiveFiringPanel initialMode={activeMode} standalone />
          ) : (
            <ScrollArea className="h-full">
              <div className="h-full surface-0">
                {renderDirectPanel(activeMode)}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
