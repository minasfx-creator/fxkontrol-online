import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { MapPin, Crosshair, Zap, Move } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SelectionStatusBar() {
  const { selectedPositionIds, positions, timelineItems, editorMode } = useProjectStore();

  const selectedPositions = positions.filter(p => selectedPositionIds.includes(p.id));
  const selectedPyro = selectedPositions.filter(p => p.type === 'pyro');
  const selectedDrone = selectedPositions.filter(p => p.type === 'drone-pad');

  const linkedEffectCount = timelineItems.filter(
    t => selectedPositionIds.includes(t.positionId || '') ||
      t.positionIds?.some(id => selectedPositionIds.includes(id))
  ).length;

  if (editorMode !== 'select' && editorMode !== 'add-pyro' && editorMode !== 'add-drone') return null;

  if (selectedPositions.length === 0) {
    return (
      <div className="absolute bottom-14 left-3 bg-card/85 backdrop-blur-sm border border-border/50 rounded-md px-3 py-1.5 shadow-lg">
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
          {editorMode === 'select' ? (
            <>
              <Crosshair className="w-3 h-3" />
              Click para selecionar · Shift+Click multi · Alt+Drag box select · E editor
            </>
          ) : (
            <>
              <Move className="w-3 h-3 text-primary" />
              Click no terreno para posicionar · ESC para cancelar
            </>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="absolute bottom-14 left-3 bg-card/90 backdrop-blur-md border border-primary/20 rounded-md px-3 py-2 space-y-1.5 shadow-xl max-w-xs">
      <div className="flex items-center gap-3 text-[10px] font-mono">
        {selectedPyro.length > 0 && (
          <span className="flex items-center gap-1 text-accent">
            <MapPin className="w-3 h-3" />
            {selectedPyro.length} Pyro
          </span>
        )}
        {selectedDrone.length > 0 && (
          <span className="flex items-center gap-1 text-primary">
            <MapPin className="w-3 h-3" />
            {selectedDrone.length} Drone
          </span>
        )}
        <span className="text-border">|</span>
        <span className="flex items-center gap-1 text-foreground">
          <Zap className="w-3 h-3" />
          {linkedEffectCount} fx
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {selectedPositions.slice(0, 6).map(p => (
          <span
            key={p.id}
            className={cn(
              "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border",
              p.type === 'pyro'
                ? "bg-accent/15 text-accent border-accent/30"
                : "bg-primary/15 text-primary border-primary/30"
            )}
          >
            {p.name}
          </span>
        ))}
        {selectedPositions.length > 6 && (
          <span className="text-[8px] text-muted-foreground self-center">+{selectedPositions.length - 6}</span>
        )}
      </div>
    </div>
  );
}
