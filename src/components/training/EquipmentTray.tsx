import { CheckCircle2, MousePointerClick } from 'lucide-react';
import { Equipment, PlacedItem } from './types';

interface EquipmentTrayProps {
  equipment: Equipment[];
  selectedEquipment: string | null;
  placedItems: PlacedItem[];
  onSelect: (equipmentId: string | null) => void;
}

export default function EquipmentTray({ equipment, selectedEquipment, placedItems, onSelect }: EquipmentTrayProps) {
  const placedEquipmentIds = new Set(placedItems.map((p) => p.equipmentId));

  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5 bg-[hsl(var(--surface-0))]/90 backdrop-blur-sm border border-border/50 rounded-lg p-2 min-w-[160px]">
      <div className="flex items-center gap-1.5 px-1 pb-1 border-b border-border/30">
        <MousePointerClick className="h-3 w-3 text-primary" />
        <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
          Equipamentos
        </span>
      </div>

      {equipment.map((eq) => {
        const isPlaced = placedEquipmentIds.has(eq.id);
        const isSelected = selectedEquipment === eq.id;

        return (
          <button
            key={eq.id}
            onClick={() => {
              if (isPlaced) return;
              onSelect(isSelected ? null : eq.id);
            }}
            disabled={isPlaced}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all duration-150 text-[10px] ${
              isPlaced
                ? 'opacity-40 cursor-default bg-muted/10'
                : isSelected
                ? 'bg-primary/20 border border-primary/50 text-primary shadow-[0_0_8px_hsl(var(--primary)/0.2)]'
                : 'hover:bg-muted/20 border border-transparent hover:border-border/40 text-foreground/80'
            }`}
          >
            <span className="text-sm">{eq.icon}</span>
            <span className="flex-1 truncate">{eq.name}</span>
            {isPlaced && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />}
          </button>
        );
      })}

      {selectedEquipment && (
        <div className="mt-1 px-1 pt-1 border-t border-border/30">
          <p className="text-[8px] text-primary font-mono animate-pulse">
            → Clique num ponto verde para colocar
          </p>
        </div>
      )}
    </div>
  );
}
