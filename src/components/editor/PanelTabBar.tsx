import { Route, Wind, FileText, Package, Cpu, DollarSign, Spline, Sliders, Settings2, Bug, Gauge, Lightbulb, Battery, Radio, Clock, Globe, ShieldCheck, Tag, Sparkles, Music, Download, StickyNote, Video, Box, ShoppingBag, Shield, Wand2, Eye, Warehouse, Link2, Users, FileBarChart, Volume2, Camera, Share2, Atom, History, Cloud, Zap, Navigation, FolderOpen, Activity, Map, Cog, MessageSquare, Factory, Film, Grid3x3, ArrowRightLeft, Radar, Timer, Crosshair, BookOpen, FlaskConical, BarChart3, Layers, CircuitBoard, Plane, Wrench, ScanLine, Orbit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState, useCallback, useRef } from 'react';

export type PanelId = 'script' | 'wind' | 'reports' | 'racks' | 'addressing' | 'inventory' | 'waypoints' | 'effects' | 'properties' | 'boids' | 'pid' | 'dmx' | 'battery' | 'mavlink' | 'smpte' | 'maps' | 'diagnostic' | 'logistics' | 'swarmgpt' | 'synesthesia' | 'firing' | 'labels' | 'video' | 'models' | 'safety' | 'scripting' | 'audience' | 'indoor' | 'chains' | 'groups' | 'scene' | 'soundlevel' | 'aroverlay' | 'share' | 'particles' | 'versioning' | 'weather' | 'collisions' | 'approval' | 'trajectory' | 'templates' | 'telemetry' | 'flightlog' | 'marketplace' | 'sitelayout' | 'showsettings' | 'calibration' | 'livefiring' | 'fleet' | 'geofence' | 'storyboard' | 'showcontrol' | 'inspector' | 'lightprogram' | 'safetycheck' | 'takeoffgrid' | 'transitions' | 'lasercontrol' | 'suppliers';

const PANEL_SECTIONS: { title: string; icon: typeof Route; items: { id: PanelId; label: string; icon: typeof Route; shortcut?: string }[] }[] = [
  {
    title: 'Editor',
    icon: Settings2,
    items: [
      { id: 'properties', label: 'Properties', icon: Settings2, shortcut: 'P' },
      { id: 'effects', label: 'Effect Editor', icon: Sliders, shortcut: 'E' },
      { id: 'script', label: 'Script Editor', icon: Route, shortcut: 'S' },
      { id: 'waypoints', label: 'Waypoints', icon: Spline, shortcut: 'W' },
      { id: 'chains', label: 'Chains', icon: Link2, shortcut: 'C' },
      { id: 'groups', label: 'Groups', icon: Users, shortcut: 'G' },
    ],
  },
  {
    title: 'Design',
    icon: Sparkles,
    items: [
      { id: 'swarmgpt', label: 'SwarmGPT AI', icon: Sparkles, shortcut: 'A' },
      { id: 'synesthesia', label: 'Audio Sync', icon: Music, shortcut: 'Y' },
      { id: 'scripting', label: 'Scripting', icon: Wand2, shortcut: 'T' },
      { id: 'safety', label: 'Safety NFPA', icon: Shield, shortcut: 'F' },
      { id: 'collisions', label: 'Collisions', icon: Crosshair },
      { id: 'trajectory', label: 'Trajectory Opt', icon: Navigation },
      { id: 'templates', label: 'Templates', icon: FolderOpen },
      { id: 'calibration', label: 'VDL Calibration', icon: FlaskConical },
    ],
  },
  {
    title: 'Hardware',
    icon: Package,
    items: [
      { id: 'racks', label: 'Racks', icon: Package },
      { id: 'addressing', label: 'Addressing', icon: Cpu },
      { id: 'inventory', label: 'Inventory', icon: DollarSign },
      { id: 'labels', label: 'Labels', icon: StickyNote },
      { id: 'suppliers', label: 'Suppliers', icon: ShoppingBag },
    ],
  },
  {
    title: 'Export',
    icon: Download,
    items: [
      { id: 'firing', label: 'Firing Export', icon: Download, shortcut: 'X' },
      { id: 'video', label: 'Recorder', icon: Video, shortcut: 'V' },
      { id: 'reports', label: 'Reports', icon: BarChart3 },
      { id: 'models', label: '3D Models', icon: Box },
      { id: 'aroverlay', label: 'AR Overlay', icon: Camera },
      { id: 'share', label: 'Share', icon: Share2 },
    ],
  },
  {
    title: 'Drone',
    icon: Plane,
    items: [
      { id: 'fleet', label: 'Fleet Manager', icon: Radar },
      { id: 'showcontrol', label: 'Show Control', icon: CircuitBoard },
      { id: 'takeoffgrid', label: 'Takeoff Grid', icon: Grid3x3 },
      { id: 'transitions', label: 'Transitions', icon: ArrowRightLeft },
      { id: 'lightprogram', label: 'Light Program', icon: Lightbulb },
      { id: 'safetycheck', label: 'Safety Check', icon: ShieldCheck },
      { id: 'storyboard', label: 'Storyboard', icon: Film },
      { id: 'boids', label: 'Boids', icon: Orbit },
      { id: 'pid', label: 'PID Tuning', icon: Gauge },
      { id: 'battery', label: 'Battery', icon: Battery },
      { id: 'mavlink', label: 'MAVLink', icon: Radio },
      { id: 'indoor', label: 'Indoor Sim', icon: Warehouse },
      { id: 'telemetry', label: 'Telemetry', icon: Activity },
      { id: 'flightlog', label: 'Flight Log', icon: BookOpen },
      { id: 'geofence', label: 'Geofence', icon: Layers },
      { id: 'inspector', label: 'Inspector', icon: Eye },
    ],
  },
  {
    title: 'Integ.',
    icon: Wrench,
    items: [
      { id: 'dmx', label: 'DMX512', icon: ScanLine },
      { id: 'lasercontrol', label: 'Laser Control', icon: Zap },
      { id: 'smpte', label: 'SMPTE/LTC', icon: Timer },
      { id: 'livefiring', label: 'Live SFX', icon: Sparkles },
      { id: 'diagnostic', label: 'Diagnostic', icon: Bug, shortcut: 'D' },
      { id: 'logistics', label: 'Logistics', icon: Tag },
    ],
  },
  {
    title: 'Scene',
    icon: Globe,
    items: [
      { id: 'scene', label: 'Scene Editor', icon: Cog, shortcut: 'N' },
      { id: 'wind', label: 'Wind/Camera', icon: Wind },
      { id: 'maps', label: 'Google Maps', icon: Globe },
      { id: 'sitelayout', label: 'Site Layout', icon: Map },
      { id: 'weather', label: 'Weather', icon: Cloud },
      { id: 'soundlevel', label: 'Sound Level', icon: Volume2 },
      { id: 'particles', label: 'Particles', icon: Atom },
      { id: 'audience', label: 'Audience', icon: FileBarChart },
      { id: 'showsettings', label: 'Show Settings', icon: Settings2 },
      { id: 'approval', label: 'Approval', icon: MessageSquare },
      { id: 'versioning', label: 'Versioning', icon: History },
    ],
  },
];

