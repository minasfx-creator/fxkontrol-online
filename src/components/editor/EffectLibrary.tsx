import { useState, useCallback, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Flame, Sparkles, Radio, Shapes, Wand2, Zap, Lightbulb, Droplets, Bomb, CandlestickChart as Candle, Waves, Box, GripVertical, Clock, MapPin, Ruler, List, LayoutGrid, Hash } from 'lucide-react';
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
type ViewMode = 'list' | 'table';

const FILTER_CHIPS: { key: FilterType; label: string; icon: typeof Flame }[] = [
  { key: 'all', label: 'ALL', icon: Box },
  { key: 'firework', label: 'PYRO', icon: Flame },
  { key: 'sfx', label: 'SFX', icon: Droplets },
  { key: 'laser', label: 'LASER', icon: Zap },
  { key: 'light', label: 'LIGHT', icon: Lightbulb },
  { key: 'drone', label: 'DRONE', icon: Radio },
];

const CALIBER_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12];

/* ─── Finale 3D-style Table Row ─── */
function EffectTableRow({ effect, index }: { effect: Effect; index: number }) {
  const { selectedEffectId, selectEffect, addTimelineItem, currentTime, positions, selectedPositionId, selectedPositionIds } = useProjectStore();
  const isSelected = selectedEffectId === effect.id;
  const isPyro = effect.type === 'firework';
  const vdl = useMemo(() => isPyro ? parseVDL(`${effect.caliber || 4}in ${effect.name}`) : null, [effect, isPyro]);

  const handleAdd = useCallback(() => {
    const validType = isPyro || effect.type === 'sfx' ? 'pyro' : effect.type === 'drone' ? 'drone-pad' : null;

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
      const posType = effect.type === 'drone' ? 'drone-pad' as const : 'pyro' as const;
      const prefix = effect.type === 'drone' ? 'PAD' : 'POS';
      const count = store.positions.filter(p => p.type === posType).length + 1;
      const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      store.addPosition({
        id,
        name: `${prefix}-${count.toString().padStart(3, '0')}`,
        type: posType,
        x: Math.round((Math.random() - 0.5) * 16 * 10) / 10,
        y: 0,
        z: Math.round((Math.random() - 0.5) * 8 * 10) / 10,
        heading: 0, pitch: 85, roll: 0,
        color: effect.type === 'drone' ? '#00B4D8' : '#FF6B35',
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
        notes: `VDL: ${effect.caliber || 4}" ${effect.name}`,
      });
    });
    toast.success(`${effect.name} → ${targetIds.length} pos @ ${currentTime.toFixed(1)}s`);
    if (isPyro && targetIds.length > 0) {
      useProjectStore.getState().setEditorMode('adjust-angles');
    }
  }, [effect, currentTime, positions, selectedPositionId, selectedPositionIds, addTimelineItem, isPyro]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('application/effect-id', effect.id);
    e.dataTransfer.effectAllowed = 'copy';
  }, [effect.id]);

  return (
    <tr
      draggable
      onDragStart={handleDragStart}
      onClick={() => selectEffect(effect.id)}
      onDoubleClick={handleAdd}
      className={cn(
        "cursor-pointer transition-colors group text-[10px]",
        isSelected
          ? "bg-primary/10"
          : index % 2 === 0
            ? "bg-transparent hover:bg-muted/30"
            : "bg-muted/8 hover:bg-muted/30"
      )}
    >
      {/* Line # */}
      <td className="px-1.5 py-[5px] text-muted-foreground/30 font-mono-code text-right w-8 tabular-nums">
        {index + 1}
      </td>
      {/* Icon */}
      <td className="px-1 py-[5px] w-5">
        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: effect.color, boxShadow: `0 0 6px ${effect.color}44` }} />
      </td>
      {/* Effect name */}
      <td className="px-1.5 py-[5px] font-medium text-foreground truncate max-w-[120px]">
        <span>{effect.name}</span>
        {/* VDL feature badges */}
        <span className="ml-1 inline-flex gap-0.5">
          {vdl?.hasPistil && <span className="text-[7px] bg-accent/15 text-accent px-1 rounded" title="Pistil">◎</span>}
          {vdl?.colorTransition && vdl.colorTransition !== 'none' && <span className="text-[7px] bg-primary/15 text-primary px-1 rounded" title="Color change">↔</span>}
          {vdl?.fallingLeaves && <span className="text-[7px] bg-green-500/15 text-green-400 px-1 rounded" title="Falling leaves">🍂</span>}
          {vdl?.trailType && vdl.trailType !== 'none' && <span className="text-[7px] bg-yellow-500/15 text-yellow-400 px-1 rounded" title={vdl.trailType}>✦</span>}
        </span>
      </td>
      {/* Caliber */}
      <td className="px-1.5 py-[5px] text-accent/70 font-mono-code text-center w-8">
        {isPyro ? `${effect.caliber || 4}"` : '—'}
      </td>
      {/* Duration */}
      <td className="px-1.5 py-[5px] text-muted-foreground/60 font-mono-code text-right w-10 tabular-nums">
        {effect.duration}s
      </td>
      {/* Type badge */}
      <td className="px-1.5 py-[5px] w-12">
        <span className={cn(
          "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
          effect.type === 'firework' && "bg-accent/15 text-accent",
          effect.type === 'drone' && "bg-primary/15 text-primary",
          effect.type === 'sfx' && "bg-cyan-500/15 text-cyan-400",
          effect.type === 'laser' && "bg-green-500/15 text-green-400",
          effect.type === 'light' && "bg-yellow-500/15 text-yellow-400",
        )}>
          {effect.type === 'firework' ? 'PY' : effect.type.slice(0, 2).toUpperCase()}
        </span>
      </td>
    </tr>
  );
}

