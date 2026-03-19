import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { NewsTicker } from '@/components/NewsTicker';

export default function MainLayout() {
  const location = useLocation();
  const isEditor = location.pathname === '/editor';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Header — hidden in editor mode for max viewport */}
          {!isEditor && (
            <header className="h-11 flex items-center border-b border-border px-2 shrink-0">
              <SidebarTrigger className="text-muted-foreground" />
              <span className="ml-3 text-sm font-semibold tracking-wide text-foreground/80">
                FX KONTROL
              </span>
            </header>
          )}

          <div className="flex-1 flex min-h-0">
            {/* Main content */}
            <main className={isEditor ? 'flex-1 min-h-0' : 'flex-1 overflow-auto p-6'}>
              <Outlet />
            </main>

            {/* News ticker — only on non-editor pages */}
            {!isEditor && <NewsTicker />}
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
