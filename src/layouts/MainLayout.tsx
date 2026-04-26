import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { PanelLeftClose, PanelLeft, AlertOctagon, Menu, Wand2 } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import minasfxLogo from '@/assets/minasfx-logo-white.png';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import { useDisplayStore } from '@/store/useDisplayStore';
import { haptics } from '@/lib/haptics';
import { ambientSound } from '@/lib/ambientSound';
import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { flushSync } from 'react-dom';
import DockBar from '@/components/DockBar';
import BetaPromoBanner from '@/components/BetaPromoBanner';
import QuickJumpMenu from '@/components/QuickJumpMenu';
import { lazyRetry } from '@/lib/lazyRetry';

// Native View Transitions API support — captured once at module load.
// Graceful fallback to CSS dissolve/materialize when unavailable.
const SUPPORTS_VIEW_TRANSITIONS =
  typeof document !== 'undefined' && 'startViewTransition' in document;

// Dev-only overlay — tree-shaken in production
const RenderCounterOverlay = import.meta.env.DEV
  ? lazy(lazyRetry(() => import('@/components/dev/RenderCounterOverlay')))
  : () => null;

// Lazy-load heavy components that aren't needed for initial paint
const AppSidebar = lazy(lazyRetry(() => import('@/components/AppSidebar').then(m => ({ default: m.AppSidebar }))));
const FXKAssistant = lazy(lazyRetry(() => import('@/components/FXKAssistant').then(m => ({ default: m.FXKAssistant }))));
// Deterministic kernel (timeline clock pump, lockstep, persistence) — must
// mount on EVERY protected route AND on mobile so Play actually advances time.
// Previously this was nested inside <Index> desktop branch only, which left
// the timeline frozen on mobile and on routes other than /studio.
const EngineProvider = lazy(lazyRetry(() => import('@/orchestration/EngineProvider')));

