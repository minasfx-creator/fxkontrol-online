/**
 * CommandCenter — Standalone execution page separated from Editor
 * Apple glassmorphism design, no 3D viewport overhead
 */
import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { usePBusHardware } from '@/hooks/usePBusHardware';
import { cn } from '@/lib/utils';
import {
  Zap, Lightbulb, Hand, Flame, Timer, Check, Cpu, Cable,
  Gauge, Wifi, Globe, Plug, Radio, Map, Smartphone, Settings,
  Shield, AlertTriangle, ChevronRight
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import LiveFiringPanel from '@/components/editor/LiveFiringPanel';

type CommandMode =
  | 'super_dmx' | 'simple_dmx' | 'manual_fire' | 'pyro_fire' | 'auto_fire' | 'check_slave'
  | 'controllers' | 'pbus' | 'ma3' | 'module' | 'wifi_direct'
  | 'artnet_modules' | 'connections' | 'radio' | 'field_map'
  | 'mobile_link' | 'settings';

interface ModeEntry {
  key: CommandMode;
  label: string;
  icon: React.ElementType;
}

const MODE_SECTIONS = [
  {
    label: 'FIRE CONTROL',
    accent: 'text-red-400',
    modes: [
      { key: 'super_dmx' as CommandMode, label: 'Super DMX', icon: Zap },
      { key: 'simple_dmx' as CommandMode, label: 'Simple DMX', icon: Lightbulb },
      { key: 'manual_fire' as CommandMode, label: 'Manual', icon: Hand },
      { key: 'pyro_fire' as CommandMode, label: 'Pyro XL4', icon: Flame },
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
      { key: 'ma3' as CommandMode, label: 'MA3', icon: Gauge },
      { key: 'module' as CommandMode, label: 'IFM x32Q', icon: Cpu },
      { key: 'wifi_direct' as CommandMode, label: 'WiFi Direct', icon: Wifi },
    ],
  },
  {
    label: 'NETWORK',
    accent: 'text-primary',
    modes: [
      { key: 'artnet_modules' as CommandMode, label: 'Art-Net', icon: Globe },
      { key: 'connections' as CommandMode, label: 'Connections', icon: Plug },
      { key: 'radio' as CommandMode, label: 'Radio', icon: Radio },
      { key: 'field_map' as CommandMode, label: 'Field Map', icon: Map },
    ],
  },
  {
    label: 'SYSTEM',
    accent: 'text-muted-foreground',
    modes: [
      { key: 'mobile_link' as CommandMode, label: 'Mobile Link', icon: Smartphone },
      { key: 'settings' as CommandMode, label: 'Settings', icon: Settings },
    ],
  },
];

export default function CommandCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = (searchParams.get('mode') as CommandMode) || 'super_dmx';
  const [activeMode, setActiveMode] = useState<CommandMode>(initialMode);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const fireone = useFireOneHardware();
  const pbus = usePBusHardware();

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

  const currentModeLabel = useMemo(() => {
    for (const section of MODE_SECTIONS) {
      const found = section.modes.find(m => m.key === activeMode);
      if (found) return found.label;
    }
    return activeMode;
  }, [activeMode]);

  // Mobile: render LiveFiringPanel in fullscreen with initial mode
  if (isMobile) {
    return (
      <div className="h-[100dvh] w-screen">
        <LiveFiringPanel initialMode={activeMode} standalone />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3rem)] flex overflow-hidden">
      {/* ── Glass Sidebar ── */}
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
        {/* Dynamic Island Status */}
        <div className="px-3 pt-4 pb-3">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={cn(
              "w-full rounded-2xl border border-border/20 transition-all duration-300",
              "bg-[hsl(var(--surface-1)/0.6)] backdrop-blur-xl",
              "hover:border-primary/30 hover:bg-[hsl(var(--surface-2)/0.6)]",
              sidebarCollapsed ? "p-2" : "px-3 py-2"
            )}
          >
            {sidebarCollapsed ? (
              <div className="flex flex-col items-center gap-1">
                <div className={cn("h-2 w-2 rounded-full", connectedCount > 0 ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/30")} />
                <span className="text-[8px] font-mono text-muted-foreground">{connectedCount}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className={cn("h-2 w-2 rounded-full shrink-0", connectedCount > 0 ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/30")} />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold text-foreground uppercase tracking-wider truncate">Command Center</p>
                  <p className="text-[8px] text-muted-foreground font-mono">{connectedCount} connected</p>
                </div>
                {fireone.isConnected && (
                  <Badge variant="outline" className="text-[7px] h-4 px-1 border-red-500/30 text-red-400 shrink-0">FO</Badge>
                )}
                {pbus.isConnected && (
                  <Badge variant="outline" className="text-[7px] h-4 px-1 border-amber-500/30 text-amber-400 shrink-0">PB</Badge>
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
                    return (
                      <button
                        key={mode.key}
                        onClick={() => handleModeChange(mode.key)}
                        className={cn(
                          "w-full flex items-center gap-2.5 rounded-xl transition-all duration-200",
                          sidebarCollapsed ? "justify-center p-2" : "px-2.5 py-2",
                          isActive
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "text-muted-foreground/60 hover:bg-muted/20 hover:text-foreground/80 border border-transparent"
                        )}
                        title={sidebarCollapsed ? mode.label : undefined}
                      >
                        <mode.icon className={cn("shrink-0", sidebarCollapsed ? "w-4 h-4" : "w-3.5 h-3.5")} />
                        {!sidebarCollapsed && (
                          <span className="text-[10px] font-semibold truncate">{mode.label}</span>
                        )}
                        {!sidebarCollapsed && isActive && (
                          <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse shrink-0" />
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
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-destructive/5 border border-destructive/10">
              <Shield className="h-3 w-3 text-destructive/60 shrink-0" />
              <span className="text-[8px] text-destructive/60 font-semibold">SAFETY LOCK ACTIVE</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Breadcrumb bar */}
        <div
          className="h-10 shrink-0 flex items-center justify-between px-4 border-b border-border/15"
          style={{ background: 'hsl(225 12% 7% / 0.8)', backdropFilter: 'blur(20px)' }}
        >
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">{currentModeLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            {connectedCount > 0 && (
              <Badge variant="outline" className="text-[8px] h-5 border-emerald-500/20 text-emerald-400">
                {connectedCount} ONLINE
              </Badge>
            )}
          </div>
        </div>

        {/* LiveFiringPanel rendered standalone */}
        <div className="flex-1 overflow-hidden">
          <LiveFiringPanel initialMode={activeMode} standalone />
        </div>
      </div>
    </div>
  );
}
