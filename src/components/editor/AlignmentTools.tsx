import { useProjectStore } from '@/store/useProjectStore';
import { AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, AlignStartHorizontal, AlignEndHorizontal, AlignStartVertical, AlignEndVertical, Rows3, Columns3, Copy, Clipboard, Trash2, RotateCcw, Flame, CircleDot, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useCallback, useState } from 'react';
import type { Position, PositionType } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';

let clipboard: Position[];
clipboard = [];

export default function AlignmentTools() {
  const { selectedPositionIds, positions, updatePosition, addPosition, removePosition, selectMultiplePositions } = useProjectStore();
  const [typeFilter, setTypeFilter] = useState<PositionType | 'all'>('all');
  const allSelected = positions.filter(p => selectedPositionIds.includes(p.id));
  const selected = typeFilter === 'all' ? allSelected : allSelected.filter(p => p.type === typeFilter);

  const pyroCount = allSelected.filter(p => p.type === 'pyro').length;
  const droneCount = allSelected.filter(p => p.type === 'drone-pad').length;
  const lightCount = allSelected.filter(p => p.type === 'light').length;

  const align = useCallback((mode: 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-z') => {
    if (selected.length < 2) return;
    const xs = selected.map(p => p.x);
    const zs = selected.map(p => p.z);

    selected.forEach(p => {
      switch (mode) {
        case 'left': updatePosition(p.id, { x: Math.min(...xs) }); break;
        case 'right': updatePosition(p.id, { x: Math.max(...xs) }); break;
        case 'top': updatePosition(p.id, { z: Math.min(...zs) }); break;
        case 'bottom': updatePosition(p.id, { z: Math.max(...zs) }); break;
        case 'center-x': updatePosition(p.id, { x: (Math.min(...xs) + Math.max(...xs)) / 2 }); break;
        case 'center-z': updatePosition(p.id, { z: (Math.min(...zs) + Math.max(...zs)) / 2 }); break;
      }
    });
    toast.success(`Aligned ${selected.length} positions`);
  }, [selected, updatePosition]);

  const distribute = useCallback((axis: 'x' | 'z') => {
    if (selected.length < 3) return;
    const sorted = [...selected].sort((a, b) => axis === 'x' ? a.x - b.x : a.z - b.z);
    const first = axis === 'x' ? sorted[0].x : sorted[0].z;
    const last = axis === 'x' ? sorted[sorted.length - 1].x : sorted[sorted.length - 1].z;
    const step = (last - first) / (sorted.length - 1);
    sorted.forEach((p, i) => {
      updatePosition(p.id, { [axis]: Math.round((first + step * i) * 10) / 10 });
    });
    toast.success(`Distributed ${sorted.length} positions on ${axis.toUpperCase()}`);
  }, [selected, updatePosition]);

  const copyPositions = useCallback(() => {
    clipboard = selected.map(p => ({ ...p }));
    toast.success(`Copied ${clipboard.length} positions`);
  }, [selected]);

  const pastePositions = useCallback(() => {
    if (clipboard.length === 0) return;
    const newIds: string[] = [];
    clipboard.forEach((p, i) => {
      const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      newIds.push(id);
      addPosition({
        ...p,
        id,
        name: `${p.name}-copy`,
        x: p.x + 2,
        z: p.z + 2,
      });
    });
    selectMultiplePositions(newIds);
    toast.success(`Pasted ${clipboard.length} positions`);
  }, [addPosition, selectMultiplePositions]);

  const deleteSelected = useCallback(() => {
    selected.forEach(p => removePosition(p.id));
    toast.success(`Deleted ${selected.length} positions`);
  }, [selected, removePosition]);

  const resetHeadings = useCallback(() => {
    selected.forEach(p => updatePosition(p.id, { heading: 0 }));
    toast.success('Headings reset to 0°');
  }, [selected, updatePosition]);

  if (allSelected.length === 0) return null;

  const btnClass = "h-7 w-7 p-0";
  const filterBtn = (type: PositionType | 'all', icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setTypeFilter(type)}
      className={cn(
        "px-1.5 py-0.5 text-[8px] rounded border transition-colors flex items-center gap-0.5",
        typeFilter === type
          ? "bg-primary/15 text-primary border-primary/30"
          : "text-muted-foreground/50 border-border/30 hover:text-muted-foreground"
      )}
      title={label}
    >
      {icon}
    </button>
  );

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-surface-1/95 backdrop-blur-md border border-border/60 rounded-lg px-2 py-1 shadow-xl">
      {/* Type filter */}
      <div className="flex items-center gap-0.5 mr-1">
        {filterBtn('all', <span className="text-[7px]">ALL</span>, 'All types')}
        {pyroCount > 0 && filterBtn('pyro', <Flame className="w-2.5 h-2.5" />, `Pyro (${pyroCount})`)}
        {droneCount > 0 && filterBtn('drone-pad', <CircleDot className="w-2.5 h-2.5" />, `Drone (${droneCount})`)}
        {lightCount > 0 && filterBtn('light', <Lightbulb className="w-2.5 h-2.5" />, `Light (${lightCount})`)}
      </div>

      <span className="text-[9px] font-mono text-muted-foreground mr-1">{selected.length}/{allSelected.length}</span>
      <Separator orientation="vertical" className="h-5" />
      
      {/* Alignment */}
      <Button variant="ghost" size="icon" className={btnClass} onClick={() => align('left')} title="Align Left (X)">
        <AlignStartHorizontal className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className={btnClass} onClick={() => align('center-x')} title="Center X">
        <AlignHorizontalJustifyCenter className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className={btnClass} onClick={() => align('right')} title="Align Right (X)">
        <AlignEndHorizontal className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className={btnClass} onClick={() => align('top')} title="Align Top (Z)">
        <AlignStartVertical className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className={btnClass} onClick={() => align('center-z')} title="Center Z">
        <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className={btnClass} onClick={() => align('bottom')} title="Align Bottom (Z)">
        <AlignEndVertical className="w-3.5 h-3.5" />
      </Button>

      <Separator orientation="vertical" className="h-5" />

      {/* Distribute */}
      <Button variant="ghost" size="icon" className={btnClass} onClick={() => distribute('x')} title="Distribute X" disabled={selected.length < 3}>
        <Columns3 className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className={btnClass} onClick={() => distribute('z')} title="Distribute Z" disabled={selected.length < 3}>
        <Rows3 className="w-3.5 h-3.5" />
      </Button>

      <Separator orientation="vertical" className="h-5" />

      {/* Actions */}
      <Button variant="ghost" size="icon" className={btnClass} onClick={copyPositions} title="Copy (Ctrl+C)">
        <Copy className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className={btnClass} onClick={pastePositions} title="Paste (Ctrl+V)">
        <Clipboard className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className={btnClass} onClick={resetHeadings} title="Reset Headings">
        <RotateCcw className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className={`${btnClass} text-destructive hover:text-destructive`} onClick={deleteSelected} title="Delete">
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
