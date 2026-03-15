import { Route, Wind, FileText, Package, Cpu, DollarSign, Spline, Sliders, Settings2, Bug, Gauge, Lightbulb, Battery, Radio, Clock, Globe, ShieldCheck, Tag, Sparkles, Music, Download, StickyNote, Video, Box, Image, ShoppingBag, Shield, Wand2, Eye, Warehouse, Link2, Users, ChevronDown, ChevronRight, FileBarChart, Volume2, Camera, Share2, Atom, History, Cloud, Zap, Navigation, FolderOpen, Activity, Map, Cog, MessageSquare, Factory, Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState, useCallback, useRef } from 'react';

export type PanelId = 'script' | 'wind' | 'reports' | 'racks' | 'addressing' | 'inventory' | 'waypoints' | 'effects' | 'properties' | 'boids' | 'pid' | 'dmx' | 'battery' | 'mavlink' | 'smpte' | 'maps' | 'diagnostic' | 'logistics' | 'swarmgpt' | 'synesthesia' | 'firing' | 'labels' | 'video' | 'models' | 'background' | 'suppliers' | 'safety' | 'scripting' | 'audience' | 'indoor' | 'chains' | 'groups' | 'summary' | 'scene' | 'soundlevel' | 'aroverlay' | 'share' | 'collab' | 'particles' | 'versioning' | 'weather' | 'collisions' | 'approval' | 'trajectory' | 'templates' | 'telemetry' | 'flightlog' | 'pathplanner' | 'marketplace' | 'sitelayout' | 'showsettings' | 'calibration' | 'livefiring' | 'fleet' | 'geofence' | 'storyboard' | 'showcontrol' | 'inspector' | 'lightprogram' | 'safetycheck';

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
    title: 'Show Design',
    icon: Sparkles,
    items: [
      { id: 'swarmgpt', label: 'SwarmGPT AI', icon: Sparkles, shortcut: 'A' },
      { id: 'synesthesia', label: 'Audio Sync', icon: Music, shortcut: 'Y' },
      { id: 'scripting', label: 'Scripting', icon: Wand2, shortcut: 'T' },
      { id: 'safety', label: 'Safety NFPA', icon: Shield, shortcut: 'F' },
      { id: 'collisions', label: 'Collisions', icon: Zap },
      { id: 'trajectory', label: 'Trajectory Opt', icon: Navigation },
      { id: 'pathplanner', label: 'Path Planner', icon: Route },
      { id: 'templates', label: 'Templates', icon: FolderOpen },
      { id: 'marketplace', label: 'Marketplace', icon: Globe },
      { id: 'calibration', label: 'VDL Calibration', icon: Factory },
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
    title: 'Export & Media',
    icon: Download,
    items: [
      { id: 'firing', label: 'Firing Export', icon: Download, shortcut: 'X' },
      { id: 'video', label: 'Recorder', icon: Video, shortcut: 'V' },
      { id: 'reports', label: 'Reports', icon: FileText },
      { id: 'models', label: '3D Models', icon: Box },
      { id: 'aroverlay', label: 'AR Overlay', icon: Camera },
      { id: 'share', label: 'Share', icon: Share2 },
    ],
  },
  {
    title: 'Drone',
    icon: Bug,
    items: [
      { id: 'fleet', label: 'Fleet Manager', icon: Radio },
      { id: 'lightprogram', label: 'Light Program', icon: Lightbulb },
      { id: 'safetycheck', label: 'Safety Check', icon: ShieldCheck },
      { id: 'boids', label: 'Boids', icon: Bug },
      { id: 'pid', label: 'PID', icon: Gauge },
      { id: 'battery', label: 'Battery', icon: Battery },
      { id: 'mavlink', label: 'MAVLink', icon: Radio },
      { id: 'indoor', label: 'Indoor Sim', icon: Warehouse },
      { id: 'telemetry', label: 'Telemetry', icon: Activity },
      { id: 'flightlog', label: 'Flight Log', icon: FileText },
      { id: 'geofence', label: 'Geofence', icon: Shield },
      { id: 'storyboard', label: 'Storyboard', icon: Film },
      { id: 'showcontrol', label: 'Show Control', icon: Clock },
      { id: 'inspector', label: 'Inspector', icon: Eye },
    ],
  },
  {
    title: 'Integration',
    icon: Globe,
    items: [
      { id: 'dmx', label: 'DMX512', icon: Lightbulb },
      { id: 'smpte', label: 'SMPTE/LTC', icon: Clock },
      { id: 'livefiring', label: 'Live SFX', icon: Zap },
      { id: 'diagnostic', label: 'Diagnostic', icon: ShieldCheck, shortcut: 'D' },
      { id: 'logistics', label: 'Logistics', icon: Tag },
    ],
  },
  {
    title: 'Scene',
    icon: Cog,
    items: [
      { id: 'scene', label: 'Scene Editor', icon: Cog, shortcut: 'N' },
      { id: 'wind', label: 'Wind/Camera', icon: Wind },
      { id: 'background', label: 'Backgrounds', icon: Image },
      { id: 'maps', label: 'Google Maps', icon: Globe },
      { id: 'sitelayout', label: 'Site Layout', icon: Map },
    ],
  },
];