interface PanelTabBarProps {
  activePanel: PanelId | null;
  onTogglePanel: (id: PanelId) => void;
}

export default function PanelTabBar({ activePanel, onTogglePanel }: PanelTabBarProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const [mouseY, setMouseY] = useState<number | null>(null);
  const buttonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const toggleSection = (title: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMouseY(e.clientY - rect.top);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setMouseY(null);
  }, []);

  let globalIdx = 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="w-[52px] flex-shrink-0 border-l border-border/10 flex flex-col" style={{ background: 'hsl(var(--card))' }}>
        <ScrollArea className="flex-1">
          <div
            ref={containerRef}
            className="flex flex-col items-center py-2 gap-0"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {PANEL_SECTIONS.map((section, si) => {
              const isCollapsed = collapsedSections.has(section.title);
              const hasActive = section.items.some(i => i.id === activePanel);
              const SectionIcon = section.icon;

              return (
                <div key={section.title} className="w-full">
                  {/* Section header */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => toggleSection(section.title)}
                        className={cn(
                          "w-full flex items-center justify-center py-2.5 transition-all relative group",
                          hasActive
                            ? "text-primary"
                            : "text-muted-foreground/40 hover:text-muted-foreground/70"
                        )}
                      >
                        {hasActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-primary rounded-r shadow-[0_0_6px_hsl(var(--primary)/0.4)]" />
                        )}
                        <div className="flex flex-col items-center gap-0.5">
                          <SectionIcon className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                          <span className="text-[7px] font-bold tracking-[0.12em] uppercase leading-none opacity-60 font-display">{section.title}</span>
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-[11px] font-semibold bg-popover border-border/20 rounded-xl px-3 py-1.5">
                      {section.title}
                    </TooltipContent>
                  </Tooltip>

                  {/* Section items with dock magnification */}
                  {!isCollapsed && (
                    <div className="flex flex-col items-center gap-[2px] pb-1.5">
                      {section.items.map(({ id, label, icon: Icon, shortcut }) => {
                        const isActive = activePanel === id;
                        const currentIdx = globalIdx++;
                        const capturedIdx = currentIdx;

                        // Calculate scale from mouse position
                        const btn = buttonRefs.current[capturedIdx];
                        let scale = 1;
                        if (mouseY !== null && btn && containerRef.current) {
                          const containerRect = containerRef.current.getBoundingClientRect();
                          const btnRect = btn.getBoundingClientRect();
                          const btnCenter = btnRect.top + btnRect.height / 2 - containerRect.top;
                          const distance = Math.abs(mouseY - btnCenter);
                          const maxDist = 55;
                          if (distance < maxDist) {
                            const t = 1 - distance / maxDist;
                            scale = 1 + 0.35 * (Math.cos((1 - t) * Math.PI) + 1) / 2;
                          }
                        }

                        return (
                          <Tooltip key={id}>
                            <TooltipTrigger asChild>
                              <button
                                ref={el => {
                                  buttonRefs.current[capturedIdx] = el;
                                }}
                                onClick={() => onTogglePanel(id)}
                                style={{
                                  transform: `scale(${scale})`,
                                  transition: 'transform 0.12s cubic-bezier(0.25, 0.1, 0.25, 1)',
                                  zIndex: scale > 1.1 ? 10 : 1,
                                }}
                                className={cn(
                                  "w-9 h-9 flex items-center justify-center rounded-xl relative transition-colors duration-150",
                                  isActive
                                    ? "bg-primary/12 text-primary shadow-[0_0_12px_hsl(var(--primary)/0.15)]"
                                    : "text-muted-foreground/45 hover:text-foreground hover:bg-surface-1/40"
                                )}
                              >
                                {isActive && (
                                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-primary rounded-r" />
                                )}
                                <Icon className="w-4 h-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-[11px] font-semibold bg-popover border-border/15 rounded-xl px-3 py-1.5" sideOffset={scale > 1.1 ? 10 : 6}>
                              {label}{shortcut ? ` (${shortcut})` : ''}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  )}

                  {/* Divider */}
                  {si < PANEL_SECTIONS.length - 1 && (
                    <div className="mx-3 border-t border-border/8 my-1.5" />
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}
