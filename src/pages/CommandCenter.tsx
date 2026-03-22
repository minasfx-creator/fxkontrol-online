/**
 * CommandCenter — FXK 2.0 Execution Hub
 * 7 focused consoles: 4 main + Show Control + Module + DMX Monitor
 * Landscape mobile: game-style HUD with side rail + top bar
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ambientSound } from '@/lib/ambientSound';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { usePBusHardware } from '@/hooks/usePBusHardware';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import { cn } from '@/lib/utils';
import {
  Zap, Flame, Gauge, Layers, Activity, Cpu, Radio,
  Shield, Map, Menu
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import LiveFiringPanel from '@/components/editor/LiveFiringPanel';
import { CONSOLE_LOGOS } from '@/components/editor/ConsoleLogos';
import ConsoleBootSequence from '@/components/editor/ConsoleBootSequence';

// Direct-render components
import MA3ControlPanel from '@/components/editor/MA3ControlPanel';
import DroneCommandPanel from '@/components/editor/DroneCommandPanel';
import ShowControlPanel from '@/components/editor/ShowControlPanel';
import FXKNetPanel from '@/components/editor/live-firing/FXKNetPanel';
import DMXMonitorPanel from '@/components/editor/DMXMonitorPanel';
// ── Types ──
type CommandMode =
  | 'pyro_fire' | 'super_dmx' | 'fxk_light' | 'drone_ops'
  | 'show_control' | 'module' | 'dmx_monitor';

// Fire modes get full LiveFiringPanel chrome (ARM, CUE keys, PANIC)
const FIRE_MODES: CommandMode[] = ['pyro_fire', 'super_dmx'];
const isFireMode = (m: CommandMode) => FIRE_MODES.includes(m);

// ── Console Accent Config ──
const CONSOLE_ACCENTS: Record<string, { color: string; glow: string; label: string; badge: string; subtitle: string }> = {
  pyro_fire:    { color: 'hsl(0 85% 48%)',    glow: 'hsl(0 85% 48% / 0.1)',    label: 'FXK-PYRO',    badge: 'bg-red-500/15 text-red-400 border-red-500/20', subtitle: 'PYROTECHNIC FIRE CONTROL' },
  super_dmx:    { color: 'hsl(200 80% 48%)',   glow: 'hsl(200 80% 48% / 0.1)',   label: 'FXK-DMX',     badge: 'bg-blue-500/15 text-blue-400 border-blue-500/20', subtitle: 'SPECIAL EFFECTS CONSOLE' },
  fxk_light:    { color: 'hsl(240 50% 52%)',   glow: 'hsl(240 50% 52% / 0.08)',  label: 'FXK-LIGHT',   badge: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20', subtitle: 'LIGHTING MANAGEMENT' },
  drone_ops:    { color: 'hsl(165 100% 42%)',  glow: 'hsl(165 100% 42% / 0.08)', label: 'FXK-DRONE',   badge: 'bg-teal-500/15 text-teal-400 border-teal-500/20', subtitle: 'SWARM OPERATIONS' },
  show_control: { color: 'hsl(32 100% 50%)',   glow: 'hsl(32 100% 50% / 0.08)',  label: 'SHOW CTRL',   badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20', subtitle: 'MISSION CONTROL OVERVIEW' },
  module:       { color: 'hsl(270 60% 50%)',   glow: 'hsl(270 60% 50% / 0.08)',  label: 'MODULE',      badge: 'bg-violet-500/15 text-violet-400 border-violet-500/20', subtitle: 'FIELD HARDWARE CTRL' },
  dmx_monitor:  { color: 'hsl(120 70% 42%)',   glow: 'hsl(120 70% 42% / 0.08)',  label: 'DMX MONITOR', badge: 'bg-green-500/15 text-green-400 border-green-500/20', subtitle: 'PROTOCOL ANALYZER' },
};

// ── Sidebar Sections ──
const MODE_SECTIONS = [
  {
    label: 'EXECUTION',
    accent: 'text-red-400',
    icon: Flame,
    modes: [
      { key: 'pyro_fire' as CommandMode, label: 'FXK-PYRO', icon: Flame },
      { key: 'super_dmx' as CommandMode, label: 'FXK-DMX', icon: Zap },
    ],
  },
  {
    label: 'MONITORING',
    accent: 'text-amber-400',
    icon: Activity,
    modes: [
      { key: 'show_control' as CommandMode, label: 'SHOW CTRL', icon: Activity },
      { key: 'dmx_monitor' as CommandMode, label: 'DMX MONITOR', icon: Radio },
      { key: 'fxk_light' as CommandMode, label: 'FXK-LIGHT', icon: Gauge },
      { key: 'drone_ops' as CommandMode, label: 'FXK-DRONE', icon: Layers },
    ],
  },
  {
    label: 'HARDWARE',
    accent: 'text-violet-400',
    icon: Cpu,
    modes: [
      { key: 'module' as CommandMode, label: 'MODULE', icon: Cpu },
    ],
  },
];

const MOBILE_CATEGORIES = [
  { label: 'Exec', icon: Flame, section: 0 },
  { label: 'Monitor', icon: Activity, section: 1 },
  { label: 'Hardware', icon: Cpu, section: 2 },
];

export default function CommandCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = (searchParams.get('mode') as CommandMode) || 'show_control';
  const [activeMode, setActiveMode] = useState<CommandMode>(initialMode);
  const [swapPhase, setSwapPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const [swapFlash, setSwapFlash] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileCategory, setMobileCategory] = useState(0);
  const [isLandscape, setIsLandscape] = useState(false);
  const [bootConsole, setBootConsole] = useState<CommandMode | null>(initialMode);
  const [initialBootDone, setInitialBootDone] = useState(false);
  const isMobile = useIsMobile();
  const fireone = useFireOneHardware();
  const pbus = usePBusHardware();
  const activeEffects = useLiveSfxStore(s => s.activeEffects);
  const isArmed = activeEffects.length > 0;

  // Landscape detection
  useEffect(() => {
    const mql = window.matchMedia('(orientation: landscape)');
    const onChange = () => setIsLandscape(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    // Try to lock orientation on mobile
    if (isMobile && screen.orientation?.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
    return () => {
      mql.removeEventListener('change', onChange);
      if (isMobile && screen.orientation?.unlock) {
        screen.orientation.unlock();
      }
    };
  }, [isMobile]);

  const accent = CONSOLE_ACCENTS[activeMode] ?? CONSOLE_ACCENTS.show_control;

  const connectedCount = useMemo(() => {
    let c = 0;
    if (fireone.isConnected) c++;
    if (pbus.isConnected) c += pbus.deviceCount;
    return c;
  }, [fireone.isConnected, pbus.isConnected, pbus.deviceCount]);

  const handleModeChange = useCallback((mode: CommandMode) => {
    if (mode === activeMode || bootConsole) return;
    ambientSound.play('boot');
    // Swap-out current content, then boot new console
    setSwapPhase('out');
    setTimeout(() => {
      setSwapPhase('idle');
      setBootConsole(mode);
    }, 250);
  }, [activeMode, bootConsole]);

  const handleBootComplete = useCallback(() => {
    if (!bootConsole) return;
    if (!initialBootDone) setInitialBootDone(true);
    setActiveMode(bootConsole);
    setSearchParams({ mode: bootConsole }, { replace: true });
    setSwapPhase('in');
    setSwapFlash(true);
    setBootConsole(null);
    setTimeout(() => {
      setSwapPhase('idle');
      setSwapFlash(false);
    }, 400);
  }, [bootConsole, setSearchParams, initialBootDone]);

  // Direct-render for non-fire modes
  const renderDirectPanel = useCallback((mode: CommandMode) => {
    switch (mode) {
      case 'fxk_light': return <MA3ControlPanel fs />;
      case 'drone_ops': return <DroneCommandPanel fs />;
      case 'show_control': return <ShowControlPanel fs />;
      case 'module': return <FXKNetPanel fs />;
      case 'dmx_monitor': return <DMXMonitorPanel fs />;
      default: return null;
    }
  }, []);

  // All modes for current mobile category
  const allMobileModes = MODE_SECTIONS[mobileCategory]?.modes ?? MODE_SECTIONS[0].modes;
  const allModes = MODE_SECTIONS.flatMap(s => s.modes);

  // Mission clock
  const [missionClock, setMissionClock] = useState('00:00:00');
  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => {
      const e = Date.now() - start;
      const h = Math.floor(e / 3600000);
      const m = Math.floor((e % 3600000) / 60000);
      const s = Math.floor((e % 60000) / 1000);
      setMissionClock(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // ══════════════════════════════════════════════
  // MOBILE LANDSCAPE — Game-style HUD
  // ══════════════════════════════════════════════
  if (isMobile && isLandscape) {
    const ActiveLogo = CONSOLE_LOGOS[activeMode];
    return (
      <>
      <div className="h-[100dvh] w-screen flex flex-col bg-background overflow-hidden">
        {/* Top HUD bar — 32px */}
        <div className="landscape-hud-bar shrink-0 h-8 flex items-center justify-between px-2 relative z-20"
          style={{
            background: 'hsl(220 22% 3% / 0.95)',
            borderBottom: `1px solid ${accent.color}20`,
            paddingTop: 'env(safe-area-inset-top)',
          }}>
          {/* Accent glow line */}
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{
            background: `linear-gradient(90deg, transparent, ${accent.color}60, transparent)`,
          }} />
          <div className="flex items-center gap-2">
            {ActiveLogo && <ActiveLogo size={22} active />}
            <span className="text-[9px] font-black font-mono tracking-[0.2em]" style={{ color: accent.color }}>{accent.label}</span>
            <span className="text-[6px] font-mono text-muted-foreground/25 tracking-wider hidden sm:inline">{accent.subtitle}</span>
          </div>
          <div className="flex items-center gap-3">
            {isArmed && <Badge variant="destructive" className="text-[6px] h-4 px-1.5 animate-pulse font-mono rounded-sm">ARMED</Badge>}
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full" style={{
                backgroundColor: connectedCount > 0 ? 'hsl(120 70% 45%)' : 'hsl(220 10% 25%)',
                boxShadow: connectedCount > 0 ? '0 0 4px hsl(120 70% 45%)' : 'none',
              }} />
              <span className="text-[7px] font-mono text-muted-foreground/40">{connectedCount > 0 ? `${connectedCount}` : '—'}</span>
            </div>
            <span className="text-[8px] font-mono font-bold" style={{ color: 'hsl(32 100% 55%)', textShadow: '0 0 6px hsl(32 100% 50% / 0.3)' }}>{missionClock}</span>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Left nav rail — 44px */}
          <div className="landscape-nav-rail shrink-0 w-11 flex flex-col items-center py-1.5 gap-0.5 z-20"
            style={{
              background: 'hsl(220 22% 3% / 0.95)',
              borderRight: '1px solid hsl(var(--primary) / 0.06)',
              paddingLeft: 'env(safe-area-inset-left)',
            }}>
            {allModes.map(mode => {
              const isActive = activeMode === mode.key;
              const mAccent = CONSOLE_ACCENTS[mode.key];
              const Logo = CONSOLE_LOGOS[mode.key];
              return (
                <button
                  key={mode.key}
                  onClick={() => handleModeChange(mode.key)}
                  className={cn(
                    "w-9 h-9 flex items-center justify-center rounded-sm transition-all relative active:scale-90",
                    isActive ? "console-logo-glow" : "opacity-40 hover:opacity-70"
                  )}
                  style={isActive ? { background: mAccent?.glow, boxShadow: `0 0 8px ${mAccent?.color}30` } : undefined}
                  title={mode.label}
                >
                  {Logo ? <Logo size={24} active={isActive} /> : <mode.icon className="w-4 h-4" />}
                  {isActive && <div className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r" style={{ backgroundColor: mAccent?.color }} />}
                </button>
              );
            })}
          </div>

          {/* Main content — fills remaining */}
          <div className={cn(
            "flex-1 overflow-hidden holo-swap-container relative",
            swapPhase === 'out' ? 'swap-out' : swapPhase === 'in' ? 'swap-in' : '',
            swapFlash && 'swap-flash'
          )}>
            {/* HUD corner brackets */}
            <div className="pyro-hud-corner absolute top-1 left-1 w-4 h-4 border-t-2 border-l-2 z-10 pointer-events-none" style={{ borderColor: `${accent.color}30` }} />
            <div className="pyro-hud-corner absolute top-1 right-1 w-4 h-4 border-t-2 border-r-2 z-10 pointer-events-none" style={{ borderColor: `${accent.color}30` }} />
            <div className="pyro-hud-corner absolute bottom-1 left-1 w-4 h-4 border-b-2 border-l-2 z-10 pointer-events-none" style={{ borderColor: `${accent.color}30` }} />
            <div className="pyro-hud-corner absolute bottom-1 right-1 w-4 h-4 border-b-2 border-r-2 z-10 pointer-events-none" style={{ borderColor: `${accent.color}30` }} />

            {isFireMode(activeMode) ? (
              <LiveFiringPanel initialMode={activeMode} standalone />
            ) : (
              <div className="h-full surface-0">{renderDirectPanel(activeMode)}</div>
            )}
          </div>
        </div>
      </div>
      {bootConsole && (
        <ConsoleBootSequence consoleKey={bootConsole} label={CONSOLE_ACCENTS[bootConsole]?.label ?? ''} subtitle={CONSOLE_ACCENTS[bootConsole]?.subtitle ?? ''} accentColor={CONSOLE_ACCENTS[bootConsole]?.color ?? 'hsl(32 100% 50%)'} onComplete={handleBootComplete} />
      )}
      </>
    );
  }

  // ══════════════════════════════════════════════
  // MOBILE PORTRAIT
  // ══════════════════════════════════════════════
  if (isMobile) {
    return (
      <>
      <div className="h-[100dvh] w-screen flex flex-col bg-background">
        {/* HUD */}
        <div className="shrink-0 px-2 pt-1.5 pb-1" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div
            className={cn(
              "flex items-center justify-between px-3 py-2 rounded border transition-all",
              isArmed ? "border-destructive/30 glow-danger" : "border-primary/10"
            )}
            style={{ background: 'hsl(220 22% 3% / 0.95)', backdropFilter: 'blur(24px)' }}
          >
            <div className="flex items-center gap-2">
              {(() => { const L = CONSOLE_LOGOS[activeMode]; return L ? <L size={20} active /> : null; })()}
              <span className="text-[8px] font-bold text-foreground font-mono tracking-[0.15em]">
                {connectedCount > 0 ? `${connectedCount} LINK` : 'NO LINK'}
              </span>
            </div>
            <Badge variant="outline" className={cn("text-[7px] h-4.5 px-2 font-black border font-mono tracking-[0.15em] rounded-sm", accent.badge)}>
              {accent.label}
            </Badge>
            <div className="flex items-center gap-1">
              <span className="text-[7px] font-mono" style={{ color: 'hsl(32 100% 50% / 0.5)' }}>{missionClock}</span>
              {isArmed && <Badge variant="destructive" className="text-[6px] h-3.5 px-1 animate-pulse font-mono rounded-sm">ARM</Badge>}
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="shrink-0 px-2 py-1">
          <ScrollArea className="w-full">
            <div className="flex gap-1 pb-1">
              {allMobileModes.map(mode => {
                const isActive = activeMode === mode.key;
                const mAccent = CONSOLE_ACCENTS[mode.key];
                const Logo = CONSOLE_LOGOS[mode.key];
                return (
                  <button
                    key={mode.key}
                    onClick={() => handleModeChange(mode.key)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2.5 whitespace-nowrap transition-all",
                      "text-[10px] font-bold border min-h-[48px] font-mono tracking-wider uppercase rounded-sm",
                      isActive ? "text-foreground" : "border-border/10 text-muted-foreground/50 active:scale-95"
                    )}
                    style={{
                      background: isActive ? mAccent?.glow : 'hsl(220 18% 5% / 0.6)',
                      borderColor: isActive ? mAccent?.color + '33' : undefined,
                    }}
                  >
                    {Logo ? <Logo size={18} active={isActive} /> : <mode.icon className="w-3.5 h-3.5" />}
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isFireMode(activeMode) ? (
            <LiveFiringPanel initialMode={activeMode} standalone />
          ) : (
            <ScrollArea className="h-full">
              <div className="h-full surface-0">{renderDirectPanel(activeMode)}</div>
            </ScrollArea>
          )}
        </div>

        {/* Bottom Nav */}
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
      {bootConsole && (
        <ConsoleBootSequence consoleKey={bootConsole} label={CONSOLE_ACCENTS[bootConsole]?.label ?? ''} subtitle={CONSOLE_ACCENTS[bootConsole]?.subtitle ?? ''} accentColor={CONSOLE_ACCENTS[bootConsole]?.color ?? 'hsl(32 100% 50%)'} onComplete={handleBootComplete} />
      )}
      </>
    );
  }

  // ══════════════════════════════════════════════
  // DESKTOP LAYOUT
  // ══════════════════════════════════════════════
  return (
    <div className="h-full flex overflow-hidden pb-14">
      {/* Sidebar — Apple glassmorphism dock */}
      <div
        className={cn(
          "shrink-0 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          sidebarCollapsed ? "w-[56px]" : "w-56"
        )}
        style={{
          background: 'rgba(8, 10, 14, 0.85)',
          backdropFilter: 'blur(48px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(48px) saturate(1.8)',
          borderRight: '1px solid rgba(255, 255, 255, 0.04)',
        }}
      >
        {/* Status Header — frosted glass card */}
        <div className="px-2.5 pt-3 pb-2">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={cn(
              "w-full rounded-lg border transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
              "hover:border-primary/15 active:scale-[0.97]",
              sidebarCollapsed ? "p-2.5" : "px-3.5 py-2.5"
            )}
            style={{
              background: `linear-gradient(135deg, ${accent.glow}, hsl(220 22% 6% / 0.6))`,
              borderColor: accent.color + '12',
              boxShadow: `0 2px 12px ${accent.color}08, inset 0 1px 0 hsl(0 0% 100% / 0.03)`,
            }}
          >
            {sidebarCollapsed ? (
              <div className="flex flex-col items-center gap-1.5">
                <div className="h-2 w-2 rounded-full transition-all duration-300" style={{
                  backgroundColor: connectedCount > 0 ? accent.color : 'hsl(var(--muted-foreground) / 0.2)',
                  boxShadow: connectedCount > 0 ? `0 0 8px ${accent.color}60` : 'none',
                }} />
                <span className="text-[7px] font-mono text-muted-foreground/60 font-bold">{connectedCount}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="h-2.5 w-2.5 rounded-full shrink-0 transition-all duration-300" style={{
                  backgroundColor: connectedCount > 0 ? accent.color : 'hsl(var(--muted-foreground) / 0.2)',
                  boxShadow: connectedCount > 0 ? `0 0 10px ${accent.color}50` : 'none',
                }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] font-bold text-foreground/90 font-mono tracking-[0.2em] truncate">FXK COMMAND</p>
                  <p className="text-[7px] text-muted-foreground/40 font-mono tracking-wider">{connectedCount} LINKS ACTIVE</p>
                </div>
              </div>
            )}
          </button>
        </div>

        {/* Mode List — Apple-style selection indicators */}
        <ScrollArea className="flex-1 px-1.5">
          <div className="space-y-4 pb-3">
            {MODE_SECTIONS.map(section => (
              <div key={section.label}>
                {!sidebarCollapsed && (
                  <div className="flex items-center gap-2 px-2.5 mb-1.5">
                    <p className={cn("text-[7px] font-bold tracking-[0.3em] font-mono shrink-0 opacity-60", section.accent)}>
                      {section.label}
                    </p>
                    <div className="h-[1px] flex-1" style={{ background: 'linear-gradient(90deg, hsl(var(--primary) / 0.08), transparent)' }} />
                  </div>
                )}
                <div className="space-y-0.5">
                  {section.modes.map(mode => {
                    const isActive = activeMode === mode.key;
                    const mAccent = CONSOLE_ACCENTS[mode.key];
                    const Logo = CONSOLE_LOGOS[mode.key];
                    return (
                      <button
                        key={mode.key}
                        onClick={() => handleModeChange(mode.key)}
                        className={cn(
                          "w-full flex items-center gap-2.5 rounded-lg transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] relative group",
                          sidebarCollapsed ? "justify-center p-2.5" : "px-3 py-2.5 min-h-[42px]",
                          isActive
                            ? "text-foreground"
                            : "text-muted-foreground/40 hover:text-foreground/60 active:scale-[0.97]"
                        )}
                        style={isActive ? {
                          background: `linear-gradient(135deg, ${mAccent?.glow}, ${mAccent?.color}05)`,
                          boxShadow: `0 0 20px ${mAccent?.color}08, inset 0 1px 0 hsl(0 0% 100% / 0.03)`,
                        } : undefined}
                        title={sidebarCollapsed ? mode.label : undefined}
                      >
                        {/* Active indicator — pill style */}
                        {isActive && (
                          <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full transition-all duration-500" style={{
                            backgroundColor: mAccent?.color,
                            boxShadow: `0 0 8px ${mAccent?.color}60`,
                          }} />
                        )}
                        {/* Hover glow */}
                        {!isActive && (
                          <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            style={{ background: `linear-gradient(135deg, ${mAccent?.glow}50, transparent)` }} />
                        )}
                        <div className="relative z-10 flex items-center gap-2.5 w-full">
                          {Logo
                            ? <Logo size={sidebarCollapsed ? 24 : 20} active={isActive} />
                            : <mode.icon className={cn("shrink-0", sidebarCollapsed ? "w-5 h-5" : "w-4 h-4")} />
                          }
                          {!sidebarCollapsed && (
                            <span className="text-[9px] font-bold truncate font-mono tracking-wider uppercase">{mode.label}</span>
                          )}
                          {!sidebarCollapsed && isActive && (
                            <div className="ml-auto h-1.5 w-1.5 rounded-full animate-pulse shrink-0" style={{
                              backgroundColor: mAccent?.color,
                              boxShadow: `0 0 6px ${mAccent?.color}`,
                            }} />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Safety Footer — frosted glass */}
        {!sidebarCollapsed && (
          <div className="p-2.5 border-t" style={{ borderColor: 'hsl(var(--destructive) / 0.06)' }}>
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-300",
              isArmed ? "danger-stripe border-destructive/20" : "border-destructive/6"
            )} style={{
              background: isArmed ? 'hsl(var(--destructive) / 0.06)' : 'hsl(var(--destructive) / 0.02)',
              backdropFilter: 'blur(12px)',
            }}>
              <Shield className="h-3 w-3 text-destructive/40 shrink-0" />
              <span className="text-[7px] text-destructive/50 font-bold font-mono tracking-[0.15em]">
                {isArmed ? `ARMED // ${activeEffects.length} HOT` : 'SAFETY INTERLOCK'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Breadcrumb — Apple frosted glass bar */}
        <div
          className="h-11 shrink-0 flex items-center justify-between px-5 border-b relative overflow-hidden"
          style={{
            background: 'rgba(8, 10, 14, 0.88)',
            backdropFilter: 'blur(48px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(48px) saturate(1.8)',
            borderColor: 'rgba(255, 255, 255, 0.04)',
          }}
        >
          {/* Ambient accent line */}
          <div className="absolute bottom-0 left-0 right-0 h-[1px]" style={{
            background: `linear-gradient(90deg, ${accent.color}20, transparent 50%)`,
          }} />
          <div className="flex items-center gap-3">
            {(() => { const L = CONSOLE_LOGOS[activeMode]; return L ? <L size={24} active /> : null; })()}
            <Badge variant="outline" className={cn("text-[7px] h-5 px-2.5 font-black border font-mono tracking-[0.15em] rounded-md", accent.badge)}>
              {accent.label}
            </Badge>
            <div className="h-3.5 w-[1px] rounded-full" style={{ background: 'hsl(var(--primary) / 0.08)' }} />
            <span className="text-[7px] text-muted-foreground/20 font-mono tracking-[0.15em]">
              {accent.subtitle}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono font-bold" style={{ color: 'hsl(32 100% 55%)', textShadow: '0 0 8px hsl(32 100% 50% / 0.25)' }}>{missionClock}</span>
            {isArmed && (
              <Badge variant="destructive" className="text-[7px] h-5 animate-pulse font-mono tracking-wider rounded-md">
                ARMED // {activeEffects.length}
              </Badge>
            )}
            {connectedCount > 0 && (
              <Badge variant="outline" className="text-[7px] h-5 border-primary/10 text-primary/70 font-mono tracking-wider rounded-md">
                {connectedCount} ONLINE
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div className={cn(
          "flex-1 overflow-hidden holo-swap-container",
          swapPhase === 'out' ? 'swap-out' : swapPhase === 'in' ? 'swap-in' : '',
          swapFlash && 'swap-flash'
        )}>
          {isFireMode(activeMode) ? (
            <LiveFiringPanel initialMode={activeMode} standalone />
          ) : (
            <ScrollArea className="h-full">
              <div className="h-full surface-0">{renderDirectPanel(activeMode)}</div>
            </ScrollArea>
          )}
        </div>
      </div>
      {/* Boot Sequence Overlay */}
      {bootConsole && (
        <ConsoleBootSequence
          consoleKey={bootConsole}
          label={CONSOLE_ACCENTS[bootConsole]?.label ?? ''}
          subtitle={CONSOLE_ACCENTS[bootConsole]?.subtitle ?? ''}
          accentColor={CONSOLE_ACCENTS[bootConsole]?.color ?? 'hsl(32 100% 50%)'}
          onComplete={handleBootComplete}
        />
      )}
    </div>
  );
}