function SidebarToggleButton() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  return (
    <button
      onClick={toggleSidebar}
      className="flex items-center justify-center h-8 w-8 rounded-control text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-all active:scale-90"
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
      className="flex items-center justify-center h-8 w-8 rounded-control text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all active:scale-90"
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

  // Route change: native View Transitions when supported (Chromium 111+,
  // Safari 18+, Edge 111+). Fallback: CSS cross-fade (180ms+220ms).
  //
  // Why native:
  //   • The browser captures both DOM states as compositor-level snapshots
  //     and animates the swap on the GPU — no React reflow during the fade,
  //     no JIT layout work, no stutter on heavy consoles.
  //   • Glassmorphism layers (Dock, Sidebar, Header) keep their `backdrop-
  //     filter` blur stable across the transition because they're captured
  //     as bitmap snapshots — no per-frame blur recomputation.
  //   • Animation timing/easing lives entirely in CSS via the
  //     `::view-transition-*` pseudo-elements — see index.css.
  useEffect(() => {
    if (prevPathRef.current === location.pathname) return;
    ambientSound.play('nav');
    prevPathRef.current = location.pathname;

    if (SUPPORTS_VIEW_TRANSITIONS) {
      // Native path: skip the CSS state-machine and let the browser
      // crossfade the captured snapshots. flushSync forces React to commit
      // the new tree synchronously inside the transition callback so the
      // browser snapshots the *new* state, not the stale one.
      // We also keep `transitionPhase` at 'idle' so the fallback CSS
      // animation classes don't fire on top of the native crossfade.
      setTransitionPhase('idle');
      (document as Document & { startViewTransition: (cb: () => void) => unknown })
        .startViewTransition(() => {
          flushSync(() => setDisplayedPath(location.pathname));
        });
      return;
    }

    // Fallback path — CSS dissolve/materialize.
    setTransitionPhase('dissolve-out');
    if (transitionTimeout.current) clearTimeout(transitionTimeout.current);
    transitionTimeout.current = setTimeout(() => {
      setDisplayedPath(location.pathname);
      setTransitionPhase('materialize-in');
      transitionTimeout.current = setTimeout(() => {
        setTransitionPhase('idle');
      }, 220);
    }, 180);

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
        className="h-[100dvh] flex w-full bg-background br2049-vignette overflow-hidden"
        style={{ filter: `brightness(${backlight / 100})` }}
      >
        {!commandImmersive && !isEditor && (
          <Suspense fallback={null}>
            <AppSidebar />
          </Suspense>
        )}

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Beta Promo Banner */}
          {!commandImmersive && !isEditor && <BetaPromoBanner />}

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

          {/* Header — Apple minimal: toggle + logo. Sem texto redundante,
              sem dot pulsante. A sidebar já identifica o app; o header só
              dá ar e controla a navegação. */}
          {!commandImmersive && !isEditor && (
            <header
              role="banner"
              className="material-thin flex items-center px-3 shrink-0 relative h-10"
              style={{ borderBottom: '1px solid hsl(var(--material-stroke))' }}
            >
              {isMobile ? (
                <MobileSidebarTrigger />
              ) : (
                <SidebarToggleButton />
              )}
              <div className="ml-auto flex items-center gap-3 relative z-10">
                {location.pathname !== '/studio' && (
                  <NavLink
                    to="/studio"
                    className="flex items-center gap-1.5 h-7 px-2.5 rounded-control text-[11px] font-medium tracking-wide transition-all active:scale-95"
                    style={{
                      background: 'hsl(32 100% 50% / 0.12)',
                      color: 'hsl(32 100% 50%)',
                      boxShadow: 'inset 0 0 0 1px hsl(32 100% 50% / 0.25)',
                    }}
                    title="Abrir editor 3D (Studio)"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Studio</span>
                  </NavLink>
                )}
                <img
                  src={minasfxLogo}
                  alt="MinasFX"
                  className="h-4 object-contain opacity-50 hover:opacity-80 transition-opacity duration-200"
                />
              </div>
            </header>
          )}

          <main role="main" className={`${(isEditor || isCommand) ? 'flex-1 min-h-0 overflow-hidden' : 'flex-1 overflow-auto p-4 md:p-6'} relative`}
            style={showDock || showMobileDock ? { paddingBottom: '72px' } : undefined}>
            {(isEditor || isCommand) ? (
              <Outlet />
            ) : (
              <>
                <div
                  key={displayedPath}
                  className={`h-full ${
                    transitionPhase === 'dissolve-out'
                      ? 'animate-page-dissolve-out'
                      : transitionPhase === 'materialize-in'
                        ? 'animate-page-materialize-in'
                        : ''
                  }`}
                  // `view-transition-name` opts this subtree into the native
                  // crossfade. Persistent chrome (sidebar, dock, header) lives
                  // *outside* this div so it stays put across the transition —
                  // only the route content morphs.
                  style={{ viewTransitionName: 'route-content' }}
                >
                  <Outlet />
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {/* Deterministic kernel — boots once for the entire app session */}
      <Suspense fallback={null}>
        <EngineProvider />
      </Suspense>

      {/* Overlays OUTSIDE the filtered div so position:fixed works correctly */}
      <Suspense fallback={null}>
        <FXKAssistant />
      </Suspense>

      {isArmed && !commandImmersive && (
        <button
          onClick={handlePanic}
          className="fixed z-[9999] flex items-center justify-center rounded-xl border-2 border-destructive/60 transition-all active:scale-90 armed-pulse"
          style={{
            bottom: '80px',
            right: '16px',
            width: '64px',
            height: '64px',
            background: 'hsl(var(--destructive) / 0.9)',
            boxShadow: '0 0 24px hsl(var(--destructive) / 0.4), 0 0 64px hsl(var(--destructive) / 0.15)',
          }}
          title="EMERGENCY STOP — ALL CHANNELS"
          aria-label="Emergency stop — all channels"
        >
          <div className="flex flex-col items-center">
            <AlertOctagon className="w-6 h-6 text-white" />
            <span className="text-[7px] font-mono-code font-black text-white tracking-widest mt-0.5">PANIC</span>
          </div>
        </button>
      )}

      {(showDock || showMobileDock) && <DockBar />}

      {/* Dev-only render counter overlay */}
      <Suspense fallback={null}>
        <RenderCounterOverlay />
      </Suspense>
    </SidebarProvider>
  );
}
