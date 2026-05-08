/**
 * LeftToolRailLegacy — vertical icon rail at viewport's left edge.
 *
 * Visual-only. Emits viewport-* events that GeoCameraController /
 * useViewportStore already listen to. Zero hardware/safety imports.
 */
import { useState } from 'react';
import {
  Move, RotateCcw, Maximize, Plus, Crosshair, Camera, Magnet, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useViewportStore } from '@/store/useViewportStore';

interface ToolDef {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut: string;
  onClick: () => void;
  accent?: boolean;
}

export default function LeftToolRailLegacy() {
  const [active, setActive] = useState<string>('move');
  const frameAll = useViewportStore((s) => s.frameAll);
  const frameSel = useViewportStore((s) => s.frameSelection);

  const TOOLS: ToolDef[] = [
    { id: 'move',     icon: Move,      label: 'Mover',          shortcut: 'G', onClick: () => setActive('move'), accent: true },
    { id: 'rotate',   icon: RotateCcw, label: 'Rotacionar',     shortcut: 'R', onClick: () => setActive('rotate') },
    { id: 'scale',    icon: Maximize,  label: 'Escala',         shortcut: 'S', onClick: () => setActive('scale') },
    { id: 'frameAll', icon: Eye,       label: 'Frame All',      shortcut: 'F', onClick: () => { setActive('frameAll'); frameAll(); } },
    { id: 'frameSel', icon: Crosshair, label: 'Frame Selection',shortcut: '.', onClick: () => { setActive('frameSel'); frameSel(); } },
    { id: 'snap',     icon: Magnet,    label: 'Snap',           shortcut: 'X', onClick: () => setActive('snap') },
    { id: 'camera',   icon: Camera,    label: 'Câmera',         shortcut: 'C', onClick: () => setActive('camera') },
    { id: 'add',      icon: Plus,      label: 'Adicionar',      shortcut: 'A', onClick: () => setActive('add') },
  ];

  return (
    <div
      role="toolbar"
      aria-orientation="vertical"
      aria-label="Ferramentas de viewport"
      className="absolute left-2 top-2 bottom-2 z-30 w-12 flex flex-col gap-1 p-1 rounded-xl bg-zinc-950/70 backdrop-blur-md border border-cyan-500/10"
    >
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={t.onClick}
            aria-pressed={isActive}
            title={`${t.label} (${t.shortcut})`}
            className={cn(
              'h-10 w-10 rounded-lg flex items-center justify-center transition-all duration-150 ds-focus',
              isActive
                ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40 shadow-[0_0_12px_-3px_rgba(251,191,36,0.5)]'
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
