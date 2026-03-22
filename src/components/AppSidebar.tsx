import { LayoutDashboard, Clapperboard, CalendarDays, GraduationCap, LogOut, Gamepad2, Crosshair } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import minasfxLogo from '@/assets/minasfx-logo-white.png';

const navItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard, desc: 'Visão geral' },
  { title: 'Command', url: '/command', icon: Crosshair, desc: 'Execução ao vivo' },
  { title: 'Editor 3D', url: '/editor', icon: Clapperboard, desc: 'Design de show' },
  { title: 'Agenda', url: '/agenda', icon: CalendarDays, desc: 'Eventos' },
  { title: 'Training', url: '/training', icon: Gamepad2, desc: 'Simulação' },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'FX';

  return (
    <Sidebar collapsible={isMobile ? 'offcanvas' : 'icon'} className="border-r border-border bg-[hsl(var(--surface-0))]">
      <SidebarContent>
        {/* Brand with MinasFX logo */}
        <div className={`px-3 pt-4 pb-2 ${collapsed ? 'flex justify-center' : ''}`}>
          {collapsed ? (
            <div className="h-8 w-8 rounded-lg flex items-center justify-center overflow-hidden" style={{ background: 'hsl(32 100% 50% / 0.15)' }}>
              <img src={minasfxLogo} alt="MinasFX" className="h-5 object-contain" />
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <img src={minasfxLogo} alt="MinasFX" className="h-7 object-contain shrink-0" style={{ filter: 'drop-shadow(0 0 6px hsl(32 100% 50% / 0.3))' }} />
              <div>
                <p className="text-xs font-bold text-foreground tracking-wide" style={{ textShadow: '0 0 8px hsl(32 100% 50% / 0.2)' }}>FX KONTROL</p>
                <p className="text-[9px] font-mono-code" style={{ color: 'hsl(32 100% 50% / 0.5)' }}>by MinasFX</p>
              </div>
            </div>
          )}
          {!collapsed && <div className="mt-2 h-[1px]" style={{ background: 'linear-gradient(90deg, hsl(32 100% 50% / 0.2), transparent)' }} />}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.2em] px-3" style={{ color: 'hsl(32 100% 50% / 0.4)' }}>
            {!collapsed && 'Módulos'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.url === '/' 
                  ? location.pathname === '/' 
                  : location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === '/'}
                        className={`gap-3 rounded-lg mx-1 transition-all duration-200 ${
                          isActive 
                            ? 'shadow-[inset_0_0_0_1px_hsl(32_100%_50%/0.15)]' 
                            : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                        }`}
                        style={isActive ? { background: 'hsl(32 100% 50% / 0.1)', color: 'hsl(32 100% 50%)' } : undefined}
                        activeClassName=""
                      >
                        <item.icon className={`h-4 w-4 shrink-0 ${isActive ? '' : ''}`} style={isActive ? { color: 'hsl(32 100% 50%)' } : undefined} />
                        {!collapsed && (
                          <div className="flex flex-col">
                            <span className="text-xs font-medium">{item.title}</span>
                            <span className="text-[9px] text-muted-foreground/60">{item.desc}</span>
                          </div>
                        )}
                        {isActive && !collapsed && (
                          <div className="ml-auto h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'hsl(32 100% 50%)', boxShadow: '0 0 6px hsl(32 100% 50% / 0.5)' }} />
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with user */}
      <SidebarFooter className="p-2 space-y-1">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/20">
            <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-primary">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-foreground truncate">{user?.email?.split('@')[0]}</p>
              <p className="text-[8px] text-muted-foreground font-mono truncate">{user?.email}</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive text-xs"
          onClick={() => signOut()}
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