/* ─── Classic Card Row (existing style, compact) ─── */
function EffectCard({ effect }: { effect: Effect }) {
  const { selectedEffectId, selectEffect, addTimelineItem, currentTime, positions, selectedPositionId, selectedPositionIds } = useProjectStore();
  const [isDragging, setIsDragging] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedCaliber, setSelectedCaliber] = useState(effect.caliber || 4);
  const [fireTime, setFireTime] = useState<number | ''>('');
  const isSelected = selectedEffectId === effect.id;

  const handleAdd = useCallback((overrideTime?: number) => {
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

    const actualTime = overrideTime ?? currentTime;

    targetIds.forEach((posId, i) => {
      const pos = positions.find(p => p.id === posId);
      if (!pos) return;
      addTimelineItem({
        id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${i}`,
        effectId: effect.id,
        startTime: actualTime,
        trackIndex: effect.type === 'firework' ? 0 : effect.type === 'drone' ? 1 : 2,
        position: { x: pos.x, y: pos.y, z: pos.z },
        positionId: posId,
        positionIds: targetIds.length > 1 ? targetIds : undefined,
        positionName: pos.name,
        notes: `VDL: ${selectedCaliber}" ${effect.name}`,
      });
    });

    toast.success(`${effect.name} ${selectedCaliber}" → ${targetIds.length} pos @ ${actualTime.toFixed(1)}s`);
  }, [effect, selectedCaliber, currentTime, positions, selectedPositionId, selectedPositionIds, addTimelineItem]);

  const handleDoubleClick = () => handleAdd();

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('application/effect-id', effect.id);
    e.dataTransfer.effectAllowed = 'copy';
    setIsDragging(true);
  }, [effect.id]);

  const handleDragEnd = useCallback(() => setIsDragging(false), []);

  const typeAccent: Record<string, string> = {
    laser: 'hsl(120, 80%, 50%)',
    sfx: 'hsl(190, 90%, 55%)',
    light: 'hsl(50, 95%, 55%)',
    firework: 'hsl(18, 100%, 55%)',
    drone: 'hsl(195, 100%, 50%)',
  };
  const accentColor = typeAccent[effect.type] || 'hsl(var(--muted))';
  const isPyro = effect.type === 'firework';

  return (
    <div className="group">
      <button
        draggable="true"
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={() => { selectEffect(effect.id); setExpanded(!expanded); }}
        onDoubleClick={handleDoubleClick}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-[7px] rounded-xl text-left transition-all relative overflow-hidden",
          isSelected
            ? "bg-primary/8 ring-1 ring-primary/15"
            : "hover:bg-surface-2/60",
          isDragging && "opacity-40 scale-95"
        )}
      >
        <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full transition-opacity" style={{ backgroundColor: accentColor, opacity: isSelected ? 1 : 0.3 }} />
        <GripVertical className="w-3 h-3 text-muted-foreground/15 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
        <div className="w-3.5 h-3.5 rounded-md flex-shrink-0" style={{ backgroundColor: effect.color, boxShadow: `0 0 8px ${effect.color}33` }} />
        <div className="flex-1 min-w-0">
          <p className="truncate text-[11px] font-medium leading-tight text-foreground">{effect.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isPyro && <span className="text-[9px] text-accent/60 font-mono-code font-semibold">{effect.caliber || 4}"</span>}
            <span className="text-[9px] text-muted-foreground/50 font-mono-code">{effect.duration}s</span>
          </div>
        </div>
        <ChevronRight className={cn("w-3 h-3 text-muted-foreground/30 transition-transform", expanded && isSelected && "rotate-90")} />
      </button>

      {/* Expanded VDL Controls */}
      {expanded && isSelected && (
        <div className="mx-2 mb-1 mt-0.5 p-2.5 rounded-xl bg-surface-0/80 border border-border/15 space-y-2 animate-fxk-slide-down">
          {isPyro && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">
                <Ruler className="w-3 h-3" />
                Calibre
              </div>
              <div className="flex gap-1">
                {CALIBER_OPTIONS.map(cal => (
                  <button
                    key={cal}
                    onClick={(e) => { e.stopPropagation(); setSelectedCaliber(cal); }}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all",
                      selectedCaliber === cal
                        ? "bg-accent/15 text-accent border border-accent/30"
                        : "bg-surface-1 text-muted-foreground/60 border border-transparent hover:bg-surface-2"
                    )}
                  >
                    {cal}"
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">
              <Clock className="w-3 h-3" />
              Tempo (s)
            </div>
            <div className="flex gap-1.5">
              <input
                type="number"
                step={0.1}
                min={0}
                placeholder={`${currentTime.toFixed(1)}`}
                value={fireTime}
                onClick={e => e.stopPropagation()}
                onChange={e => setFireTime(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="flex-1 h-7 px-2 rounded-lg text-[11px] bg-surface-1 border border-border/20 text-foreground font-mono-code outline-none focus:border-primary/40"
              />
              <button
                onClick={(e) => { e.stopPropagation(); setFireTime(currentTime); }}
                className="px-2 h-7 rounded-lg text-[9px] bg-surface-1 text-muted-foreground hover:text-primary border border-border/20 font-mono-code transition-colors"
              >
                NOW
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[9px] text-muted-foreground/50 font-mono-code">
            <MapPin className="w-3 h-3" />
            {selectedPositionIds.length > 0
              ? `${selectedPositionIds.length} posições selecionadas`
              : selectedPositionId
                ? `Posição: ${positions.find(p => p.id === selectedPositionId)?.name || selectedPositionId}`
                : 'Auto-criar posição'}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); handleAdd(typeof fireTime === 'number' ? fireTime : undefined); }}
            className="w-full h-8 rounded-xl bg-primary/15 text-primary text-[11px] font-semibold hover:bg-primary/25 transition-all flex items-center justify-center gap-1.5 border border-primary/20"
          >
            <Flame className="w-3.5 h-3.5" />
            Adicionar {isPyro ? `${selectedCaliber}" ` : ''}{effect.name}
          </button>
        </div>
      )}
    </div>
  );
}

