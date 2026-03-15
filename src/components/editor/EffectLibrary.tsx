import { useState, useCallback, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Flame, Sparkles, Radio, Shapes, Wand2, Zap, Lightbulb, Droplets, Bomb, CandlestickChart as Candle, Waves, Box, AlertTriangle, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { EFFECT_LIBRARY, useProjectStore, type Effect } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';
import { parseVDL } from '@/lib/vdlParser';
import { ScrollArea } from '@/components/ui/scroll-area';

const CATEGORIES = [
  { key: 'morteiros' as const, label: 'Shells', icon: Flame, accent: 'hsl(15, 95%, 55%)' },
  { key: 'peonias' as const, label: 'Aerial Effects', icon: Sparkles, accent: 'hsl(45, 90%, 55%)' },
  { key: 'mines' as const, label: 'Mines', icon: Bomb, accent: 'hsl(0, 80%, 50%)' },
  { key: 'roman_candles' as const, label: 'Roman Candles', icon: Candle, accent: 'hsl(30, 85%, 55%)' },
  { key: 'waterfalls' as const, label: 'Waterfalls', icon: Waves, accent: 'hsl(195, 90%, 55%)' },
  { key: 'cakes_batteries' as const, label: 'Cakes & Batteries', icon: Box, accent: 'hsl(280, 70%, 55%)' },
  { key: 'sfx' as const, label: 'Special FX', icon: Droplets, accent: 'hsl(190, 90%, 55%)' },
  { key: 'lasers' as const, label: 'Lasers', icon: Zap, accent: 'hsl(120, 80%, 50%)' },
  { key: 'iluminacao' as const, label: 'Lighting', icon: Lightbulb, accent: 'hsl(50, 95%, 55%)' },
  { key: 'drones' as const, label: 'Drone Units', icon: Radio, accent: 'hsl(200, 80%, 55%)' },
  { key: 'formacoes' as const, label: 'Formations', icon: Shapes, accent: 'hsl(270, 70%, 60%)' },
];

type FilterType = 'all' | 'firework' | 'drone' | 'sfx' | 'laser' | 'light';

const FILTER_CHIPS: { key: FilterType; label: string; icon: typeof Flame }[] = [
  { key: 'all', label: 'ALL', icon: Box },
  { key: 'firework', label: 'PYRO', icon: Flame },
  { key: 'sfx', label: 'SFX', icon: Droplets },
  { key: 'laser', label: 'LASER', icon: Zap },
  { key: 'light', label: 'LIGHT', icon: Lightbulb },
  { key: 'drone', label: 'DRONE', icon: Radio },
];

function EffectCard({ effect }: { effect: Effect }) {
  const { selectedEffectId, selectEffect, addTimelineItem, currentTime, positions, selectedPositionId, selectedPositionIds } = useProjectStore();
  const [isDragging, setIsDragging] = useState(false);
  const isSelected = selectedEffectId === effect.id;

  const handleDoubleClick = () => {
    const isPyroEffect = effect.type === 'firework' || effect.type === 'sfx';
    const isDroneEffect = effect.type === 'drone';
    const isLaserOrLight = effect.type === 'laser' || effect.type === 'light';
    const validType = isPyroEffect ? 'pyro' : isDroneEffect ? 'drone-pad' : null;

    let targetIds = selectedPositionIds.length > 0
      ? selectedPositionIds.filter(id => {
          const p = positions.find(pp => pp.id === id);
          return validType ? p?.type === validType : true;
        })
      : selectedPositionId && positions.find(p => p.id === selectedPositionId)?.type === (validType || positions.find(pp => pp.id === selectedPositionId)?.type)
        ? [selectedPositionId]
        : [];

    if (targetIds.length === 0) {
      const store = useProjectStore.getState();
      const posType = isDroneEffect ? 'drone-pad' as const : 'pyro' as const;
      const prefix = isDroneEffect ? 'PAD' : isLaserOrLight ? 'FIX' : 'POS';
      const count = store.positions.filter(p => p.type === posType).length + 1;
      const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const spawnX = (Math.random() - 0.5) * 16;
      const spawnZ = (Math.random() - 0.5) * 8;
      store.addPosition({
        id,
        name: `${prefix}-${count.toString().padStart(3, '0')}`,
        type: posType,
        x: Math.round(spawnX * 10) / 10,
        y: 0,
        z: Math.round(spawnZ * 10) / 10,
        heading: 0, pitch: 85, roll: 0,
        color: isDroneEffect ? '#00B4D8' : isLaserOrLight ? '#FFDD44' : '#FF6B35',
      });
      store.selectPosition(id);
      targetIds = [id];
    }

    targetIds.forEach((posId, i) => {
      const pos = positions.find(p => p.id === posId);
      if (!pos) return;
      addTimelineItem({
        id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${i}`,
        effectId: effect.id,
        startTime: currentTime,
        trackIndex: effect.type === 'firework' ? 0 : effect.type === 'drone' ? 1 : 2,
        position: { x: pos.x, y: pos.y, z: pos.z },
        positionId: posId,
        positionIds: targetIds.length > 1 ? targetIds : undefined,
        positionName: pos.name,
      });
    });

    toast.success(`${effect.name} → ${targetIds.length} position${targetIds.length > 1 ? 's' : ''}`);
  };

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('application/effect-id', effect.id);
    e.dataTransfer.effectAllowed = 'copy';
    setIsDragging(true);
  }, [effect.id]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const typeAccent: Record<string, string> = {
    laser: 'hsl(120, 80%, 50%)',
    sfx: 'hsl(190, 90%, 55%)',
    light: 'hsl(50, 95%, 55%)',
    firework: 'hsl(18, 100%, 55%)',
    drone: 'hsl(195, 100%, 50%)',
  };

  const accentColor = typeAccent[effect.type] || 'hsl(var(--muted))';

  return (
    <button
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => selectEffect(effect.id)}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-[7px] rounded-lg text-left transition-all group relative overflow-hidden",
        isSelected
          ? "bg-primary/10 text-primary ring-1 ring-primary/20"
          : "hover:bg-surface-2/80 text-secondary-foreground",
        isDragging && "opacity-40 scale-95"
      )}
    >
      {/* Left accent bar */}
      <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full" style={{ backgroundColor: accentColor, opacity: isSelected ? 1 : 0.4 }} />
      
      {/* Drag handle */}
      <GripVertical className="w-3 h-3 text-muted-foreground/20 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
      
      {/* Color swatch */}
      <div
        className="w-3.5 h-3.5 rounded flex-shrink-0"
        style={{ 
          backgroundColor: effect.color, 
          boxShadow: `0 0 10px ${effect.color}44, inset 0 0 4px rgba(255,255,255,0.2)` 
        }}
      />
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-[11px] font-medium leading-tight">{effect.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] text-muted-foreground/60 font-mono-code">{effect.duration}s</span>
          <span className="text-[9px] text-muted-foreground/30">·</span>
          <span className="text-[9px] text-muted-foreground/60 font-mono-code">${effect.cost}</span>
        </div>
      </div>
      
      {/* Quick-add hint */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[7px] font-semibold text-primary/60 bg-primary/8 px-1.5 py-0.5 rounded-md font-mono-code">
          2×CLK
        </span>
      </div>
    </button>
  );
}

export default function EffectLibrary() {
  const [search, setSearch] = useState('');
  const [vdlInput, setVdlInput] = useState('');
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(['morteiros', 'drones']));
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const { addTimelineItem, currentTime } = useProjectStore();

  const toggleCategory = (key: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const filteredEffects = useMemo(() => 
    EFFECT_LIBRARY.filter((e) => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }), [typeFilter, search]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredEffects.forEach(e => {
      counts[e.category] = (counts[e.category] || 0) + 1;
    });
    return counts;
  }, [filteredEffects]);

  const handleVDLSubmit = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !vdlInput.trim()) return;
    const vdl = parseVDL(vdlInput);
    if (!vdl.valid) return;
    const colorStr = vdl.colorNames.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join('/');
    const newItem = {
      id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      effectId: `vdl-${Date.now()}`,
      startTime: currentTime,
      trackIndex: 0,
      position: {
        x: (Math.random() - 0.5) * 16,
        y: vdl.height / 10,
        z: (Math.random() - 0.5) * 8,
      },
      notes: `VDL: ${vdl.caliber}" ${colorStr} ${vdl.typeName} | Stars:${vdl.starCount} Spread:${vdl.spread}°`,
    };
    addTimelineItem(newItem);
    setVdlInput('');
  };

  return (
    <div className="h-full flex flex-col glass border-r border-border/15">
      {/* Header */}
      <div className="px-3.5 pt-3.5 pb-2.5 border-b border-border/15">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary/20 to-accent/15 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <h2 className="text-[11px] font-bold text-foreground uppercase tracking-[0.12em] font-display leading-none">Effects</h2>
              <p className="text-[8px] text-muted-foreground/50 mt-0.5 font-mono-code">{filteredEffects.length} items</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-2.5">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
          <Input
            placeholder="Search effects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs bg-surface-0/60 border-border/20 focus:border-primary/40 rounded-lg"
          />
        </div>

        {/* Type filter chips */}
        <div className="flex flex-wrap gap-1">
          {FILTER_CHIPS.map(f => {
            const FIcon = f.icon;
            const isActive = typeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={cn(
                  "px-2 py-[5px] rounded-lg text-[9px] font-semibold uppercase transition-all flex items-center gap-1",
                  isActive
                    ? "bg-primary/15 text-primary shadow-[0_0_10px_hsl(var(--primary)/0.12)]"
                    : "bg-surface-0/40 text-muted-foreground/50 hover:text-muted-foreground hover:bg-surface-2/60"
                )}
              >
                <FIcon className="w-3 h-3" />
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Categories with effects */}
      <ScrollArea className="flex-1">
        <div className="py-1.5 px-1">
          {CATEGORIES.map(({ key, label, icon: Icon, accent }) => {
            const isOpen = openCategories.has(key);
            const count = categoryCounts[key] || 0;
            if (count === 0) return null;
            const effects = filteredEffects.filter((e) => e.category === key);

            return (
              <div key={key} className="mb-1">
                <button
                  onClick={() => toggleCategory(key)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all group",
                    isOpen ? "text-foreground bg-surface-1/40" : "text-muted-foreground hover:text-foreground hover:bg-surface-1/30"
                  )}
                >
                  <div className="w-1.5 h-1.5 rounded-full transition-transform" style={{ backgroundColor: accent, transform: isOpen ? 'scale(1.3)' : 'scale(1)' }} />
                  {isOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground/40" /> : <ChevronRight className="w-3 h-3 text-muted-foreground/30" />}
                  <span className="uppercase tracking-wider text-[10px] flex-1 text-left font-display">{label}</span>
                  <span className="text-[9px] font-mono-code text-muted-foreground/40 tabular-nums">
                    {count}
                  </span>
                </button>
                {isOpen && (
                  <div className="pl-1 pr-0.5 pb-1 space-y-[2px] mt-0.5">
                    {effects.map((effect) => (
                      <EffectCard key={effect.id} effect={effect} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* VDL Quick Add */}
      <div className="px-3 py-2.5 border-t border-border/15">
        <div className="flex items-center gap-1.5 mb-2">
          <Wand2 className="h-3 w-3 text-primary/70" />
          <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-[0.12em] font-display">VDL Quick Add</span>
        </div>
        <Input
          placeholder='e.g. 4in Red Peony'
          value={vdlInput}
          onChange={(e) => setVdlInput(e.target.value)}
          onKeyDown={handleVDLSubmit}
          className="h-7 text-xs bg-surface-0/60 border-border/20 font-mono-code rounded-lg"
        />
        {vdlInput && (
          <p className={cn("text-[9px] mt-1.5", parseVDL(vdlInput).valid ? "text-primary" : "text-muted-foreground/40")}>
            {parseVDL(vdlInput).valid
              ? `${parseVDL(vdlInput).typeName} · ${parseVDL(vdlInput).caliber}" · ${parseVDL(vdlInput).duration}s — ⏎`
              : 'Keep typing...'}
          </p>
        )}
      </div>
    </div>
  );
}
