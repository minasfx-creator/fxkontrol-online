/**
 * RightIconRailLegacy — vertical icon rail at viewport's right edge.
 * Visual-only. Click switches the right-dock active tab.
 */
import {
  Search, Radio, MapPin, Plus, Settings, Zap, Users, MoreHorizontal,
  ZoomIn, ZoomOut, Compass,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  activeRightTab: string;
  onSelectRightTab: (tabValue: string) => void;
  onOpenPalette: () => void;
}

interface RailDef {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** Right-dock tab to activate, or special id ('palette' | 'zoomIn' | 'zoomOut'). */
  action: string;
}

const RAIL: RailDef[] = [
  { id: 'palette',  icon: Search,          label: 'Buscar (⌘K)',     action: 'palette' },
  { id: 'cmd',      icon: Radio,           label: 'Comando',         action: 'hardware' },
  { id: 'cue',      icon: MapPin,          label: 'Cue / Posições',  action: 'cue' },
  { id: 'addPos',   icon: Plus,            label: 'Adicionar pos',   action: 'sceneEditor' },
  { id: 'render',   icon: Settings,        label: 'Render',          action: 'render' },
  { id: 'fx',       icon: Zap,             label: 'FX / Laser',      action: 'laser' },
  { id: 'people',   icon: Users,           label: 'Strategy',        action: 'strategy' },
  { id: 'more',     icon: MoreHorizontal,  label: 'Mais',            action: 'effect' },
  { id: 'zoomIn',   icon: ZoomIn,          label: 'Zoom +',          action: 'zoomIn' },
  { id: 'zoomOut',  icon: ZoomOut,         label: 'Zoom −',          action: 'zoomOut' },
  { id: 'compass',  icon: Compass,         label: 'Bússola',         action: 'scene' },
];

export default function RightIconRailLegacy({ activeRightTab, onSelectRightTab, onOpenPalette }: Props) {
  return (
    <div
      role="toolbar"
      aria-orientation="vertical"
      aria-label="Painéis e zoom"
      className="absolute right-2 top-2 bottom-2 z-30 w-12 flex flex-col gap-1 p-1 rounded-xl bg-zinc-950/70 backdrop-blur-md border border-cyan-500/10"
    >
      {RAIL.map((r) => {
        const Icon = r.icon;
        const isActive = r.action === activeRightTab;
        const handle = () => {
          if (r.action === 'palette') return onOpenPalette();
          if (r.action === 'zoomIn' || r.action === 'zoomOut') {
            window.dispatchEvent(new CustomEvent(`viewport-${r.action}`));
            return;
          }
          onSelectRightTab(r.action);
        };
        return (
          <button
            key={r.id}
            type="button"
            onClick={handle}
            aria-pressed={isActive}
            title={r.label}
            aria-label={r.label}
            className={cn(
              'h-10 w-10 rounded-lg flex items-center justify-center transition-all duration-150 ds-focus',
              isActive
                ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/40'
                : 'text-zinc-400 hover:text-cyan-200 hover:bg-white/[0.05]',
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
