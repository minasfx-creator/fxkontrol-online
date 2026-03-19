import { LayoutDashboard, Clapperboard, CalendarDays, GraduationCap, LogOut, Gamepad2 } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
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
  { title: 'Editor 3D', url: '/editor', icon: Clapperboard, desc: 'Design de show' },
  { title: 'Agenda', url: '/agenda', icon: CalendarDays, desc: 'Eventos' },
  { title: 'Training', url: '/training', icon: Gamepad2, desc: 'Simulação' },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { user, signOut } = useAuth();

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'FX';

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-[hsl(var(--surface-0))]">
      <SidebarContent>
        {/* Brand with MinasFX logo */}
        <div className={`px-3 pt-4 pb-2 ${collapsed ? 'flex justify-center' : ''}`}>
          {collapsed ? (
            <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center overflow-hidden">
              <img src={minasfxLogo} alt="MinasFX" className="h-5 object-contain" />
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <img src={minasfxLogo} alt="MinasFX" className="h-7 object-contain shrink-0 brightness-0 invert" />
              <div>
                <p className="text-xs font-bold text-foreground tracking-wide">FX KONTROL</p>
                <p className="text-[9px] text-muted-foreground font-mono">by MinasFX</p>
              </div>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60 px-3">
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
                            ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]' 
                            : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                        }`}
                        activeClassName=""
                      >
                        <item.icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : ''}`} />
                        {!collapsed && (
                          <div className="flex flex-col">
                            <span className="text-xs font-medium">{item.title}</span>
                            <span className="text-[9px] text-muted-foreground/60">{item.desc}</span>
                          </div>
                        )}
                        {isActive && !collapsed && (
                          <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
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
