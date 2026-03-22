/**
 * CommandCenter — FXK 2.0 Execution Hub
 * Intelligent routing: Fire modes get full chrome, Hardware/Network get direct rendering
 * Each console has unique accent identity
 */
import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { usePBusHardware } from '@/hooks/usePBusHardware';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import { cn } from '@/lib/utils';
import {
  Zap, Lightbulb, Hand, Flame, Timer, Check, Cpu, Cable,
  Gauge, Wifi, Globe, Plug, Radio, Map, Smartphone, Settings,
  Shield, ChevronRight, AlertOctagon
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
import ArtNetModulePanel from '@/components/editor/live-firing/ArtNetModulePanel';
import ConnectionManagerPanel from '@/components/editor/ConnectionManagerPanel';
import RadioControlPanel from '@/components/editor/RadioControlPanel';
import FieldMap2D from '@/components/editor/FieldMap2D';
import MobileLinkMode from '@/components/editor/live-firing/MobileLinkMode';
import SettingsPanel from '@/components/editor/live-firing/SettingsPanel';

// ── Types ──
type CommandMode =
  | 'super_dmx' | 'simple_dmx' | 'manual_fire' | 'pyro_fire' | 'auto_fire' | 'check_slave'
  | 'controllers' | 'pbus' | 'ma3' | 'module' | 'wifi_direct'
  | 'artnet_modules' | 'connections' | 'radio' | 'field_map'
  | 'mobile_link' | 'settings';

// Fire modes get full LiveFiringPanel chrome (ARM, CUE keys, PANIC)
const FIRE_MODES: CommandMode[] = [
  'super_dmx', 'simple_dmx', 'manual_fire', 'pyro_fire', 'auto_fire', 'check_slave',
];

const isFireMode = (m: CommandMode) => FIRE_MODES.includes(m);

// ── Console Accent Config ──
const CONSOLE_ACCENTS: Record<string, { color: string; glow: string; label: string; badge: string }> = {
  super_dmx:   { color: 'hsl(210 90% 55%)', glow: 'hsl(210 90% 55% / 0.15)', label: 'FXK-DMX',   badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  simple_dmx:  { color: 'hsl(150 70% 45%)', glow: 'hsl(150 70% 45% / 0.15)', label: 'FXK-DMX Lite',  badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  manual_fire: { color: 'hsl(25 90% 55%)',  glow: 'hsl(25 90% 55% / 0.15)',  label: 'MANUAL FIRE', badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  pyro_fire:   { color: 'hsl(0 80% 55%)',   glow: 'hsl(0 80% 55% / 0.15)',   label: 'FXK-PYRO',    badge: 'bg-red-500/20 text-red-400 border-red-500/30' },
  auto_fire:   { color: 'hsl(45 90% 55%)',  glow: 'hsl(45 90% 55% / 0.15)',  label: 'AUTO FIRE',   badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  check_slave: { color: 'hsl(185 70% 50%)', glow: 'hsl(185 70% 50% / 0.15)', label: 'CHECK SLAVE', badge: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  controllers: { color: 'hsl(270 60% 55%)', glow: 'hsl(270 60% 55% / 0.12)', label: 'CONTROLLERS', badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  pbus:        { color: 'hsl(35 80% 50%)',  glow: 'hsl(35 80% 50% / 0.12)',  label: 'P-BUS',       badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  ma3:         { color: 'hsl(220 70% 55%)', glow: 'hsl(220 70% 55% / 0.12)', label: 'FXK-LIGHT',    badge: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  module:      { color: 'hsl(160 60% 45%)', glow: 'hsl(160 60% 45% / 0.12)', label: 'FXK Module',    badge: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
  wifi_direct: { color: 'hsl(200 70% 50%)', glow: 'hsl(200 70% 50% / 0.12)', label: 'WiFi Direct', badge: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
  artnet_modules: { color: 'hsl(280 60% 50%)', glow: 'hsl(280 60% 50% / 0.12)', label: 'FXK-NET', badge: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  connections: { color: 'hsl(190 60% 50%)', glow: 'hsl(190 60% 50% / 0.12)', label: 'Connections', badge: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  radio:       { color: 'hsl(340 60% 55%)', glow: 'hsl(340 60% 55% / 0.12)', label: 'Radio',       badge: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  field_map:   { color: 'hsl(120 50% 45%)', glow: 'hsl(120 50% 45% / 0.12)', label: 'Field Map',   badge: 'bg-green-500/20 text-green-400 border-green-500/30' },
  mobile_link: { color: 'hsl(250 50% 55%)', glow: 'hsl(250 50% 55% / 0.12)', label: 'FXK-LINK', badge: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  settings:    { color: 'hsl(220 10% 55%)', glow: 'hsl(220 10% 55% / 0.12)', label: 'Settings',    badge: 'bg-muted/40 text-muted-foreground border-border/20' },
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
    setActiveMode(mode);
    setSearchParams({ mode }, { replace: true });
  }, [setSearchParams]);

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
        {/* ── Dynamic Island ── */}
        <div className="shrink-0 px-3 pt-2 pb-1" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div
            className={cn(
              "flex items-center justify-between px-3 py-2 rounded-2xl border transition-all",
              "backdrop-blur-xl",
              isArmed
                ? "border-destructive/40 shadow-[0_0_12px_hsl(var(--destructive)/0.2)]"
                : "border-border/20"
            )}
            style={{ background: accent.glow }}
          >
            <div className="flex items-center gap-2">
              <div
                className={cn("h-2.5 w-2.5 rounded-full shrink-0", connectedCount > 0 ? "animate-pulse" : "")}
                style={{ backgroundColor: connectedCount > 0 ? accent.color : 'hsl(var(--muted-foreground) / 0.3)' }}
              />
              <span className="text-[9px] font-bold text-foreground uppercase tracking-wider">
                {connectedCount > 0 ? `${connectedCount} ONLINE` : 'OFFLINE'}
              </span>
            </div>

            {/* Console badge */}
            <Badge variant="outline" className={cn("text-[9px] h-5 px-2 font-black border", accent.badge)}>
              {accent.label}
            </Badge>

            <div className="flex items-center gap-1.5">
              {fireone.isConnected && (
                <Badge variant="outline" className="text-[8px] h-4 px-1 border-red-500/30 text-red-400">FO</Badge>
              )}
              {pbus.isConnected && (
                <Badge variant="outline" className="text-[8px] h-4 px-1 border-amber-500/30 text-amber-400">PB</Badge>
              )}
              {isArmed && (
                <Badge variant="destructive" className="text-[8px] h-4 px-1 animate-pulse">ARMED</Badge>
              )}
            </div>
          </div>
        </div>

        {/* ── Mode Pills ── */}
        <div className="shrink-0 px-3 py-1.5">
          <ScrollArea className="w-full">
            <div className="flex gap-1.5 pb-1">
              {categoryModes.map(mode => {
                const isActive = activeMode === mode.key;
                const mAccent = CONSOLE_ACCENTS[mode.key];
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.key}
                    onClick={() => handleModeChange(mode.key)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-xl whitespace-nowrap transition-all",
                      "text-[10px] font-bold border min-h-[40px]",
                      isActive
                        ? "border-opacity-40 text-foreground"
                        : "border-border/10 text-muted-foreground/50 active:scale-95"
                    )}
                    style={{
                      background: isActive ? mAccent?.glow : 'hsl(220 10% 8% / 0.6)',
                      borderColor: isActive ? mAccent?.color : undefined,
                    }}
                  >
                    <Icon className="w-4 h-4" />
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
              <div className="h-full" style={{ background: 'hsl(220 15% 6%)' }}>
                {renderDirectPanel(activeMode)}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* ── Bottom Nav ── */}
        <div
          className="shrink-0 border-t border-border/15"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom)',
            background: 'hsl(225 12% 5% / 0.9)',
            backdropFilter: 'blur(40px)',
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
                  className="flex flex-col items-center gap-0.5 py-1 px-4 rounded-xl transition-all active:scale-90"
                >
                  <Icon className={cn("w-5 h-5 transition-colors", isActive ? "text-primary" : "text-muted-foreground/40")} />
                  <span className={cn("text-[9px] font-semibold transition-colors", isActive ? "text-primary" : "text-muted-foreground/30")}>
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
      {/* ── Sidebar ── */}
      <div
        className={cn(
          "shrink-0 flex flex-col border-r border-border/20 transition-all duration-300",
          sidebarCollapsed ? "w-14" : "w-56"
        )}
        style={{
          background: 'linear-gradient(180deg, hsl(225 14% 7% / 0.95) 0%, hsl(225 12% 5% / 0.98) 100%)',
          backdropFilter: 'blur(40px)',
        }}
      >
        {/* Dynamic Island */}
        <div className="px-3 pt-4 pb-3">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={cn(
              "w-full rounded-2xl border border-border/20 transition-all duration-300",
              "backdrop-blur-xl hover:border-primary/30",
              sidebarCollapsed ? "p-2" : "px-3 py-2"
            )}
            style={{ background: accent.glow }}
          >
            {sidebarCollapsed ? (
              <div className="flex flex-col items-center gap-1">
                <div className={cn("h-2 w-2 rounded-full")} style={{ backgroundColor: connectedCount > 0 ? accent.color : 'hsl(var(--muted-foreground) / 0.3)' }} />
                <span className="text-[8px] font-mono text-muted-foreground">{connectedCount}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: connectedCount > 0 ? accent.color : 'hsl(var(--muted-foreground) / 0.3)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold text-foreground uppercase tracking-wider truncate">FXK Command</p>
                  <p className="text-[8px] text-muted-foreground font-mono">{connectedCount} connected</p>
                </div>
                {fireone.isConnected && (
                  <Badge variant="outline" className="text-[8px] h-4 px-1 border-red-500/30 text-red-400 shrink-0">FO</Badge>
                )}
                {pbus.isConnected && (
                  <Badge variant="outline" className="text-[8px] h-4 px-1 border-amber-500/30 text-amber-400 shrink-0">PB</Badge>
                )}
              </div>
            )}
          </button>
        </div>

        {/* Mode List */}
        <ScrollArea className="flex-1 px-1.5">
          <div className="space-y-3 pb-4">
            {MODE_SECTIONS.map(section => (
              <div key={section.label}>
                {!sidebarCollapsed && (
                  <p className={cn("text-[8px] font-bold uppercase tracking-[0.2em] px-2 mb-1", section.accent)}>
                    {section.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {section.modes.map(mode => {
                    const isActive = activeMode === mode.key;
                    const mAccent = CONSOLE_ACCENTS[mode.key];
                    return (
                      <button
                        key={mode.key}
                        onClick={() => handleModeChange(mode.key)}
                        className={cn(
                          "w-full flex items-center gap-2.5 rounded-xl transition-all duration-200",
                          sidebarCollapsed ? "justify-center p-2" : "px-2.5 py-2",
                          isActive
                            ? "text-foreground border"
                            : "text-muted-foreground/60 hover:bg-muted/20 hover:text-foreground/80 border border-transparent"
                        )}
                        style={isActive ? {
                          background: mAccent?.glow,
                          borderColor: mAccent?.color + '33',
                          color: mAccent?.color,
                        } : undefined}
                        title={sidebarCollapsed ? mode.label : undefined}
                      >
                        <mode.icon className={cn("shrink-0", sidebarCollapsed ? "w-4 h-4" : "w-3.5 h-3.5")} />
                        {!sidebarCollapsed && (
                          <span className="text-[10px] font-semibold truncate">{mode.label}</span>
                        )}
                        {!sidebarCollapsed && isActive && (
                          <div className="ml-auto h-1.5 w-1.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: mAccent?.color }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Safety Footer */}
        {!sidebarCollapsed && (
          <div className="p-2 border-t border-border/10">
            <div className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-lg border",
              isArmed
                ? "bg-destructive/10 border-destructive/30"
                : "bg-destructive/5 border-destructive/10"
            )}>
              <Shield className="h-3 w-3 text-destructive/60 shrink-0" />
              <span className="text-[8px] text-destructive/60 font-semibold">
                {isArmed ? `ARMED • ${activeEffects.length} ACTIVE` : 'SAFETY LOCK ACTIVE'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Breadcrumb bar with console identity */}
        <div
          className="h-10 shrink-0 flex items-center justify-between px-4 border-b border-border/15"
          style={{
            background: `linear-gradient(90deg, ${accent.glow} 0%, hsl(225 12% 7% / 0.8) 40%)`,
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={cn("text-[9px] h-5 px-2 font-black border", accent.badge)}>
              {accent.label}
            </Badge>
            {isFireMode(activeMode) && (
              <span className="text-[9px] text-muted-foreground/40 font-mono">
                FIRE CONSOLE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isArmed && (
              <Badge variant="destructive" className="text-[8px] h-5 animate-pulse">
                ARMED • {activeEffects.length}
              </Badge>
            )}
            {connectedCount > 0 && (
              <Badge variant="outline" className="text-[8px] h-5 border-emerald-500/20 text-emerald-400">
                {connectedCount} ONLINE
              </Badge>
            )}
          </div>
        </div>

        {/* Content — Fire modes get LiveFiringPanel, others render directly */}
        <div className="flex-1 overflow-hidden">
          {isFireMode(activeMode) ? (
            <LiveFiringPanel initialMode={activeMode} standalone />
          ) : (
            <ScrollArea className="h-full">
              <div className="h-full" style={{ background: 'hsl(220 15% 6%)' }}>
                {renderDirectPanel(activeMode)}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
