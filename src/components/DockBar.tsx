/**
 * DockBar — macOS-style application dock with 3D perspective tilt,
 * glassmorphism, magnification on hover, and active indicators.
 * Inspired by MacBook Pro dock with rotational depth effect.
 */
import React, { useCallback, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ambientSound } from '@/lib/ambientSound';
import { haptics } from '@/lib/haptics';
import {
  LayoutDashboard, Clapperboard, CalendarDays,
  Crosshair, Gamepad2, Rocket,
  Settings, Shield,
} from 'lucide-react';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface DockItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  accent?: string;
}

const DOCK_MAIN: DockItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Crosshair, label: 'Command', path: '/command', accent: 'hsl(0 85% 48%)' },
  { icon: Clapperboard, label: 'Editor 3D', path: '/editor', accent: 'hsl(32 100% 50%)' },
  { icon: CalendarDays, label: 'Agenda', path: '/agenda' },
  { icon: Gamepad2, label: 'Training', path: '/training' },
  { icon: Rocket, label: 'Show Test', path: '/show-test' },
];

const DOCK_SYSTEM: DockItem[] = [
  { icon: Settings, label: 'Config', path: '/settings' },
];

export default function DockBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAdminRole();
  const isMobile = useIsMobile();
  const dockRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });

  const allItems = [
    ...DOCK_MAIN,
    ...DOCK_SYSTEM,
    ...(isAdmin ? [{ icon: Shield, label: 'Admin', path: '/admin', accent: 'hsl(270 60% 50%)' } as DockItem] : []),
  ];
  const separatorIndex = DOCK_MAIN.length;

  const handleClick = useCallback((path: string) => {
    ambientSound.play('click');
    haptics.tap();
    navigate(path);
  }, [navigate]);

  // 3D perspective tilt based on mouse position over dock
  const handleDockMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!dockRef.current) return;
    const rect = dockRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;  // 0..1
    const y = (e.clientY - rect.top) / rect.height;   // 0..1
    setTilt({
      rotateX: (0.5 - y) * 8,  // subtle vertical tilt
      rotateY: (x - 0.5) * 6,  // horizontal rotation following cursor
    });
  }, []);

  const handleDockMouseLeave = useCallback(() => {
    setHoveredIndex(null);
    setTilt({ rotateX: 0, rotateY: 0 });
  }, []);

  const getScale = (index: number) => {
    if (hoveredIndex === null) return 1;
    const dist = Math.abs(index - hoveredIndex);
    if (dist === 0) return 1.45;
    if (dist === 1) return 1.18;
    if (dist === 2) return 1.06;
    return 1;
  };

  const getTranslateY = (index: number) => {
    if (hoveredIndex === null) return 0;
    const dist = Math.abs(index - hoveredIndex);
    if (dist === 0) return -12;
    if (dist === 1) return -5;
    if (dist === 2) return -1;
    return 0;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))', perspective: '800px' }}>
      <TooltipProvider delayDuration={200}>
        <div
          ref={dockRef}
          className={cn(
            "pointer-events-auto dock-3d-glass rounded-2xl flex items-end",
            isMobile ? "px-1 py-1.5 gap-0" : "px-2.5 py-1.5 gap-0.5"
          )}
          onMouseMove={isMobile ? undefined : handleDockMouseMove}
          onMouseLeave={isMobile ? undefined : handleDockMouseLeave}
          style={{
            transform: isMobile ? undefined : `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
            transition: isMobile ? undefined : (hoveredIndex !== null
              ? 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)'
              : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)'),
            transformStyle: isMobile ? undefined : 'preserve-3d',
          }}
        >
          {/* Ambient reflection layer — desktop only */}
          {!isMobile && (
            <div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden">
              <div className="absolute inset-0 dock-reflection" />
              <div className="absolute inset-0 dock-scanline" />
            </div>
          )}

          {allItems.map((item, i) => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            const scale = isMobile ? 1 : getScale(i);
            const translateY = isMobile ? 0 : getTranslateY(i);
            const Icon = item.icon;
            const accentColor = item.accent || 'hsl(var(--primary))';

            return (
              <React.Fragment key={item.path}>
                {i === separatorIndex && (
                  <div className={cn(
                    "rounded-full self-center",
                    isMobile ? "w-[1px] h-5 mx-0" : "w-[1px] h-6 mx-0.5"
                  )} style={{ background: 'hsl(var(--primary) / 0.1)' }} />
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleClick(item.path)}
                      onMouseEnter={isMobile ? undefined : () => setHoveredIndex(i)}
                      className={cn(
                        "relative flex flex-col items-center justify-center rounded-xl transition-all",
                        "active:scale-90",
                        isMobile ? "w-12 h-14 gap-0.5" : "w-11 h-11",
                        isActive ? "dock-item-active" : "hover:bg-white/[0.04]"
                      )}
                      style={{
                        transform: isMobile ? undefined : `scale(${scale}) translateY(${translateY}px) translateZ(${hoveredIndex === i ? 8 : 0}px)`,
                        transition: isMobile ? undefined : 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.15s ease',
                      }}
                    >
                      <Icon
                        className={cn(
                          "transition-colors duration-200",
                          isMobile ? "w-5 h-5" : "w-5 h-5"
                        )}
                        style={{
                          color: isActive ? accentColor : 'hsl(var(--muted-foreground) / 0.5)',
                          filter: isActive ? `drop-shadow(0 0 6px ${accentColor})` : 'none',
                        }}
                      />
                      {/* Label — mobile only */}
                      {isMobile && (
                        <span
                          className="text-[7px] font-bold tracking-wider leading-none truncate max-w-[40px]"
                          style={{
                            color: isActive ? accentColor : 'hsl(var(--muted-foreground) / 0.35)',
                          }}
                        >
                          {item.label.length > 6 ? item.label.slice(0, 5) + '.' : item.label}
                        </span>
                      )}
                      {isActive && (
                        <div className={cn(
                          "absolute rounded-full",
                          isMobile ? "-bottom-0 w-1 h-1" : "-bottom-0.5 w-1 h-1"
                        )}
                          style={{
                            background: accentColor,
                            boxShadow: `0 0 4px ${accentColor}`,
                          }}
                        />
                      )}
                    </button>
                  </TooltipTrigger>
                  {!isMobile && (
                    <TooltipContent
                      side="top"
                      sideOffset={8}
                      className="glass-menu px-3 py-1.5 text-[10px] font-semibold tracking-wider"
                    >
                      {item.label}
                    </TooltipContent>
                  )}
                </Tooltip>
              </React.Fragment>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
}
