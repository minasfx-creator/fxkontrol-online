import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Messenger } from '@/components/Messenger';
import minasfxLogo from '@/assets/minasfx-logo-white.png';

export default function MainLayout() {
  const location = useLocation();
  const isEditor = location.pathname === '/editor';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {!isEditor && (
            <header className="h-10 flex items-center border-b border-border/50 px-3 shrink-0 bg-[hsl(var(--surface-0))]">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
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
          )}

          <main className={isEditor ? 'flex-1 min-h-0' : 'flex-1 overflow-auto p-4 md:p-6'}>
            <Outlet />
          </main>
        </div>

        <Messenger />

        {!isEditor && (
          <div className="fixed bottom-0 left-0 right-0 h-6 flex items-center justify-between px-4 border-t z-40"
            style={{ background: 'hsl(var(--surface-0) / 0.9)', backdropFilter: 'blur(12px)', borderColor: 'hsl(var(--border) / 0.1)' }}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="status-dot-offline" />
                <span className="text-[8px] font-mono-code text-muted-foreground/40">0 HW</span>
              </div>
              <span className="text-[8px] font-mono-code text-muted-foreground/20">·</span>
              <span className="text-[8px] font-mono-code text-muted-foreground/40">IDLE</span>
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
