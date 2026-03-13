import { Route, Wind, FileText, Package, Cpu, DollarSign, Spline, Sliders, Settings2, Bug } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type PanelId = 'script' | 'wind' | 'reports' | 'racks' | 'addressing' | 'inventory' | 'waypoints' | 'effects' | 'properties' | 'boids';

const PANEL_TABS: { id: PanelId; label: string; icon: typeof Route; shortcut?: string }[] = [
  { id: 'properties', label: 'Properties', icon: Settings2, shortcut: 'P' },
  { id: 'script', label: 'Script Editor', icon: Route, shortcut: 'S' },
  { id: 'waypoints', label: 'Waypoint Editor', icon: Spline, shortcut: 'W' },
  { id: 'effects', label: 'Effect Editor', icon: Sliders, shortcut: 'E' },
  { id: 'wind', label: 'Wind & Camera', icon: Wind },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'racks', label: 'Racks', icon: Package },
  { id: 'addressing', label: 'Addressing', icon: Cpu },
  { id: 'inventory', label: 'Inventory', icon: DollarSign },
  { id: 'boids', label: 'Boids Swarm', icon: Bug },
];

interface PanelTabBarProps {
  activePanel: PanelId | null;
  onTogglePanel: (id: PanelId) => void;
}

export default function PanelTabBar({ activePanel, onTogglePanel }: PanelTabBarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="w-10 flex-shrink-0 bg-surface-1 border-l border-border flex flex-col items-center py-2 gap-0.5">
        {PANEL_TABS.map(({ id, label, icon: Icon, shortcut }) => {
          const isActive = activePanel === id;
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onTogglePanel(id)}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center rounded-md transition-all relative",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-3"
                  )}
                >
                  {isActive && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-l" />
                  )}
                  <Icon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">
                {label}{shortcut ? ` (${shortcut})` : ''}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