export default function EffectLibrary() {
  const [search, setSearch] = useState('');
  const [vdlInput, setVdlInput] = useState('');
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(['morteiros', 'drones']));
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const { addTimelineItem, currentTime, positions } = useProjectStore();

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
    toast.success(`VDL: ${vdl.caliber}" ${colorStr} ${vdl.typeName}`);
  };

  return (
    <div className="h-full flex flex-col border-r border-border/10" style={{ background: 'hsl(var(--card))' }}>
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-border/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary" />
            </div>
            <div>
              <h2 className="text-[11px] font-bold text-foreground uppercase tracking-[0.12em] font-display leading-none">Effects</h2>
              <p className="text-[8px] text-muted-foreground/40 mt-0.5 font-mono-code">{filteredEffects.length} items</p>
            </div>
          </div>
          {/* View toggle — Finale 3D has list/table */}
          <div className="flex gap-0.5 p-0.5 rounded-lg bg-surface-0/50">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-1 rounded transition-all",
                viewMode === 'list' ? "bg-surface-2 text-foreground" : "text-muted-foreground/30 hover:text-muted-foreground/60"
              )}
              title="Card view"
            >
              <LayoutGrid className="w-3 h-3" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "p-1 rounded transition-all",
                viewMode === 'table' ? "bg-surface-2 text-foreground" : "text-muted-foreground/30 hover:text-muted-foreground/60"
              )}
              title="Table view (Finale 3D)"
            >
              <List className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/30" />
          <Input
            placeholder="Search effects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-7 text-[11px] bg-surface-0/50 border-border/15 focus:border-primary/30 rounded-lg"
          />
        </div>

        {/* Type filter chips */}
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-surface-0/50">
          {FILTER_CHIPS.map(f => {
            const FIcon = f.icon;
            const isActive = typeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={cn(
                  "flex-1 py-1 rounded-md text-[8px] font-semibold uppercase transition-all flex items-center justify-center gap-0.5",
                  isActive
                    ? "bg-surface-2 text-foreground shadow-sm"
                    : "text-muted-foreground/40 hover:text-muted-foreground/70"
                )}
              >
                <FIcon className="w-2.5 h-2.5" />
                <span className="hidden xl:inline">{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {viewMode === 'table' ? (
          /* ─── Finale 3D Table View ─── */
          <div className="py-1">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-[8px] uppercase tracking-wider text-muted-foreground/40 font-display border-b border-border/10">
                  <th className="px-1.5 py-1.5 text-right w-8">
                    <Hash className="w-2.5 h-2.5 inline" />
                  </th>
                  <th className="px-1 py-1.5 w-5"></th>
                  <th className="px-1.5 py-1.5 text-left">Effect</th>
                  <th className="px-1.5 py-1.5 text-center w-8">Cal</th>
                  <th className="px-1.5 py-1.5 text-right w-10">Dur</th>
                  <th className="px-1.5 py-1.5 w-12">Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredEffects.map((effect, i) => (
                  <EffectTableRow key={effect.id} effect={effect} index={i} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ─── Card/List View (default) ─── */
          <div className="py-1 px-1">
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
                      "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                      isOpen ? "text-foreground bg-surface-1/30" : "text-muted-foreground hover:text-foreground hover:bg-surface-1/20"
                    )}
                  >
                    <div className="w-1.5 h-1.5 rounded-full transition-transform" style={{ backgroundColor: accent, transform: isOpen ? 'scale(1.3)' : 'scale(1)' }} />
                    {isOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground/30" /> : <ChevronRight className="w-3 h-3 text-muted-foreground/20" />}
                    <span className="uppercase tracking-wider text-[10px] flex-1 text-left font-display">{label}</span>
                    <span className="text-[9px] font-mono-code text-muted-foreground/30 tabular-nums">{count}</span>
                  </button>
                  {isOpen && (
                    <div className="pl-1 pr-0.5 pb-1 space-y-[1px] mt-0.5">
                      {effects.map((effect) => (
                        <EffectCard key={effect.id} effect={effect} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* VDL Quick Add */}
      <div className="px-3 py-2 border-t border-border/10">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Wand2 className="h-3 w-3 text-primary/50" />
          <span className="text-[8px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em] font-display">VDL Quick Add</span>
        </div>
        <Input
          placeholder='e.g. 4in Red Peony'
          value={vdlInput}
          onChange={(e) => setVdlInput(e.target.value)}
          onKeyDown={handleVDLSubmit}
          className="h-6 text-[11px] bg-surface-0/50 border-border/15 font-mono-code rounded-lg"
        />
        {vdlInput && (
          <p className={cn("text-[9px] mt-1", parseVDL(vdlInput).valid ? "text-primary" : "text-muted-foreground/30")}>
            {parseVDL(vdlInput).valid
              ? `${parseVDL(vdlInput).typeName} · ${parseVDL(vdlInput).caliber}" · ${parseVDL(vdlInput).duration}s — ⏎`
              : 'Keep typing...'}
          </p>
        )}
      </div>
    </div>
  );
}
