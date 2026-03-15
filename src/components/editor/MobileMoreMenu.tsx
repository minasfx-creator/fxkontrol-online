/**
 * Mobile "More" menu — grid of icons for secondary panels
 */
import { 
  Wind, FileText, Grid3X3, Bookmark, Package, Navigation, Sliders, 
  Gauge, Radio, Timer, Map, Stethoscope, Truck, Bot, Music2,
  Crosshair, Tag, Video, Box, Image, ShoppingBag, Shield, Code2,
  Users, Link, Sparkles, History, Cloud, AlertTriangle,
  Rocket, LayoutTemplate, Activity, FileDown, Route, Store, MapPin, Settings, Factory
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PanelId } from '@/components/editor/PanelTabBar';

const MORE_ITEMS: { id: PanelId; label: string; icon: typeof Wind }[] = [
  { id: 'safety', label: 'Safety', icon: Shield },
  { id: 'scene', label: 'Scene', icon: Image },
  { id: 'weather', label: 'Weather', icon: Cloud },
  { id: 'swarmgpt', label: 'SwarmGPT', icon: Bot },
  { id: 'script', label: 'Script', icon: Code2 },
  { id: 'wind', label: 'Wind', icon: Wind },
  { id: 'racks', label: 'Racks', icon: Grid3X3 },
  { id: 'groups', label: 'Groups', icon: Bookmark },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'waypoints', label: 'Waypoints', icon: Navigation },
  { id: 'chains', label: 'Chains', icon: Link },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'firing', label: 'Export', icon: FileDown },
  { id: 'maps', label: 'Maps', icon: Map },
  { id: 'labels', label: 'Labels', icon: Tag },
  { id: 'calibration', label: 'Calibration', icon: Factory },
  { id: 'share', label: 'Share', icon: Users },
  { id: 'livefiring', label: 'Live SFX', icon: Sparkles },
  { id: 'inspector', label: 'Inspector', icon: FileText },
];

interface MobileMoreMenuProps {
  onSelectPanel: (id: PanelId) => void;
}

export default function MobileMoreMenu({ onSelectPanel }: MobileMoreMenuProps) {
  return (
    <div className="p-3">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 px-1">
        All Panels
      </h3>
      <div className="grid grid-cols-4 gap-2">
        {MORE_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onSelectPanel(id)}
            className={cn(
              "flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all",
              "bg-muted/30 hover:bg-muted/60 active:scale-95",
              "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[8px] font-bold uppercase tracking-wider truncate w-full text-center">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
