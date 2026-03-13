import { Route, Wind, FileText, Package, Cpu, DollarSign, Spline, Sliders, Settings2, Bug, Gauge, Lightbulb, Battery, Radio, Clock, Globe, ShieldCheck, Tag, Sparkles, Music, Download, StickyNote, Video, Box, Image, ShoppingBag, Shield, Wand2, Eye, Warehouse } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';

export type PanelId = 'script' | 'wind' | 'reports' | 'racks' | 'addressing' | 'inventory' | 'waypoints' | 'effects' | 'properties' | 'boids' | 'pid' | 'dmx' | 'battery' | 'mavlink' | 'smpte' | 'maps' | 'diagnostic' | 'logistics' | 'swarmgpt' | 'synesthesia' | 'firing' | 'labels' | 'video' | 'models' | 'background' | 'suppliers' | 'safety' | 'scripting' | 'audience' | 'indoor';

const PANEL_SECTIONS: { title: string; items: { id: PanelId; label: string; icon: typeof Route; shortcut?: string }[] }[] = [
  {
    title: 'Core',
    items: [
      { id: 'properties', label: 'Properties', icon: Settings2, shortcut: 'P' },
      { id: 'effects', label: 'Effect Editor', icon: Sliders, shortcut: 'E' },
      { id: 'script', label: 'Script Editor', icon: Route, shortcut: 'S' },
      { id: 'waypoints', label: 'Waypoint Editor', icon: Spline, shortcut: 'W' },
    ],
  },
  {
    title: 'AI & Audio',
    items: [
      { id: 'swarmgpt', label: 'SwarmGPT · AI', icon: Sparkles, shortcut: 'A' },
      { id: 'synesthesia', label: 'Audio Synesthesia', icon: Music, shortcut: 'Y' },
      { id: 'scripting', label: 'Scripting Tools', icon: Wand2, shortcut: 'T' },
    ],
  },
  {
    title: 'Show',
    items: [
      { id: 'safety', label: 'Safety NFPA', icon: Shield, shortcut: 'F' },
      { id: 'audience', label: 'Audience View', icon: Eye },
      { id: 'wind', label: 'Wind & Camera', icon: Wind },
      { id: 'firing', label: 'Firing Export', icon: Download, shortcut: 'X' },
      { id: 'video', label: 'Video Recorder', icon: Video, shortcut: 'V' },
      { id: 'indoor', label: 'Indoor Sim', icon: Warehouse },
    ],
  },
  {
    title: 'Hardware',
    items: [
      { id: 'racks', label: 'Racks', icon: Package },
      { id: 'addressing', label: 'Addressing', icon: Cpu },
      { id: 'inventory', label: 'Inventory', icon: DollarSign },
      { id: 'labels', label: 'Labels', icon: StickyNote },
      { id: 'suppliers', label: 'Suppliers', icon: ShoppingBag },
    ],
  },
  {
    title: 'Drone',
    items: [
      { id: 'boids', label: 'Boids Swarm', icon: Bug },
      { id: 'pid', label: 'PID Controller', icon: Gauge },
      { id: 'battery', label: 'Battery', icon: Battery },
      { id: 'mavlink', label: 'MAVLink', icon: Radio },
    ],
  },
  {
    title: 'Integration',
    items: [
      { id: 'dmx', label: 'DMX512', icon: Lightbulb },
      { id: 'smpte', label: 'SMPTE/LTC', icon: Clock },
      { id: 'maps', label: 'Google Maps', icon: Globe, shortcut: 'G' },
      { id: 'diagnostic', label: 'Diagnostic', icon: ShieldCheck, shortcut: 'D' },
      { id: 'reports', label: 'Reports', icon: FileText },
      { id: 'logistics', label: 'Logistics', icon: Tag },
      { id: 'models', label: '3D Models', icon: Box },
      { id: 'background', label: 'Background', icon: Image },
    ],
  },
];

interface PanelTabBarProps {
  activePanel: PanelId | null;
  onTogglePanel: (id: PanelId) => void;
}

export default function PanelTabBar({ activePanel, onTogglePanel }: PanelTabBarProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="w-10 flex-shrink-0 bg-surface-1 border-l border-border flex flex-col">
        <ScrollArea className="flex-1">
          <div className="flex flex-col items-center py-1.5 gap-0.5">
            {PANEL_SECTIONS.map((section, si) => (
              <div key={section.title} className="w-full">
                {si > 0 && (
                  <div className="mx-2 my-1 border-t border-border/40" />
                )}
                {section.items.map(({ id, label, icon: Icon, shortcut }) => {
                  const isActive = activePanel === id;
                  return (
                    <Tooltip key={id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onTogglePanel(id)}
                          className={cn(
                            "w-8 h-7 flex items-center justify-center rounded-md transition-all relative mx-auto",
                            isActive
                              ? "bg-primary/15 text-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-surface-3"
                          )}
                        >
                          {isActive && (
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-3.5 bg-primary rounded-l" />
                          )}
                          <Icon className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs">
                        {label}{shortcut ? ` (${shortcut})` : ''}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}
