import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { FXKAssistant } from '@/components/FXKAssistant';
import { useIsMobile } from '@/hooks/use-mobile';
import { PanelLeftClose, PanelLeft, AlertOctagon, Menu } from 'lucide-react';
import minasfxLogo from '@/assets/minasfx-logo-white.png';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import { useDisplayStore } from '@/store/useDisplayStore';
import { haptics } from '@/lib/haptics';
import { ambientSound } from '@/lib/ambientSound';
import { useEffect, useRef, useState } from 'react';
import DockBar from '@/components/DockBar';

function SidebarToggleButton() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  return (
    <button
      onClick={toggleSidebar}
      className="flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-all active:scale-90"
      title={collapsed ? 'Expandir menu' : 'Recolher menu'}
    >
      {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </button>
  );
}

function MobileSidebarTrigger() {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      onClick={toggleSidebar}
      className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all active:scale-90"
      title="Menu"
    >
      <Menu className="h-4.5 w-4.5" />
    </button>
  );
}

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isEditor = location.pathname === '/editor';
  const isCommand = location.pathname === '/command';
  const commandImmersive = isCommand;
  const isMobile = useIsMobile();
  const prevPathRef = useRef(location.pathname);
  const [humStarted, setHumStarted] = useState(false);

  // Page transition state machine
  const [transitionPhase, setTransitionPhase] = useState<'idle' | 'dissolve-out' | 'materialize-in'>('idle');
  const [displayedPath, setDisplayedPath] = useState(location.pathname);
  const transitionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeEffects = useLiveSfxStore(s => s.activeEffects);
  const clearAll = useLiveSfxStore(s => s.clearAll);
  const isArmed = activeEffects.length > 0;

  const backlight = useDisplayStore(s => s.backlight);

  const showDock = !isEditor && !isCommand && !isMobile;
  const showMobileDock = !isEditor && !isCommand && isMobile;

  // Start ambient hum on first user gesture
  useEffect(() => {
    if (humStarted) return;
    const handler = () => {
      ambientSound.startHum();
      setHumStarted(true);
      document.removeEventListener('click', handler);
    };
    document.addEventListener('click', handler, { once: true });
    return () => document.removeEventListener('click', handler);
  }, [humStarted]);

  // Route change: holographic dissolve-out → materialize-in
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      ambientSound.play('nav');

      // Phase 1: dissolve out current content
      setTransitionPhase('dissolve-out');

      if (transitionTimeout.current) clearTimeout(transitionTimeout.current);

      transitionTimeout.current = setTimeout(() => {
        // Phase 2: swap content & materialize in
        setDisplayedPath(location.pathname);
        setTransitionPhase('materialize-in');

        transitionTimeout.current = setTimeout(() => {
          setTransitionPhase('idle');
        }, 700);
      }, 350);

      prevPathRef.current = location.pathname;
    }
    return () => {
      if (transitionTimeout.current) clearTimeout(transitionTimeout.current);
    };
  }, [location.pathname]);

  const handlePanic = () => {
    clearAll();
    haptics.panic();
  };

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div
        className="min-h-[100dvh] flex w-full bg-background br2049-vignette"
        style={{ filter: `brightness(${backlight / 100})` }}
      >
        {/* Sidebar — hidden in Command Center immersive mode */}
        {!commandImmersive && <AppSidebar />}

        <div className="flex-1 flex flex-col min-w-0">
          {/* ARMED Banner */}
          {isArmed && !commandImmersive && (
            <button
              onClick={() => navigate('/command')}
              className="shrink-0 w-full flex items-center justify-center gap-2 py-1.5 danger-stripe armed-pulse cursor-pointer transition-all hover:brightness-110"
              style={{
                background: 'hsl(var(--destructive) / 0.15)',
                borderBottom: '1px solid hsl(var(--destructive) / 0.3)',
              }}
            >
              <AlertOctagon className="w-3.5 h-3.5 text-destructive animate-pulse" />
              <span className="text-[10px] font-mono-code font-black tracking-[0.2em] text-destructive uppercase">
                ⚠ SYSTEM ARMED — {activeEffects.length} CHANNEL{activeEffects.length > 1 ? 'S' : ''} HOT
              </span>
            </button>
          )}

          {/* Header — Apple frosted glass bar */}
          {!commandImmersive && (
            <header
              className={`flex items-center border-b px-3 shrink-0 relative overflow-hidden ${isEditor ? 'h-8' : 'h-10'}`}
              style={{
                background: 'rgba(8, 10, 14, 0.85)',
                backdropFilter: 'blur(48px) saturate(1.8)',
                WebkitBackdropFilter: 'blur(48px) saturate(1.8)',
                borderColor: 'hsl(32 100% 50% / 0.06)',
              }}
            >
              <div className="absolute inset-0 animate-holographic-scan pointer-events-none opacity-20" />
              {isMobile ? (
                <MobileSidebarTrigger />
              ) : (
                <SidebarToggleButton />
              )}
              <div className="ml-3 flex items-center gap-2 relative z-10">
                <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'hsl(32 100% 50%)', boxShadow: '0 0 6px hsl(32 100% 50% / 0.5)' }} />
                <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: 'hsl(32 100% 50% / 0.8)', textShadow: '0 0 8px hsl(32 100% 50% / 0.3)' }}>
                  FX KONTROL
                </span>
              </div>
              <div className="ml-auto flex items-center gap-2 relative z-10">
                <img src={minasfxLogo} alt="MinasFX" className="h-4 object-contain opacity-60" />
              </div>
            </header>
          )}

          <main className={`${(isEditor || isCommand) ? 'flex-1 min-h-0' : 'flex-1 overflow-auto p-4 md:p-6'} relative`}
            style={showDock || showMobileDock ? { paddingBottom: '72px' } : undefined}>
            {/* Holographic light sweep overlay during transition */}
            {transitionPhase !== 'idle' && (
              <div className="absolute inset-0 pointer-events-none z-50 animate-page-sweep" />
            )}
            {/* Content with dissolve/materialize phase transitions */}
            <div
              key={displayedPath}
              className={`h-full ${
                transitionPhase === 'dissolve-out'
                  ? 'animate-page-dissolve-out'
                  : transitionPhase === 'materialize-in'
                    ? 'animate-page-materialize-in'
                    : ''
              }`}
            >
              <Outlet />
            </div>
          </main>
        </div>

        <FXKAssistant />

        {/* Global PANIC FAB */}
        {isArmed && !commandImmersive && (
          <button
            onClick={handlePanic}
            className="fixed z-[9999] flex items-center justify-center rounded-xl border-2 border-destructive/60 transition-all active:scale-90 armed-pulse"
            style={{
              bottom: isMobile ? '80px' : '80px',
              right: '16px',
              width: '64px',
              height: '64px',
              background: 'hsl(var(--destructive) / 0.9)',
              boxShadow: '0 0 24px hsl(var(--destructive) / 0.4), 0 0 64px hsl(var(--destructive) / 0.15)',
            }}
            title="EMERGENCY STOP — ALL CHANNELS"
          >
            <div className="flex flex-col items-center">
              <AlertOctagon className="w-6 h-6 text-white" />
              <span className="text-[7px] font-mono-code font-black text-white tracking-widest mt-0.5">PANIC</span>
            </div>
          </button>
        )}

        {showDock && <DockBar />}
        {showMobileDock && <DockBar />}
      </div>
    </SidebarProvider>
  );
}
