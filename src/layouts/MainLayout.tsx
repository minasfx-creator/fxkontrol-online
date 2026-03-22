import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { FXKAssistant } from '@/components/FXKAssistant';
import { useIsMobile } from '@/hooks/use-mobile';
import { PanelLeftClose, PanelLeft, AlertOctagon } from 'lucide-react';
import minasfxLogo from '@/assets/minasfx-logo-white.png';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import { useDisplayStore } from '@/store/useDisplayStore';
import { haptics } from '@/lib/haptics';

function SidebarToggleButton() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  return (
    <button
      onClick={toggleSidebar}
      className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
      title={collapsed ? 'Expandir menu' : 'Recolher menu'}
    >
      {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </button>
  );
}

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isEditor = location.pathname === '/editor';
  const isMobile = useIsMobile();

  const activeEffects = useLiveSfxStore(s => s.activeEffects);
  const clearAll = useLiveSfxStore(s => s.clearAll);
  const isArmed = activeEffects.length > 0;

  const backlight = useDisplayStore(s => s.backlight);

  const handlePanic = () => {
    clearAll();
    haptics.panic();
  };

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div
        className="min-h-screen flex w-full bg-background"
        style={{ filter: `brightness(${backlight / 100})` }}
      >
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* ARMED Banner — global, unmissable */}
          {isArmed && (
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

          {/* Header */}
          <header className={`flex items-center border-b border-border/50 px-3 shrink-0 bg-[hsl(var(--surface-0))] ${isEditor ? 'h-8' : 'h-10'}`}>
            <SidebarToggleButton />
            <div className="ml-3 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
                FX KONTROL
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <img src={minasfxLogo} alt="MinasFX" className="h-4 object-contain opacity-60" />
            </div>
          </header>

          <main className={isEditor ? 'flex-1 min-h-0' : 'flex-1 overflow-auto p-4 md:p-6'}>
            <Outlet />
          </main>
        </div>

        <Messenger />

        {/* Global PANIC FAB — visible on all pages when armed */}
        {isArmed && (
          <button
            onClick={handlePanic}
            className="fixed z-[9999] flex items-center justify-center rounded-sm border-2 border-destructive/60 transition-all active:scale-90 armed-pulse"
            style={{
              bottom: isMobile ? '80px' : '32px',
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

        {!isEditor && (
          <div className="fixed bottom-0 left-0 right-0 h-6 flex items-center justify-between px-4 border-t z-40"
            style={{ background: 'hsl(var(--surface-0) / 0.9)', backdropFilter: 'blur(12px)', borderColor: 'hsl(var(--border) / 0.1)' }}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="status-dot-offline" />
                <span className="text-[8px] font-mono-code text-muted-foreground/50">0 HW</span>
              </div>
              <span className="text-[8px] font-mono-code text-muted-foreground/30">·</span>
              <span className="text-[8px] font-mono-code text-muted-foreground/50">
                {isArmed ? 'ARMED' : 'IDLE'}
              </span>
            </div>
            <button
              onClick={() => window.location.href = '/editor'}
              className="text-[8px] font-mono-code text-primary/60 hover:text-primary px-2 py-0.5 rounded hover:bg-primary/5 transition-colors"
            >
              PRE-FLIGHT →
            </button>
          </div>
        )}
      </div>
    </SidebarProvider>
  );
}
