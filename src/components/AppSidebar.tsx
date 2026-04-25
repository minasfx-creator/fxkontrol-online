import { Briefcase, Wand2, Crosshair, LogOut, Volume2, VolumeX, Settings, Shield } from 'lucide-react';

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

// ─── Refactor 3-áreas ────────────────────────────────────────────
// Consolidação Office | Studio | Command. Rotas antigas ficam acessíveis
// via redirects em App.tsx (zero quebra para bookmarks).
const navItems = [
  { title: 'Office', url: '/office', icon: Briefcase, desc: 'Produtividade & docs' },
  { title: 'Studio', url: '/studio', icon: Wand2, desc: 'Criação 3D AI-first' },
  { title: 'Command', url: '/command', icon: Crosshair, desc: 'Execução ao vivo' },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  // On mobile the sidebar opens as a Sheet (offcanvas) — always show labels
  const showLabels = isMobile || !collapsed;
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
    <Sidebar collapsible={isMobile ? 'offcanvas' : 'icon'} className={`glass-sidebar ${!showLabels ? 'sidebar-collapsed' : ''}`}>
      <SidebarContent>
        {/* Brand — 8pt: p-3 inset, gap-2 between logo & title */}
        <div className={`p-3 ${!showLabels ? 'flex justify-center' : ''} animate-holo-materialize`}>
          {!showLabels ? (
            <div className="h-8 w-8 rounded-control flex items-center justify-center overflow-hidden" style={{ background: 'hsl(32 100% 50% / 0.15)' }}>
              <img src={minasfxLogo} alt="MinasFX" className="h-5 object-contain" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <img src={minasfxLogo} alt="MinasFX" className="h-7 object-contain shrink-0" style={{ filter: 'drop-shadow(0 0 6px hsl(32 100% 50% / 0.3))' }} />
              <div>
                <p className="text-xs font-bold text-foreground tracking-wide" style={{ textShadow: '0 0 8px hsl(32 100% 50% / 0.2)' }}>FX KONTROL</p>
                <p className="text-[9px] font-mono-code" style={{ color: 'hsl(32 100% 50% / 0.5)' }}>by MinasFX</p>
              </div>
            </div>
          )}
          {showLabels && <div className="mt-2 h-px" style={{ background: 'hsl(var(--material-stroke))' }} />}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.2em] px-3" style={{ color: 'hsl(32 100% 50% / 0.4)' }}>
            {showLabels && 'Módulos'}
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
                          className={`dock-item gap-3 rounded-2xl mx-1 transition-all duration-300 ease-spring ${
                            isActive 
                              ? 'shadow-[inset_0_0_0_1px_hsl(32_100%_50%/0.15)] bg-white/[0.04]' 
                              : 'text-muted-foreground hover:bg-white/[0.03] hover:text-foreground'
                          }`}
                          style={{
                            ...(isActive ? { background: 'hsl(32 100% 50% / 0.1)', color: 'hsl(32 100% 50%)' } : undefined),
                            animationDelay: `${0.05 * i}s`,
                          }}
                          activeClassName=""
                        >
                          <item.icon className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} style={isActive ? { color: 'hsl(32 100% 50%)', filter: 'drop-shadow(0 0 4px hsl(32 100% 50% / 0.4))' } : undefined} />
                          {showLabels && (
                            <div className="flex flex-col">
                              <span className="text-xs font-medium">{item.title}</span>
                              <span className="text-[9px] text-muted-foreground/60">{item.desc}</span>
                            </div>
                          )}
                          {isActive && showLabels && (
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
            {showLabels && 'Sistema'}
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
                          className={`dock-item gap-3 rounded-2xl mx-1 transition-all duration-300 ease-spring ${
                            active ? 'shadow-[inset_0_0_0_1px_hsl(32_100%_50%/0.15)] bg-white/[0.04]' : 'text-muted-foreground hover:bg-white/[0.03] hover:text-foreground'
                          }`}
                          style={active ? { background: 'hsl(32 100% 50% / 0.1)', color: 'hsl(32 100% 50%)' } : undefined}
                          activeClassName=""
                        >
                          <item.icon className={`h-4 w-4 shrink-0 ${active ? 'scale-110' : ''}`} style={active ? { color: 'hsl(32 100% 50%)', filter: 'drop-shadow(0 0 4px hsl(32 100% 50% / 0.4))' } : undefined} />
                          {showLabels && <span className="text-xs font-medium">{item.title}</span>}
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
          size={!showLabels ? 'icon' : 'sm'}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground text-xs"
          onClick={toggleSound}
        >
          {soundMuted ? <VolumeX className="h-3.5 w-3.5 shrink-0" /> : <Volume2 className="h-3.5 w-3.5 shrink-0" />}
          {showLabels && <span className="text-[9px] font-mono-code">{soundMuted ? 'SOM OFF' : 'SOM ON'}</span>}
        </Button>

        {showLabels && (
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
          size={!showLabels ? 'icon' : 'sm'}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive text-xs"
          onClick={() => signOut()}
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          {showLabels && <span>Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
