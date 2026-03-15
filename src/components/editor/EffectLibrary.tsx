import { useState, useCallback } from 'react';
import { Search, ChevronDown, ChevronRight, Flame, Sparkles, Radio, Shapes, Wand2, Zap, Lightbulb, Droplets, Bomb, CandlestickChart as Candle, Waves, Box, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { EFFECT_LIBRARY, useProjectStore, type Effect } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';
import { parseVDL } from '@/lib/vdlParser';

const CATEGORIES = [
  { key: 'morteiros' as const, label: 'Shells', icon: Flame },
  { key: 'peonias' as const, label: 'Aerial Effects', icon: Sparkles },
  { key: 'mines' as const, label: 'Mines', icon: Bomb },
  { key: 'roman_candles' as const, label: 'Roman Candles', icon: Candle },
  { key: 'waterfalls' as const, label: 'Waterfalls', icon: Waves },
  { key: 'cakes_batteries' as const, label: 'Cakes & Batteries', icon: Box },
  { key: 'sfx' as const, label: 'Special FX', icon: Droplets },
  { key: 'lasers' as const, label: 'Lasers', icon: Zap },
  { key: 'iluminacao' as const, label: 'Lighting', icon: Lightbulb },
  { key: 'drones' as const, label: 'Drone Units', icon: Radio },
  { key: 'formacoes' as const, label: 'Formations', icon: Shapes },
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

    // Auto-create a position if none is selected (drones, lasers, lights, SFX)
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

  const typeColor = effect.type === 'laser' ? 'text-green-400' : effect.type === 'sfx' ? 'text-cyan-400' : effect.type === 'light' ? 'text-yellow-400' : '';

  return (
    <button
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => selectEffect(effect.id)}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-all text-sm group effect-card-hover",
        isSelected
          ? "bg-primary/10 text-primary border border-primary/30 dock-active-glow"
          : "hover:bg-surface-3/80 text-secondary-foreground border border-transparent",
        isDragging && "opacity-50"
      )}
    >
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-border/50 transition-transform group-hover:scale-125"
        style={{ backgroundColor: effect.color, boxShadow: `0 0 6px ${effect.color}44` }}
      />
      <div className="flex-1 min-w-0">
        <p className={cn("truncate text-[11px] font-medium", typeColor)}>{effect.name}</p>
        <p className="text-[9px] text-muted-foreground font-mono-code">{effect.duration}s · ${effect.cost}</p>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[7px] text-muted-foreground/50 font-mono-code">
        DBL
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

  const filteredEffects = EFFECT_LIBRARY.filter((e) => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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

  const totalCount = filteredEffects.length;

  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[10px] font-bold text-foreground uppercase tracking-[0.15em]">Asset Palette</h2>
          <span className="text-[9px] font-mono text-muted-foreground">{totalCount}</span>
        </div>
        <div className="relative mb-1.5">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search effects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-7 text-xs bg-surface-2 border-border"
          />
        </div>
        {/* Type filter chips — no emojis, icon-only */}
        <div className="flex flex-wrap gap-0.5">
          {FILTER_CHIPS.map(f => {
            const FIcon = f.icon;
            return (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-all border flex items-center gap-1",
                  typeFilter === f.key
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-surface-2 text-muted-foreground border-transparent hover:text-foreground"
                )}
              >
                <FIcon className="w-2.5 h-2.5" />
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {CATEGORIES.map(({ key, label, icon: Icon }) => {
          const isOpen = openCategories.has(key);
          const effects = filteredEffects.filter((e) => e.category === key);
          if (effects.length === 0) return null;

          return (
            <div key={key} className="mb-0.5">
              <button
                onClick={() => toggleCategory(key)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <Icon className="w-3.5 h-3.5 text-primary/60" />
                <span className="uppercase tracking-wider text-[10px]">{label}</span>
                <span className="ml-auto text-[9px] text-muted-foreground font-mono">{effects.length}</span>
              </button>
              {isOpen && (
                <div className="pl-2 pr-1 space-y-0.5">
                  {effects.map((effect) => (
                    <EffectCard key={effect.id} effect={effect} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* VDL Quick Add */}
      <div className="px-3 py-2 border-t border-border space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Wand2 className="h-3 w-3 text-primary" />
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.15em]">VDL Quick Add</span>
        </div>
        <Input
          placeholder='e.g. 4in Red Peony'
          value={vdlInput}
          onChange={(e) => setVdlInput(e.target.value)}
          onKeyDown={handleVDLSubmit}
          className="h-7 text-xs bg-surface-2 border-border font-mono"
        />
        {vdlInput && (
          <p className={cn("text-[10px]", parseVDL(vdlInput).valid ? "text-primary" : "text-muted-foreground")}>
            {parseVDL(vdlInput).valid
              ? `${parseVDL(vdlInput).typeName} · ${parseVDL(vdlInput).caliber}" · ${parseVDL(vdlInput).duration}s — Enter to add`
              : 'Keep typing...'}
          </p>
        )}
        <p className="text-[9px] text-muted-foreground">Drag, double-click, or type VDL</p>
      </div>
    </div>
  );
}
