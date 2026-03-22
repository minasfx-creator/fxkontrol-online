import { LayoutDashboard, Clapperboard, CalendarDays, LogOut, Gamepad2, Crosshair, Volume2, VolumeX, Cpu, Bluetooth, Rocket, Settings, Shield } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useState } from 'react';
import { ambientSound } from '@/lib/ambientSound';
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
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import minasfxLogo from '@/assets/minasfx-logo-white.png';

const navItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard, desc: 'Visão geral' },
  { title: 'Command', url: '/command', icon: Crosshair, desc: 'Execução ao vivo' },
  { title: 'Editor 3D', url: '/editor', icon: Clapperboard, desc: 'Design de show' },
  { title: 'Agenda', url: '/agenda', icon: CalendarDays, desc: 'Eventos' },
  { title: 'Training', url: '/training', icon: Gamepad2, desc: 'Simulação' },
  { title: 'Show Test', url: '/show-test', icon: Rocket, desc: 'Teste de show' },
  { title: 'Pairing', url: '/pairing', icon: Bluetooth, desc: 'Pareamento HW' },
  { title: 'PCB Viewer', url: '/pcb-viewer', icon: Cpu, desc: 'Hardware M1' },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const { isAdmin } = useAdminRole();
  const [soundMuted, setSoundMuted] = useState(ambientSound.muted);

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'FX';

  const handleNavClick = () => {
    ambientSound.play('click');
  };

  const toggleSound = () => {
    ambientSound.toggleMute();
    setSoundMuted(ambientSound.muted);
  };

  return (
    <Sidebar collapsible={isMobile ? 'offcanvas' : 'icon'} className={`border-r border-border bg-[hsl(var(--surface-0))] ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <SidebarContent>
        {/* Brand with MinasFX logo */}
        <div className={`px-3 pt-4 pb-2 ${collapsed ? 'flex justify-center' : ''} animate-holo-materialize`}>
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
              <TooltipProvider delayDuration={0}>
                {navItems.map((item, i) => {
                  const isActive = item.url === '/' 
                    ? location.pathname === '/' 
                    : location.pathname.startsWith(item.url);
                  
                  const navContent = (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end={item.url === '/'}
                          onClick={handleNavClick}
                          className={`dock-item gap-3 rounded-xl mx-1 transition-all duration-200 ${
                            isActive 
                              ? 'shadow-[inset_0_0_0_1px_hsl(32_100%_50%/0.15)]' 
                              : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground hover:shadow-[inset_0_1px_4px_hsl(220_30%_1%/0.3)]'
                          }`}
                          style={{
                            ...(isActive ? { background: 'hsl(32 100% 50% / 0.1)', color: 'hsl(32 100% 50%)' } : undefined),
                            animationDelay: `${0.05 * i}s`,
                          }}
                          activeClassName=""
                        >
                          <item.icon className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} style={isActive ? { color: 'hsl(32 100% 50%)', filter: 'drop-shadow(0 0 4px hsl(32 100% 50% / 0.4))' } : undefined} />
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

                  if (collapsed) {
                    return (
                      <Tooltip key={item.title}>
                        <TooltipTrigger asChild>
                          {navContent}
                        </TooltipTrigger>
                        <TooltipContent side="right" className="glass-hud border-primary/10 text-[10px] font-mono-code">
                          <p className="font-bold">{item.title}</p>
                          <p className="text-muted-foreground text-[8px]">{item.desc}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return navContent;
                })}
              </TooltipProvider>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Settings & Admin links */}
      <SidebarContent className="mt-auto pb-0">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.2em] px-3" style={{ color: 'hsl(32 100% 50% / 0.4)' }}>
            {!collapsed && 'Sistema'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <TooltipProvider delayDuration={0}>
                {[
                  { title: 'Configurações', url: '/settings', icon: Settings, desc: 'Perfil operador' },
                  ...(isAdmin ? [{ title: 'Admin', url: '/admin', icon: Shield, desc: 'Gestão plataforma' }] : []),
                ].map(item => {
                  const active = location.pathname === item.url;
                  const content = (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          onClick={handleNavClick}
                          className={`dock-item gap-3 rounded-xl mx-1 transition-all duration-200 ${
                            active ? 'shadow-[inset_0_0_0_1px_hsl(32_100%_50%/0.15)]' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                          }`}
                          style={active ? { background: 'hsl(32 100% 50% / 0.1)', color: 'hsl(32 100% 50%)' } : undefined}
                          activeClassName=""
                        >
                          <item.icon className={`h-4 w-4 shrink-0 ${active ? 'scale-110' : ''}`} style={active ? { color: 'hsl(32 100% 50%)', filter: 'drop-shadow(0 0 4px hsl(32 100% 50% / 0.4))' } : undefined} />
                          {!collapsed && <span className="text-xs font-medium">{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                  if (collapsed) {
                    return (
                      <Tooltip key={item.title}>
                        <TooltipTrigger asChild>{content}</TooltipTrigger>
                        <TooltipContent side="right" className="glass-hud border-primary/10 text-[10px] font-mono-code">
                          <p className="font-bold">{item.title}</p>
                          <p className="text-muted-foreground text-[8px]">{item.desc}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return content;
                })}
              </TooltipProvider>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with user + sound control */}
      <SidebarFooter className="p-2 space-y-1">
        {/* Sound toggle */}
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground text-xs"
          onClick={toggleSound}
        >
          {soundMuted ? <VolumeX className="h-3.5 w-3.5 shrink-0" /> : <Volume2 className="h-3.5 w-3.5 shrink-0" />}
          {!collapsed && <span className="text-[9px] font-mono-code">{soundMuted ? 'SOM OFF' : 'SOM ON'}</span>}
        </Button>

        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl animate-holo-materialize" style={{ background: 'hsl(32 100% 50% / 0.05)', animationDelay: '0.3s' }}>
            <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 relative" style={{ background: 'hsl(32 100% 50% / 0.15)' }}>
              <span className="text-[9px] font-bold" style={{ color: 'hsl(32 100% 50%)' }}>{initials}</span>
              {/* Online status dot */}
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: 'hsl(var(--surface-0))', background: 'hsl(120 70% 45%)', boxShadow: '0 0 4px hsl(120 70% 45% / 0.5)' }} />
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
