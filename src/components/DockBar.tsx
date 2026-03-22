/**
 * DockBar — macOS-style application dock with glassmorphism,
 * magnification on hover, and active indicators.
 * Fixed at the bottom of the viewport (non-editor pages).
 */
import React, { useCallback, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ambientSound } from '@/lib/ambientSound';
import { haptics } from '@/lib/haptics';
import {
  LayoutDashboard, Clapperboard, CalendarDays,
  Crosshair, Gamepad2, Cpu, Bluetooth, Rocket,
  Settings, Shield,
} from 'lucide-react';
import { useAdminRole } from '@/hooks/useAdminRole';
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
  const dockRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const allItems = [
    ...DOCK_MAIN,
    ...DOCK_SYSTEM,
    ...(isAdmin ? [{ icon: Shield, label: 'Admin', path: '/admin', accent: 'hsl(270 60% 50%)' } as DockItem] : []),
  ];
  const separatorIndex = DOCK_MAIN.length; // separator between main and system

  const handleClick = useCallback((path: string) => {
    ambientSound.play('click');
    haptics.tap();
    navigate(path);
  }, [navigate]);

  const getScale = (index: number) => {
    if (hoveredIndex === null) return 1;
    const dist = Math.abs(index - hoveredIndex);
    if (dist === 0) return 1.4;
    if (dist === 1) return 1.15;
    if (dist === 2) return 1.05;
    return 1;
  };

  const getTranslateY = (index: number) => {
    if (hoveredIndex === null) return 0;
    const dist = Math.abs(index - hoveredIndex);
    if (dist === 0) return -10;
    if (dist === 1) return -4;
    if (dist === 2) return -1;
    return 0;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-2 pointer-events-none"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
      <TooltipProvider delayDuration={200}>
        <div
          ref={dockRef}
          className="pointer-events-auto glass-dock rounded-2xl px-2 py-1.5 flex items-end gap-0.5"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {allItems.map((item, i) => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            const scale = getScale(i);
            const translateY = getTranslateY(i);
            const Icon = item.icon;
            const accentColor = item.accent || 'hsl(var(--primary))';

            return (
              <React.Fragment key={item.path}>
                {/* Separator between main and system */}
                {i === separatorIndex && (
                  <div className="w-[1px] h-6 mx-0.5 rounded-full self-center" style={{ background: 'hsl(var(--primary) / 0.1)' }} />
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleClick(item.path)}
                      onMouseEnter={() => setHoveredIndex(i)}
                      className={cn(
                        "relative flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all",
                        "active:scale-90",
                        isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                      )}
                      style={{
                        transform: `scale(${scale}) translateY(${translateY}px)`,
                        transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.15s ease',
                      }}
                    >
                      <Icon
                        className="w-5 h-5 transition-colors duration-200"
                        style={{
                          color: isActive ? accentColor : 'hsl(var(--muted-foreground) / 0.5)',
                          filter: isActive ? `drop-shadow(0 0 6px ${accentColor})` : 'none',
                        }}
                      />
                      {isActive && (
                        <div className="absolute -bottom-0.5 w-1 h-1 rounded-full"
                          style={{
                            background: accentColor,
                            boxShadow: `0 0 4px ${accentColor}`,
                          }}
                        />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={8}
                    className="glass-menu px-3 py-1.5 text-[10px] font-semibold tracking-wider"
                  >
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              </React.Fragment>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
}
