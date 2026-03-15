import { useState, useCallback, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Flame, Sparkles, Radio, Shapes, Wand2, Zap, Lightbulb, Droplets, Bomb, CandlestickChart as Candle, Waves, Box, AlertTriangle, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { EFFECT_LIBRARY, useProjectStore, type Effect } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';
import { parseVDL } from '@/lib/vdlParser';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

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

  const typeColors: Record<string, string> = {
    laser: 'border-l-green-500',
    sfx: 'border-l-cyan-400',
    light: 'border-l-yellow-400',
    firework: 'border-l-orange-500',
    drone: 'border-l-blue-400',
  };

  return (
    <button
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => selectEffect(effect.id)}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-all group border-l-2",
        typeColors[effect.type] || 'border-l-muted',
        isSelected
          ? "bg-primary/12 text-primary ring-1 ring-primary/25"
          : "hover:bg-surface-3/60 text-secondary-foreground",
        isDragging && "opacity-40 scale-95"
      )}
    >
      {/* Drag handle */}
      <GripVertical className="w-3 h-3 text-muted-foreground/30 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      {/* Color swatch */}
      <div
        className="w-3 h-3 rounded-sm flex-shrink-0 ring-1 ring-white/10"
        style={{ backgroundColor: effect.color, boxShadow: `0 0 8px ${effect.color}33` }}
      />
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-[11px] font-semibold leading-tight">{effect.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px] text-muted-foreground font-mono-code">{effect.duration}s</span>
          <span className="text-[9px] text-muted-foreground/50">·</span>
          <span className="text-[9px] text-muted-foreground font-mono-code">${effect.cost}</span>
        </div>
      </div>
      
      {/* Quick-add hint */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[7px] font-bold text-muted-foreground/60 bg-surface-3 px-1 py-0.5 rounded font-mono-code">
          2×CLICK
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
    <div className="h-full flex flex-col bg-card/95 backdrop-blur-sm border-r border-border/60">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-border/40">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary" />
            </div>
            <h2 className="text-[11px] font-bold text-foreground uppercase tracking-[0.12em] font-display">Effect Library</h2>
          </div>
          <Badge variant="secondary" className="text-[9px] font-mono-code h-5 px-1.5">
            {filteredEffects.length}
          </Badge>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
          <Input
            placeholder="Search effects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs bg-surface-1 border-border/40 focus:border-primary/50 rounded-md"
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
                  "px-2 py-1 rounded-md text-[9px] font-bold uppercase transition-all border flex items-center gap-1",
                  isActive
                    ? "bg-primary/15 text-primary border-primary/30 shadow-[0_0_8px_hsl(var(--primary)/0.15)]"
                    : "bg-surface-1 text-muted-foreground/70 border-border/30 hover:text-foreground hover:border-border/60"
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
        <div className="py-1">
          {CATEGORIES.map(({ key, label, icon: Icon, accent }) => {
            const isOpen = openCategories.has(key);
            const count = categoryCounts[key] || 0;
            if (count === 0) return null;
            const effects = filteredEffects.filter((e) => e.category === key);

            return (
              <div key={key} className="mb-0.5">
                <button
                  onClick={() => toggleCategory(key)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-all group",
                    isOpen ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground/60" /> : <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
                  <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: `${accent}15` }}>
                    <Icon className="w-2.5 h-2.5" style={{ color: accent }} />
                  </div>
                  <span className="uppercase tracking-wider text-[10px] flex-1 text-left">{label}</span>
                  <span className="text-[9px] font-mono-code text-muted-foreground/50 bg-surface-2 px-1.5 py-0.5 rounded">
                    {count}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-1.5 pb-1 space-y-0.5">
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
      <div className="px-3 py-2.5 border-t border-border/40 bg-surface-1/50">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Wand2 className="h-3 w-3 text-primary" />
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.12em]">VDL Quick Add</span>
        </div>
        <Input
          placeholder='e.g. 4in Red Peony'
          value={vdlInput}
          onChange={(e) => setVdlInput(e.target.value)}
          onKeyDown={handleVDLSubmit}
          className="h-7 text-xs bg-surface-2 border-border/40 font-mono-code"
        />
        {vdlInput && (
          <p className={cn("text-[9px] mt-1", parseVDL(vdlInput).valid ? "text-primary" : "text-muted-foreground/50")}>
            {parseVDL(vdlInput).valid
              ? `${parseVDL(vdlInput).typeName} · ${parseVDL(vdlInput).caliber}" · ${parseVDL(vdlInput).duration}s — ⏎ Enter`
              : 'Keep typing...'}
          </p>
        )}
        <p className="text-[8px] text-muted-foreground/40 mt-1 font-mono-code">Drag · Double-click · VDL code</p>
      </div>
    </div>
  );
}