// Flatten all items with section index for dock effect
function flattenItems(sections: typeof PANEL_SECTIONS) {
  const items: { id: PanelId; label: string; icon: typeof Route; shortcut?: string; sectionIdx: number; type: 'item' }[] = [];
  sections.forEach((section, si) => {
    section.items.forEach(item => {
      items.push({ ...item, sectionIdx: si, type: 'item' });
    });
  });
  return items;
}

interface PanelTabBarProps {
  activePanel: PanelId | null;
  onTogglePanel: (id: PanelId) => void;
}

/**
 * macOS Dock-style magnification effect for the sidebar icons.
 * When the mouse hovers over an icon, it scales up and neighbors scale proportionally.
 */
export default function PanelTabBar({ activePanel, onTogglePanel }: PanelTabBarProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mouseY, setMouseY] = useState<number | null>(null);

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
    setHoveredIndex(null);
  }, []);

  // Calculate scale for each button based on distance from mouse
  const getScale = (buttonIndex: number, buttonRefs: Map<number, HTMLButtonElement>) => {
    if (mouseY === null) return 1;
    const btn = buttonRefs.get(buttonIndex);
    if (!btn || !containerRef.current) return 1;
    const containerRect = containerRef.current.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const btnCenter = btnRect.top + btnRect.height / 2 - containerRect.top;
    const distance = Math.abs(mouseY - btnCenter);
    const maxDist = 80; // pixels of influence
    const maxScale = 1.5;
    const minScale = 1;
    if (distance > maxDist) return minScale;
    const t = 1 - distance / maxDist;
    // Smooth cosine curve like macOS dock
    const scale = minScale + (maxScale - minScale) * (Math.cos((1 - t) * Math.PI) + 1) / 2;
    return scale;
  };

  // We track button refs for position calculation
  const buttonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  let globalIdx = 0;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="w-[52px] flex-shrink-0 bg-card/80 backdrop-blur-md border-l border-border/40 flex flex-col">
        <ScrollArea className="flex-1">
          <div
            ref={containerRef}
            className="flex flex-col items-center py-1.5 gap-0"
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
                          "w-full flex items-center justify-center py-1.5 transition-colors relative group",
                          hasActive
                            ? "text-primary"
                            : "text-muted-foreground/50 hover:text-muted-foreground"
                        )}
                      >
                        {hasActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r" />
                        )}
                        <div className="flex flex-col items-center gap-0.5">
                          <SectionIcon className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                          <span className="text-[6px] font-bold tracking-widest uppercase leading-none opacity-60">{section.title.split(' ')[0]}</span>
                          <span className="text-[6px] text-muted-foreground/40">{isCollapsed ? '▸' : '▾'}</span>
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-[10px] font-medium">
                      {section.title}
                    </TooltipContent>
                  </Tooltip>

                  {/* Section items with dock magnification */}
                  {!isCollapsed && (
                    <div className="flex flex-col items-center gap-[2px] pb-1">
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
                          const maxDist = 70;
                          if (distance < maxDist) {
                            const t = 1 - distance / maxDist;
                            scale = 1 + 0.45 * (Math.cos((1 - t) * Math.PI) + 1) / 2;
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
                                  transition: 'transform 0.15s cubic-bezier(0.25, 0.1, 0.25, 1)',
                                  zIndex: scale > 1.1 ? 10 : 1,
                                }}
                                className={cn(
                                  "w-9 h-9 flex items-center justify-center rounded-lg relative",
                                  isActive
                                    ? "bg-primary/20 text-primary shadow-sm shadow-primary/20"
                                    : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/30"
                                )}
                              >
                                {isActive && (
                                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-primary rounded-r" />
                                )}
                                <Icon className="w-[18px] h-[18px]" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-[10px] font-medium" sideOffset={scale > 1.1 ? 12 : 6}>
                              {label}{shortcut ? ` (${shortcut})` : ''}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  )}

                  {/* Divider */}
                  {si < PANEL_SECTIONS.length - 1 && (
                    <div className="mx-3 border-t border-border/20 my-1" />
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
