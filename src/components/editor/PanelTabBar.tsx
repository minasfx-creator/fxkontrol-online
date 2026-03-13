import { Route, Wind, FileText, Package, Cpu, DollarSign, Spline, Sliders, Settings2, Bug, Gauge, Lightbulb, Battery, Radio, Clock, Globe, ShieldCheck, Tag, Sparkles, Music, Download, StickyNote, Video, Box, Image, ShoppingBag, Shield, Wand2, Eye, Warehouse, Link2, Users, ChevronDown, ChevronRight, FileBarChart, Paintbrush, Volume2, Camera, Share2, Atom, History, Cloud, Zap, MessageSquare, Navigation, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState } from 'react';

export type PanelId = 'script' | 'wind' | 'reports' | 'racks' | 'addressing' | 'inventory' | 'waypoints' | 'effects' | 'properties' | 'boids' | 'pid' | 'dmx' | 'battery' | 'mavlink' | 'smpte' | 'maps' | 'diagnostic' | 'logistics' | 'swarmgpt' | 'synesthesia' | 'firing' | 'labels' | 'video' | 'models' | 'background' | 'suppliers' | 'safety' | 'scripting' | 'audience' | 'indoor' | 'chains' | 'groups' | 'summary' | 'scene' | 'soundlevel' | 'aroverlay' | 'share' | 'collab' | 'particles' | 'versioning' | 'weather' | 'collisions' | 'approval' | 'trajectory' | 'templates' | 'telemetry' | 'flightlog';

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
      { id: 'summary', label: 'Show Summary', icon: FileBarChart },
      { id: 'scene', label: 'Scene Editor', icon: Paintbrush, shortcut: 'N' },
      { id: 'audience', label: 'Audience', icon: Eye },
      { id: 'soundlevel', label: 'Sound Level', icon: Volume2 },
      { id: 'wind', label: 'Wind/Cam', icon: Wind },
      { id: 'particles', label: 'Particles', icon: Atom },
      { id: 'collisions', label: 'Collisions', icon: Zap },
      { id: 'trajectory', label: 'Trajectory Opt', icon: Navigation },
      { id: 'templates', label: 'Templates', icon: FolderOpen },
      { id: 'weather', label: 'Weather', icon: Cloud },
      { id: 'versioning', label: 'Versioning', icon: History },
      { id: 'approval', label: 'Approval', icon: MessageSquare },
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
      { id: 'background', label: 'Background', icon: Image },
      { id: 'aroverlay', label: 'AR Overlay', icon: Camera },
      { id: 'share', label: 'Share', icon: Share2 },
    ],
  },
  {
    title: 'Drone',
    icon: Bug,
    items: [
      { id: 'boids', label: 'Boids', icon: Bug },
      { id: 'pid', label: 'PID', icon: Gauge },
      { id: 'battery', label: 'Battery', icon: Battery },
      { id: 'mavlink', label: 'MAVLink', icon: Radio },
      { id: 'indoor', label: 'Indoor Sim', icon: Warehouse },
      { id: 'telemetry', label: 'Telemetry', icon: Activity },
      { id: 'flightlog', label: 'Flight Log', icon: FileText },
    ],
  },
  {
    title: 'Integration',
    icon: Globe,
    items: [
      { id: 'dmx', label: 'DMX512', icon: Lightbulb },
      { id: 'smpte', label: 'SMPTE/LTC', icon: Clock },
      { id: 'maps', label: 'Google Maps', icon: Globe },
      { id: 'diagnostic', label: 'Diagnostic', icon: ShieldCheck, shortcut: 'D' },
      { id: 'logistics', label: 'Logistics', icon: Tag },
      { id: 'collab', label: 'Collaborate', icon: Users },
    ],
  },
];

interface PanelTabBarProps {
  activePanel: PanelId | null;
  onTogglePanel: (id: PanelId) => void;
}

export default function PanelTabBar({ activePanel, onTogglePanel }: PanelTabBarProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (title: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  // Check if active panel is in a section
  const activeSectionTitle = PANEL_SECTIONS.find(s => s.items.some(i => i.id === activePanel))?.title;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="w-11 flex-shrink-0 bg-surface-1 border-l border-border/60 flex flex-col">
        <ScrollArea className="flex-1">
          <div className="flex flex-col items-center py-1 gap-0">
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
                          "w-full flex items-center justify-center py-1.5 transition-colors relative",
                          hasActive
                            ? "text-primary"
                            : "text-muted-foreground/60 hover:text-muted-foreground"
                        )}
                      >
                        {hasActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-r" />
                        )}
                        <div className="flex flex-col items-center gap-0">
                          <SectionIcon className="w-3 h-3" />
                          <span className="text-[7px] font-medium tracking-wider uppercase mt-0.5 leading-none">{section.title.split(' ')[0]}</span>
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs">
                      {section.title} {isCollapsed ? '(collapsed)' : ''}
                    </TooltipContent>
                  </Tooltip>

                  {/* Section items */}
                  {!isCollapsed && (
                    <div className="flex flex-col items-center gap-0 pb-1">
                      {section.items.map(({ id, label, icon: Icon, shortcut }) => {
                        const isActive = activePanel === id;
                        return (
                          <Tooltip key={id}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => onTogglePanel(id)}
                                className={cn(
                                  "w-8 h-6 flex items-center justify-center rounded transition-all relative",
                                  isActive
                                    ? "bg-primary/20 text-primary"
                                    : "text-muted-foreground/70 hover:text-foreground hover:bg-surface-3/60"
                                )}
                              >
                                {isActive && (
                                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-3 bg-primary rounded-l" />
                                )}
                                <Icon className="w-3 h-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-xs">
                              {label}{shortcut ? ` (${shortcut})` : ''}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  )}

                  {/* Divider */}
                  {si < PANEL_SECTIONS.length - 1 && (
                    <div className="mx-2 border-t border-border/30 my-0.5" />
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
